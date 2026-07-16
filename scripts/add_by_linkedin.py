#!/usr/bin/env python3
"""
Add (or recover) specific alumni by LinkedIn URL.

Generalizes the one-off add_curated.py into a reusable tool for the recurring
"you're missing so-and-so" email. For each URL it enriches via Crustdata,
confirms a Duke tie, derives the PRIMARY current role with the fixed
pick_primary_employer (so an adjunct professorship never masks the real job),
and writes people + duke_degrees + work_history.

Handles three prior states of the person:
  - absent            -> insert a new verified (or club_alumni) row
  - status=rejected   -> PROMOTE to verified and correct the role (sports path)
  - status=review     -> promote to verified (sports path)

With --club <slug>: tags the person into that Duke sports club. New people land
as status=club_alumni (not published in the sports directory). Existing verified
profiles keep their sports status and only gain the club affiliation.
source=club_roster.

Usage:
    python scripts/add_by_linkedin.py --org teams_clubs \
        https://www.linkedin.com/in/scott-lewis-1a55b02
    python scripts/add_by_linkedin.py --club dsbc \
        https://www.linkedin.com/in/...
    python scripts/add_by_linkedin.py --dry-run https://www.linkedin.com/in/...
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import supabase_client as sb
import crustdata_client as cd
from classify import classify_functions
from employer import pick_primary_employer
from enrich import duke_school_map, degrees_from
from backfill_work_history import roles_for
from add_curated import canon_linkedin
from us_states import normalize_state
from clubs_catalog import CLUBS_BY_SLUG

REPO = Path(__file__).parent.parent
JSON_PATH = REPO / "src/data/person_clubs.json"


def duke_ok(prof, duke_map):
    for e in prof.get("education_background", []):
        inst = e.get("institute_name") or e.get("school") or e.get("institute")
        if inst in duke_map:
            return True
    return False


def resolve_org(domain, sports_by_domain, override):
    if override:
        return override
    comp = sports_by_domain.get((domain or "").lower())
    return comp["org_category"] if comp else None


def tables_ready():
    try:
        sb.select("duke_clubs", {"select": "slug", "limit": "1"})
        sb.select("person_clubs", {"select": "id", "limit": "1"})
        return True
    except SystemExit:
        return False


def club_id_for(slug):
    rows = sb.select("duke_clubs", {"select": "id,slug", "slug": f"eq.{slug}"})
    return rows[0]["id"] if rows else None


def load_json_affils():
    if not JSON_PATH.exists():
        return []
    return json.loads(JSON_PATH.read_text()).get("affiliations") or []


def save_json_affils(affils):
    JSON_PATH.write_text(json.dumps({
        "affiliations": affils,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "note": "Written by scripts/discover_clubs.py / add_by_linkedin.py.",
    }, indent=2) + "\n")


def upsert_json_affil(affils, person_id, club_slug, linkedin_url, full_name, status):
    key = (person_id, club_slug)
    out = [a for a in affils if (a.get("person_id"), a.get("club_slug")) != key]
    out.append({
        "person_id": person_id,
        "club_slug": club_slug,
        "source": "club_roster",
        "evidence": "Provided by club leadership roster",
        "role_title": None,
        "confidence": 1.0,
        "linkedin_url": linkedin_url,
        "full_name": full_name,
        "directory_status": status,
    })
    return out


def write_club_affiliation(person_id, club_slug, linkedin_url, full_name, status, dry_run):
    if dry_run:
        print(f"    club : would tag {club_slug}")
        return
    # source tag on people
    rows = sb.select("people", {"select": "id,source", "id": f"eq.{person_id}"})
    src = list((rows[0].get("source") if rows else None) or [])
    tag = f"club:{club_slug}"
    if tag not in src:
        src.append(tag)
        if "club_roster" not in src:
            src.append("club_roster")
        sb.update("people", {"id": f"eq.{person_id}"}, {"source": src})

    if tables_ready():
        cid = club_id_for(club_slug)
        if cid:
            sb.insert("person_clubs", [{
                "person_id": person_id,
                "club_id": cid,
                "source": "club_roster",
                "evidence": "Provided by club leadership roster",
                "role_title": None,
                "confidence": 1.0,
            }], on_conflict="person_id,club_id", upsert=True, return_rows=False)

    affils = upsert_json_affil(
        load_json_affils(), person_id, club_slug, linkedin_url, full_name, status)
    save_json_affils(affils)
    print(f"    club : tagged {club_slug}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("urls", nargs="+")
    ap.add_argument("--org", help="org_category override (needed when the employer "
                    "isn't in sports_companies)")
    ap.add_argument("--club", choices=list(CLUBS_BY_SLUG),
                    help="Tag into a Duke sports club (DSBC/DSAC/MES)")
    ap.add_argument("--status", default=None,
                    choices=["verified", "review", "club_alumni"],
                    help="Default: verified (sports) or club_alumni (with --club)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    club_mode = bool(args.club)
    status = args.status or ("club_alumni" if club_mode else "verified")

    # Fall back if club_alumni is not yet allowed by people_status_check.
    if status == "club_alumni":
        try:
            probe = sb.insert("people", [{
                "full_name": "__club_status_probe__",
                "status": "club_alumni",
                "source": ["probe"],
            }])
            sb.delete("people", {"id": f"eq.{probe[0]['id']}"})
        except SystemExit:
            print("NOTE: club_alumni status not allowed yet; using candidate + club_only.")
            status = "candidate"

    duke_map = duke_school_map()
    sports_by_domain = {}
    for c in sb.select_all("sports_companies", {"select": "name,domain,org_category"}):
        if c.get("domain"):
            sports_by_domain[c["domain"].lower()] = c

    existing = sb.select_all(
        "people", {"select": "id,full_name,linkedin_url,status,source"})
    by_li = {canon_linkedin(r["linkedin_url"]): r for r in existing if r.get("linkedin_url")}
    by_name = {}
    for r in existing:
        by_name.setdefault((r["full_name"] or "").lower(), r)

    profs = cd.enrich_people([u.strip() for u in args.urls], realtime=False)
    print(f"enriched {len(profs)} of {len(args.urls)} URLs\n")

    for prof in profs:
        name = prof.get("name") or "?"
        li = canon_linkedin(prof.get("linkedin_flagship_url") or prof.get("linkedin_profile_url"))

        if not duke_ok(prof, duke_map):
            print(f"  SKIP {name}: no Duke education entry in the include-list")
            continue

        primary = pick_primary_employer(prof.get("current_employers"), prof.get("headline"))
        company = (primary.get("employer_name") or primary.get("company_name") or "").strip() or None
        title = (primary.get("employee_title") or primary.get("title") or "").strip() or None
        domain = primary.get("employer_company_website_domain") or primary.get("company_website_domain")
        if isinstance(domain, (list, tuple)):
            domain = domain[0] if domain else None
        org = resolve_org(domain, sports_by_domain, args.org)
        fns = classify_functions(title, prof.get("headline"), company, org)

        row = by_li.get(li) or by_name.get(name.lower())
        action = "PROMOTE" if row else "INSERT"
        print(f"  {action} {name}")
        print(f"    role : {title} @ {company}  (domain {domain})")
        if club_mode:
            print(f"    club : {args.club}  (status target {status})")
        else:
            print(f"    org  : {org or '!! UNRESOLVED — pass --org'}   functions: {fns}")
        if row:
            print(f"    from : status={row['status']} id={row['id']}")

        # Sports path still requires org_category. Club path does not.
        if not club_mode and org is None:
            print("    -> refusing to write without an org_category; pass --org")
            continue
        if args.dry_run:
            if club_mode:
                write_club_affiliation(
                    row["id"] if row else "new", args.club, li, name,
                    row["status"] if row else status, dry_run=True)
            continue

        # Existing verified sports alumni: keep verified; only tag club.
        write_status = status
        if row and row["status"] == "verified":
            write_status = "verified"
        elif row and club_mode and row["status"] in ("review", "candidate", "club_alumni"):
            write_status = row["status"] if row["status"] == "club_alumni" else status
        elif row and club_mode and row["status"] == "rejected":
            # Do not auto-promote rejected → verified; use club-only status.
            write_status = status

        patch = {
            "full_name": name,
            "linkedin_url": li,
            "current_company": company,
            "current_title": title,
            "seniority_level": prof.get("seniority_level"),
            "status": write_status,
            "confidence": 1.0,
            "headshot_url": prof.get("profile_picture_permalink") or prof.get("profile_picture_url"),
            "last_enriched": "now()",
        }
        if org:
            patch["org_category"] = org
            patch["sports_functions"] = fns
        parts = [prof.get("location"), prof.get("region")]
        loc = next((p for p in parts if p), None)
        if loc:
            seg = [s.strip() for s in loc.split(",")]
            patch["location_city"] = seg[0] if seg else None
            if len(seg) >= 3:
                patch["location_state"], patch["location_country"] = normalize_state(seg[-2]), seg[-1]

        if row:
            pid = row["id"]
            src = list({*(row.get("source") or []), "manual_recovered"})
            if club_mode:
                src.append("club_roster")
                if write_status == "candidate":
                    src.append("club_only")
            sb.update("people", {"id": f"eq.{pid}"}, {**patch, "source": src})
        else:
            src = ["club_roster"] if club_mode else ["manual_curated"]
            if club_mode and write_status == "candidate":
                src.append("club_only")
            patch["source"] = src
            pid = sb.insert("people", [patch])[0]["id"]

        degs = degrees_from(prof, duke_map)
        for d in degs:
            d["person_id"] = pid
        if degs:
            sb.insert("duke_degrees", degs,
                      on_conflict="person_id,school,degree,grad_year",
                      upsert=True, return_rows=False)

        roles, _ = roles_for(prof, pid)
        sb.delete("work_history", {"person_id": f"eq.{pid}"})
        if roles:
            sb.insert("work_history", roles, return_rows=False)

        print(f"    written: {len(degs)} degrees, {len(roles)} roles")

        if club_mode:
            write_club_affiliation(pid, args.club, li, name, write_status, dry_run=False)

    if args.dry_run:
        print("\nDRY RUN — nothing written.")


if __name__ == "__main__":
    main()
