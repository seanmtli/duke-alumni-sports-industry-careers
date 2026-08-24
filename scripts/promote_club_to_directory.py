#!/usr/bin/env python3
"""
Promote club-discovered alumni into the main sports directory when they clear
the directory bar — and merge club-only duplicates onto existing verified rows.

Rules (agreed):
  - Promote when current employer is sports_native in sports_companies,
    EXCEPT collegiate / Duke Athletics (leave those club-only).
  - Also promote Big Tech / non-native rows when title or headline has an
    explicit sports signal (e.g. AWS "Media, Entertainment, Games, and Sports").
  - Never invent a second directory profile: if a verified row already exists
    for the same person (vanity LinkedIn vs URN, Blade Clark vs Blade Clarke),
    merge the club affiliation onto the verified row and archive the duplicate.

Usage:
    python scripts/promote_club_to_directory.py --dry-run
    python scripts/promote_club_to_directory.py
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import supabase_client as sb
import sports_domains
from classify import classify_functions
from employer import pick_primary_employer

REPO = Path(__file__).parent.parent
JSON_PATH = REPO / "src/data/person_clubs.json"

# Known club-candidate → verified merges (name / LinkedIn drift).
# candidate_id is resolved at runtime by crustdata_person_id or linkedin URN.
MANUAL_MERGES = [
    # Blade Clarke (candidate URN) → Blade Clark (verified vanity)
    {
        "verified_linkedin_slug": "bladecclarke",
        "candidate_crustdata_person_id": "122308119",
        "note": "Blade Clark / Blade Clarke LinkedIn vanity vs URN",
    },
    # Bryan E. (candidate, primary employer mis-picked as DSBC) → Bryan Edwards
    {
        "verified_linkedin_slug": "bryanedwards125",
        "candidate_crustdata_person_id": "124997888",
        "note": "Bryan Edwards / Bryan E. — NFL Flag Football; DSBC advisor is secondary",
    },
]

SPORTS_TITLE = re.compile(
    r"\b(sports?|athletics?|football|basketball|soccer|baseball|hockey|nfl|nba|"
    r"mlb|nhl|mls|athlete|ticket|stadium|league|scouting|coach|espn|"
    r"media,? entertainment,? games,? and sports|"
    r"games,? and sports|entertainment,? games)\b",
    re.I,
)

EXCLUDE_ORG = {"collegiate"}  # Duke Athletics and other collegiate → club-only


def canon_linkedin(u):
    if not u:
        return None
    u = u.strip().split("?")[0].rstrip("/")
    u = re.sub(r"^http://", "https://", u)
    m = re.match(r"(https?://[^/]+)(/.*)?$", u)
    if m:
        return m.group(1).lower() + (m.group(2) or "")
    return u or None


def linkedin_slug(u):
    u = canon_linkedin(u) or ""
    m = re.search(r"/in/([^/]+)/?$", u, re.I)
    return (m.group(1).lower() if m else "") or ""


def load_json_affils():
    if not JSON_PATH.exists():
        return []
    return json.loads(JSON_PATH.read_text()).get("affiliations") or []


def save_json_affils(affils):
    JSON_PATH.write_text(json.dumps({
        "affiliations": affils,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "note": "Updated by promote_club_to_directory.py / discover_clubs.py",
    }, indent=2) + "\n")


def repoint_affils(affils, from_id, to_id, to_status="verified"):
    out = []
    seen = set()
    for a in affils:
        pid = a.get("person_id")
        if pid == from_id:
            pid = to_id
            a = {**a, "person_id": to_id, "directory_status": to_status}
        key = (a.get("person_id"), a.get("club_slug"))
        if key in seen:
            continue
        seen.add(key)
        out.append(a)
    return out


def ensure_mavericks(dry_run):
    rows = sb.select_all("sports_companies", {"select": "id,name,domain"})
    if any((r.get("domain") or "").lower() == "mavs.com" for r in rows):
        print("sports_companies: Dallas Mavericks already present")
        return None
    row = {
        "name": "Dallas Mavericks",
        "domain": "mavs.com",
        "aliases": ["Mavericks", "DAL Mavericks"],
        "org_category": "teams_clubs",
        "is_sports_native": True,
    }
    print(f"sports_companies: ADD {row['name']} ({row['domain']})")
    if not dry_run:
        sb.insert("sports_companies", [row], return_rows=False)
    return row


def load_companies(extra=None):
    companies = sb.select_all(
        "sports_companies",
        {"select": "name,domain,aliases,org_category,is_sports_native"},
    )
    if extra:
        companies = list(companies) + [extra]
    return companies, sports_domains.build_index(companies)


def resolve_employer(person, domains, companies=None):
    raw = person.get("raw_payload") or {}
    headline = person.get("headline") or raw.get("headline")
    cur = pick_primary_employer(raw.get("current_employers"), headline)
    # Prefer the sports-native concurrent role when the primary picker latched
    # onto a club advisor / student-org post (Bryan E. case).
    emps = list(raw.get("current_employers") or [])
    best = cur
    best_comp = None
    for e in ([cur] + emps) if cur else emps:
        if not e:
            continue
        dom = e.get("company_website_domain") or e.get("employer_company_website_domain") or ""
        if isinstance(dom, (list, tuple)):
            dom = dom[0] if dom else ""
        comp = sports_domains.resolve(dom, domains)
        if comp and comp.get("is_sports_native") and comp.get("org_category") not in EXCLUDE_ORG:
            best, best_comp = e, comp
            break
        if comp and best_comp is None:
            best, best_comp = e, comp
    if best_comp is None and best:
        dom = best.get("company_website_domain") or best.get("employer_company_website_domain") or ""
        if isinstance(dom, (list, tuple)):
            dom = dom[0] if dom else ""
        best_comp = sports_domains.resolve(dom, domains)
    # Name fallback against stored current_company
    if best_comp is None:
        co = (person.get("current_company") or "").strip().lower()
        pool = companies or []
        for c in pool:
            names = [c["name"]] + list(c.get("aliases") or [])
            if any(n and n.lower() == co for n in names):
                best_comp = c
                break
    title = (
        (best or {}).get("title")
        or (best or {}).get("employee_title")
        or person.get("current_title")
    )
    company = (
        (best_comp or {}).get("name")
        or (best or {}).get("company_name")
        or (best or {}).get("name")
        or person.get("current_company")
    )
    return best_comp, company, title, headline


def should_promote(comp, title, headline):
    """Return (promote: bool, reason: str)."""
    if comp and comp.get("is_sports_native"):
        if comp.get("org_category") in EXCLUDE_ORG:
            return False, f"exclude_collegiate:{comp.get('name')}"
        return True, f"sports_native:{comp.get('name')}"
    # Big Tech / non-native with explicit sports signal in title/headline
    blob = f"{title or ''} {headline or ''}"
    if comp and SPORTS_TITLE.search(blob):
        return True, f"sports_title_at:{comp.get('name')}"
    if not comp and SPORTS_TITLE.search(blob):
        # e.g. Mavericks before company seed, Wave Sports — flag but don't auto
        # unless we resolved a company. Name-only sports employers handled via seed.
        return False, "sports_signal_unresolved_employer"
    return False, "no_match"


def merge_duplicate(verified, candidate, note, affils, dry_run, domains=None):
    """Move club tags from candidate → verified; archive candidate as duplicate."""
    print(f"  MERGE {candidate['full_name']} [{candidate['status']}] "
          f"→ {verified['full_name']} [{verified['status']}]")
    print(f"         ({note})")
    if dry_run:
        return affils

    src = list(verified.get("source") or [])
    for tag in (candidate.get("source") or []):
        if tag.startswith("club:") or tag in ("crustdata_clubs", "club_roster"):
            if tag not in src:
                src.append(tag)
    if "merged_club_duplicate" not in src:
        src.append("merged_club_duplicate")

    patch = {"source": src}
    # Refresh role from candidate when they carry a clearer sports-native employer
    if domains is not None:
        comp, company, title, headline = resolve_employer(candidate, domains)
        if comp and comp.get("is_sports_native") and comp.get("org_category") not in EXCLUDE_ORG:
            patch["current_company"] = company
            patch["current_title"] = title
            patch["org_category"] = comp["org_category"]
            patch["sports_functions"] = classify_functions(
                title, headline, company, comp["org_category"])
            if candidate.get("crustdata_person_id") and not verified.get("crustdata_person_id"):
                # Free the unique crustdata_person_id on the duplicate first
                sb.update("people", {"id": f"eq.{candidate['id']}"}, {
                    "crustdata_person_id": None,
                })
                patch["crustdata_person_id"] = str(candidate["crustdata_person_id"])
            print(f"         refreshed role: {title} @ {company}")

    sb.update("people", {"id": f"eq.{verified['id']}"}, patch)

    cand_src = list(candidate.get("source") or [])
    if "duplicate" not in cand_src:
        cand_src.append("duplicate")
    sb.update("people", {"id": f"eq.{candidate['id']}"}, {
        "status": "archived",
        "source": cand_src,
        "notes": f"Duplicate of verified {verified['id']} ({verified['full_name']}). {note}",
    })

    return repoint_affils(affils, candidate["id"], verified["id"], "verified")


def promote_person(person, comp, company, title, headline, affils, dry_run):
    org = comp["org_category"] if comp else None
    fns = classify_functions(title, headline, company, org)
    print(f"  PROMOTE {person['full_name']} → verified")
    print(f"           {title} @ {company}  org={org}  fns={fns}")
    if dry_run:
        return affils

    src = list(person.get("source") or [])
    src = [s for s in src if s != "club_only"]
    if "promoted_from_club" not in src:
        src.append("promoted_from_club")

    patch = {
        "status": "verified",
        "current_company": company,
        "current_title": title,
        "org_category": org,
        "sports_functions": fns,
        "confidence": 0.9,
        "source": src,
        "last_verified": datetime.now(timezone.utc).date().isoformat(),
    }
    sb.update("people", {"id": f"eq.{person['id']}"}, patch)

    # Update JSON affiliation statuses
    out = []
    for a in affils:
        if a.get("person_id") == person["id"]:
            a = {**a, "directory_status": "verified"}
        out.append(a)
    return out


def run_merges(by_slug, by_cd, affils, dry_run, domains):
    for spec in MANUAL_MERGES:
        verified = by_slug.get(spec["verified_linkedin_slug"])
        candidate = by_cd.get(str(spec["candidate_crustdata_person_id"]))
        if not verified:
            print(f"  ! verified not found for slug={spec['verified_linkedin_slug']}")
            continue
        if not candidate:
            print(f"  ! candidate not found for cd_id={spec['candidate_crustdata_person_id']} "
                  f"(already merged?)")
            continue
        if candidate["id"] == verified["id"]:
            continue
        if candidate["status"] == "verified":
            continue
        affils = merge_duplicate(
            verified, candidate, spec["note"], affils, dry_run, domains=domains)
    return affils


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    mavs = ensure_mavericks(args.dry_run)
    companies, domains = load_companies(extra=mavs)

    people = sb.select_all("people", {
        "select": (
            "id,full_name,status,linkedin_url,crustdata_person_id,current_company,"
            "current_title,headline,org_category,source,raw_payload"
        ),
    })
    by_slug = {}
    by_cd = {}
    for p in people:
        slug = linkedin_slug(p.get("linkedin_url"))
        if slug and not slug.lower().startswith("acoa"):  # vanity preferred
            by_slug.setdefault(slug, p)
        # Also index URN slugs so we can find them
        if slug:
            by_slug.setdefault(slug, p)
        if p.get("crustdata_person_id"):
            by_cd[str(p["crustdata_person_id"])] = p

    affils = load_json_affils()
    club_person_ids = {a["person_id"] for a in affils}

    print("\n=== Merge known duplicates ===")
    affils = run_merges(by_slug, by_cd, affils, args.dry_run, domains)

    # Refresh after merges
    people = sb.select_all("people", {
        "select": (
            "id,full_name,status,linkedin_url,crustdata_person_id,current_company,"
            "current_title,headline,org_category,source,raw_payload"
        ),
    })
    by_id = {p["id"]: p for p in people}

    print("\n=== Promote club alumni who clear the sports directory bar ===")
    promoted, skipped = [], []
    for pid in sorted(club_person_ids):
        p = by_id.get(pid)
        if not p:
            continue
        if p["status"] == "verified":
            continue
        if p["status"] == "archived":
            skipped.append((p["full_name"], "archived"))
            continue

        # Only consider club_only / club-sourced candidates
        src = p.get("source") or []
        if not any(s.startswith("club:") or s in ("crustdata_clubs", "club_roster", "club_only")
                   for s in src):
            continue

        comp, company, title, headline = resolve_employer(p, domains, companies=companies)
        ok, reason = should_promote(comp, title, headline)
        if not ok:
            skipped.append((p["full_name"], reason))
            continue
        affils = promote_person(p, comp, company, title, headline, affils, args.dry_run)
        promoted.append((p["full_name"], reason))

    print(f"\nPromoted: {len(promoted)}")
    for name, reason in promoted:
        print(f"  + {name} ({reason})")
    print(f"Skipped: {len(skipped)}")
    # Show interesting skips
    for name, reason in skipped:
        if reason.startswith("exclude_collegiate") or reason.startswith("sports_signal"):
            print(f"  · {name} ({reason})")

    if args.dry_run:
        print("\nDRY RUN — nothing written.")
        return

    save_json_affils(affils)
    print(f"\nWrote affiliations → {JSON_PATH}")


if __name__ == "__main__":
    main()
