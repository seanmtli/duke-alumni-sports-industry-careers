#!/usr/bin/env python3
"""
Migrate the verified alumni (src/data/alumni.json) + the JSON-backed submissions and
contact-requests into the Supabase schema via the REST client (scripts/supabase_client.py).

Idempotent: people upsert on linkedin_url; degrees are (re)inserted only for people that
have no degree rows yet, so re-running won't duplicate.

Usage:
    python scripts/migrate_to_supabase.py            # apply
    python scripts/migrate_to_supabase.py --dry-run  # print counts only
"""
import argparse
import json
import re
from pathlib import Path

import supabase_client as sb

REPO = Path(__file__).parent.parent
ALUMNI = REPO / "src" / "data" / "alumni.json"
SUBMISSIONS = REPO / "src" / "data" / "submissions.json"
CONTACTS = REPO / "src" / "data" / "contact-requests.json"

ORG_MAP = {
    "League": "leagues_governing", "Team": "teams_clubs", "Big Tech": "big_tech_vertical",
    "Consulting": "investing_advisory", "VC/PE": "investing_advisory", "Media": "media_broadcast",
    "Agency": "agencies_rep", "University": "collegiate", "Non-Profit": "nonprofit_other",
    "Brand": "brands_sponsors", "Sports Betting": "betting_gaming", "Startup": "sports_tech_data",
    "Other": "nonprofit_other",
}

US_STATES = {
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA",
    "ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK",
    "OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
}


def canon_linkedin(u):
    if not u:
        return None
    u = u.strip().split("?")[0].rstrip("/")
    u = re.sub(r"^http://", "https://", u)
    if u.startswith("www."):
        u = "https://" + u
    if not u.startswith("https://"):
        u = "https://" + u
    return u.lower()


def split_location(loc):
    if not loc:
        return None, None, None
    if ", " in loc:
        city, tail = loc.rsplit(", ", 1)
        if tail in US_STATES:
            return city, tail, "United States"
        return city, tail, None
    return loc, None, None


def build_person(r):
    li = canon_linkedin(r.get("linkedin_url"))
    city, state, country = split_location(r.get("location"))
    return {
        "linkedin_url": li,
        "full_name": r.get("name"),
        "headshot_url": r.get("headshot_url") or None,
        "current_company": r.get("current_company") or None,
        "current_title": r.get("current_title") or None,
        "org_category": ORG_MAP.get(r.get("company_type"), "nonprofit_other"),
        "seniority_level": r.get("seniority_level") or "Mid",
        "sports_league_affiliation": r.get("sports_league_affiliation") or None,
        "location_city": city, "location_state": state, "location_country": country,
        "bio": r.get("bio") or None,
        "reach_out_for": r.get("reach_out_for") or [],
        "status": "verified",
        "confidence": 1.0,
        "source": ["seed_verified", f"slug:{r['id']}"],
        "added_date": r.get("added_date") or None,
        "last_verified": r.get("last_verified") or None,
    }


def slug_of(person_row):
    for s in person_row.get("source") or []:
        if s.startswith("slug:"):
            return s[5:]
    return None


def migrate_people(records, dry):
    people = [build_person(r) for r in records]
    print(f"alumni records: {len(records)}")
    if dry:
        return
    # upsert people (dedupe on linkedin_url). null-linkedin rows just insert.
    with_li = [p for p in people if p["linkedin_url"]]
    no_li = [p for p in people if not p["linkedin_url"]]
    inserted = sb.insert("people", with_li, on_conflict="linkedin_url", upsert=True)
    inserted += sb.insert("people", no_li)  # no conflict target
    print(f"people upserted: {len(inserted)}")

    # map slug -> id from the returned rows, then add degrees for people lacking them
    slug_to_id = {slug_of(p): p["id"] for p in inserted if slug_of(p)}
    existing_deg = {d["person_id"] for d in sb.select("duke_degrees", {"select": "person_id"})}
    degrees = []
    for r in records:
        pid = slug_to_id.get(r["id"])
        if not pid or pid in existing_deg:
            continue
        degrees.append({
            "person_id": pid,
            "school": r.get("school") or "Other",
            "degree": r.get("degree") or None,
            "grad_year": int(r["grad_year"]) if r.get("grad_year") else None,
            "major": r.get("major") or None,
        })
    if degrees:
        sb.insert("duke_degrees", degrees, return_rows=False)
    print(f"degrees inserted: {len(degrees)}")


def migrate_submissions(dry):
    if not SUBMISSIONS.exists():
        return
    data = json.load(open(SUBMISSIONS))
    rows = data if isinstance(data, list) else data.get("submissions", [])
    print(f"submissions: {len(rows)}")
    if dry or not rows:
        return
    out = [{
        "submitted_at": s.get("submitted_at"), "name": s.get("name"),
        "grad_year": s.get("grad_year"), "school": s.get("school"), "degree": s.get("degree"),
        "major": s.get("major"), "current_company": s.get("current_company"),
        "current_title": s.get("current_title"), "company_type": s.get("company_type"),
        "seniority_level": s.get("seniority_level"), "linkedin_url": s.get("linkedin_url"),
        "location": s.get("location"), "bio": s.get("bio"),
        "reach_out_for": s.get("reach_out_for") or [], "raw": s,
    } for s in rows]
    sb.insert("submissions", out, return_rows=False)
    print(f"submissions migrated: {len(out)}")


def migrate_contacts(dry):
    if not CONTACTS.exists():
        return
    data = json.load(open(CONTACTS))
    rows = data if isinstance(data, list) else data.get("contact_requests", data.get("requests", []))
    print(f"contact_requests: {len(rows)}")
    if dry or not rows:
        return
    out = [{
        "submitted_at": c.get("submitted_at"), "name": c.get("name"), "email": c.get("email"),
        "type": c.get("type"), "linkedin_url": c.get("linkedin_url"), "message": c.get("message"),
    } for c in rows]
    sb.insert("contact_requests", out, return_rows=False)
    print(f"contacts migrated: {len(out)}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    records = json.load(open(ALUMNI))["alumni"]
    migrate_people(records, args.dry_run)
    migrate_submissions(args.dry_run)
    migrate_contacts(args.dry_run)
    print("done." if not args.dry_run else "dry run — nothing written.")


if __name__ == "__main__":
    main()
