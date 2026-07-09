#!/usr/bin/env python3
"""
Add (or recover) specific alumni by LinkedIn URL.

Generalizes the one-off add_curated.py into a reusable tool for the recurring
"you're missing so-and-so" email. For each URL it enriches via Crustdata,
confirms a Duke tie, derives the PRIMARY current role with the fixed
pick_primary_employer (so an adjunct professorship never masks the real job),
and writes people + duke_degrees + work_history.

Handles three prior states of the person:
  - absent            -> insert a new verified row
  - status=rejected   -> PROMOTE to verified and correct the role
  - status=review     -> promote to verified

Scott Lewis and Alex Kerr are the motivating case: both were auto-REJECTED
during discovery because current_employers[0] was a university adjunct post, so
the domain looked non-sports. Their real employers (NYCFC, Trajektory) aren't in
sports_companies, so org_category won't auto-resolve — pass --org.

Usage:
    python scripts/add_by_linkedin.py --org teams_clubs \
        https://www.linkedin.com/in/scott-lewis-1a55b02
    python scripts/add_by_linkedin.py --org sports_tech_data \
        https://www.linkedin.com/in/alexckerr
    python scripts/add_by_linkedin.py --dry-run https://www.linkedin.com/in/...
"""
import argparse

import supabase_client as sb
import crustdata_client as cd
from classify import classify_functions
from employer import pick_primary_employer
from enrich import duke_school_map, degrees_from
from backfill_work_history import roles_for
from add_curated import canon_linkedin
from us_states import normalize_state


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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("urls", nargs="+")
    ap.add_argument("--org", help="org_category override (needed when the employer "
                    "isn't in sports_companies)")
    ap.add_argument("--status", default="verified", choices=["verified", "review"])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    duke_map = duke_school_map()
    sports_by_domain = {}
    for c in sb.select_all("sports_companies", {"select": "name,domain,org_category"}):
        if c.get("domain"):
            sports_by_domain[c["domain"].lower()] = c

    existing = sb.select_all("people", {"select": "id,full_name,linkedin_url,status"})
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
        print(f"    org  : {org or '!! UNRESOLVED — pass --org'}   functions: {fns}")
        if row:
            print(f"    from : status={row['status']} id={row['id']}")
        if org is None:
            print("    -> refusing to write without an org_category; pass --org")
            continue
        if args.dry_run:
            continue

        patch = {
            "full_name": name,
            "linkedin_url": li,
            "current_company": company,
            "current_title": title,
            "org_category": org,
            "sports_functions": fns,
            "seniority_level": prof.get("seniority_level"),
            "status": args.status,
            "confidence": 1.0,
            "headshot_url": prof.get("profile_picture_permalink") or prof.get("profile_picture_url"),
            "last_enriched": "now()",
        }
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
            sb.update("people", {"id": f"eq.{pid}"}, {**patch, "source": src})
        else:
            patch["source"] = ["manual_curated"]
            pid = sb.insert("people", [patch])[0]["id"]

        # Degrees: upsert against the dedupe index.
        degs = degrees_from(prof, duke_map)
        for d in degs:
            d["person_id"] = pid
        if degs:
            sb.insert("duke_degrees", degs,
                      on_conflict="person_id,school,degree,grad_year",
                      upsert=True, return_rows=False)

        # Work history: replace wholesale (fully derived, no admin surface).
        roles, _ = roles_for(prof, pid)
        sb.delete("work_history", {"person_id": f"eq.{pid}"})
        if roles:
            sb.insert("work_history", roles, return_rows=False)

        print(f"    written: {len(degs)} degrees, {len(roles)} roles")

    if args.dry_run:
        print("\nDRY RUN — nothing written.")


if __name__ == "__main__":
    main()
