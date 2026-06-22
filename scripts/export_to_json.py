#!/usr/bin/env python3
"""
Build-time export: Supabase (status=verified) -> src/data/alumni.json for the site.

Emits the app's current record shape (so the existing frontend works unchanged) AND
includes the new taxonomy fields (org_category, sports_functions) for a future UI.
Records without a grad_year (e.g. discovered-but-not-yet-enriched) are skipped and
counted, so the published file stays valid.

Usage:
    python scripts/export_to_json.py
    python scripts/export_to_json.py --dry-run
"""
import argparse
import json
import re
from datetime import date
from pathlib import Path

import supabase_client as sb

OUT = Path(__file__).parent.parent / "src" / "data" / "alumni.json"

# new org_category -> representative old company_type (for the current UI)
ORG_TO_COMPANY_TYPE = {
    "leagues_governing": "League", "teams_clubs": "Team", "betting_gaming": "Sports Betting",
    "media_broadcast": "Media", "sports_tech_data": "Startup", "big_tech_vertical": "Big Tech",
    "agencies_rep": "Agency", "investing_advisory": "VC/PE", "infra_experiences": "Other",
    "brands_sponsors": "Brand", "collegiate": "University", "nonprofit_other": "Non-Profit",
}
VALID_SCHOOLS = {"Trinity", "Pratt", "Fuqua", "Law", "Medicine", "Nicholas", "Sanford", "Other"}


def slugify(name, year):
    import re
    s = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")
    return f"{s}-{year}" if year else s


def pick_primary_degree(degrees):
    """Earliest grad_year degree is usually the undergrad / most identifying."""
    with_year = [d for d in degrees if d.get("grad_year")]
    if with_year:
        return min(with_year, key=lambda d: d["grad_year"])
    return degrees[0] if degrees else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    people = sb.select_all("people", {"select": "*", "status": "eq.verified"})
    degrees = sb.select_all("duke_degrees", {"select": "*"})
    deg_by_person = {}
    for d in degrees:
        deg_by_person.setdefault(d["person_id"], []).append(d)

    out = []
    for p in people:
        pdeg = deg_by_person.get(p["id"], [])
        primary = pick_primary_degree(pdeg)
        grad_year = primary["grad_year"] if primary else None  # may be null (undated)
        school = (primary.get("school") if primary else None) or "Other"
        degree_str = (primary.get("degree") if primary else "") or ""
        if school not in VALID_SCHOOLS:
            # "General" = matched the parent "Duke University" entity; a bachelor's there
            # is almost always Trinity (undergrad college).
            if school == "General" and re.search(r"\b(BA|BS|AB|Bachelor)", degree_str, re.I):
                school = "Trinity"
            else:
                school = "Other"
        location = ", ".join(filter(None, [p.get("location_city"), p.get("location_state")])) \
            or p.get("location_country") or ""
        out.append({
            "id": p.get("crustdata_person_id") and f"cd-{p['crustdata_person_id']}"
                  or slugify(p.get("full_name"), grad_year),
            "name": p.get("full_name"),
            "grad_year": grad_year,
            "school": school,
            "degree": (primary.get("degree") if primary else "") or "",
            "major": (primary.get("major") if primary else "") or "",
            "current_company": p.get("current_company") or "",
            "current_title": p.get("current_title") or "",
            "company_type": ORG_TO_COMPANY_TYPE.get(p.get("org_category"), "Other"),
            "sub_industries": [],
            "seniority_level": p.get("seniority_level") or "Mid",
            "linkedin_url": p.get("linkedin_url") or "",
            "location": location,
            "headshot_url": p.get("headshot_url"),
            "sports_league_affiliation": p.get("sports_league_affiliation"),
            "added_date": p.get("added_date"),
            "last_verified": p.get("last_verified"),
            # --- new taxonomy (forward-compatible; ignored by current UI) ---
            "org_category": p.get("org_category"),
            "sports_functions": p.get("sports_functions") or [],
            "all_degrees": [{"school": d.get("school"), "degree": d.get("degree"),
                             "grad_year": d.get("grad_year"), "major": d.get("major")}
                            for d in pdeg],
        })

    out.sort(key=lambda r: (r["name"] or "").lower())
    payload = {"alumni": out, "meta": {"last_updated": date.today().isoformat(),
                                       "total_count": len(out)}}
    undated = sum(1 for r in out if r["grad_year"] is None)
    print(f"verified people: {len(people)}  exported: {len(out)}  (undated grad_year: {undated})")
    if args.dry_run:
        return
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
