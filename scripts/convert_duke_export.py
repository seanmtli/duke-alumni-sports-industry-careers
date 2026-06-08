#!/usr/bin/env python3
"""
Convert a Duke Alumni Directory CSV export into alumni.json format.

The Duke export has sparse data — no current title/company. This script
parses what it can (name, grad year, school, degree, location) and sets
placeholder values for the rest. Records are flagged for Crustdata enrichment.

Usage:
    python scripts/convert_duke_export.py --input duke_sports_alumni.csv
    python scripts/convert_duke_export.py --input duke_sports_alumni.csv --dry-run
"""

import argparse
import csv
import json
import re
import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
DATA_FILE = REPO_ROOT / "src" / "data" / "alumni.json"

# --- Parsing helpers ---

def clean_name(raw: str) -> str:
    """Remove degree suffixes and graduation year suffixes from name.
    'Tamara Curl-Green, '08' → 'Tamara Curl-Green'
    'Bobby Sharma, '95, J.D.'98' → 'Bobby Sharma'
    'Erin Sierer (Mullin), D.P.T.'07' → 'Erin Sierer (Mullin)'
    """
    # Remove trailing ", '##" patterns (grad year suffixes)
    name = re.sub(r",?\s*'?\d{2,4}(?:,\s*'?\d{2,4})*\s*$", "", raw)
    # Remove degree abbreviations like ", J.D." ", M.B.A." ", D.P.T."
    name = re.sub(r",?\s+[A-Z][A-Z.]+\.?\s*$", "", name)
    return name.strip().strip(",").strip()


def parse_grad_year(raw: str) -> int | None:
    """Take the most recent year from '1998, 1995' → 1998."""
    years = re.findall(r"\b(?:19|20)\d{2}\b", raw)
    if not years:
        return None
    return max(int(y) for y in years)


SCHOOL_MAP = {
    "trinity college": "Trinity",
    "trinity": "Trinity",
    "pratt school of engineering": "Pratt",
    "pratt": "Pratt",
    "fuqua school of business": "Fuqua",
    "fuqua": "Fuqua",
    "school of law": "Law",
    "law school": "Law",
    "school of medicine": "Medicine",
    "medicine": "Medicine",
    "nicholas school": "Nicholas",
    "nicholas": "Nicholas",
    "sanford school": "Sanford",
    "sanford": "Sanford",
}

DEGREE_MAP = {
    "bachelor of arts": "AB",
    "bachelor of science": "BS",
    "bachelor of science in engineering": "BSE",
    "master of business admin": "MBA",
    "master of business administration": "MBA",
    "master of arts": "MA",
    "master of science": "MS",
    "master of public policy": "MPP",
    "master of environmental management": "MEM",
    "juris doctor": "JD",
    "doctor of philosophy": "PhD",
    "doctor of physical therapy": "DPT",
    "doctor of medicine": "MD",
    "doctor of jurisprudence": "JD",
}


def parse_degree_school(raw: str) -> tuple[str, str]:
    """Parse 'Bachelor of Arts, Trinity College, 2008' → ('AB', 'Trinity')."""
    raw_lower = raw.lower()

    school = "Other"
    for key, val in SCHOOL_MAP.items():
        if key in raw_lower:
            school = val
            break

    degree = ""
    for key, val in DEGREE_MAP.items():
        if key in raw_lower:
            degree = val
            break

    return degree, school


INDUSTRY_TO_SUB = {
    "broadcast media": "Media & Broadcasting",
    "broadcasting": "Media & Broadcasting",
    "media": "Media & Broadcasting",
    "sports analytics": "Sports Analytics",
    "analytics": "Sports Analytics",
    "gambling": "Sports Gambling/Betting",
    "betting": "Sports Gambling/Betting",
    "ticketing": "Ticketing",
    "esports": "Esports & Gaming",
    "gaming": "Esports & Gaming",
    "sponsorship": "Sponsorship & Partnerships",
    "venue": "Venue & Event Tech",
    "stadium": "Venue & Event Tech",
    "athlete": "Athlete Tech",
    "fitness": "Fitness & Wellness Tech",
    "wellness": "Fitness & Wellness Tech",
    "data": "Sports Data Infrastructure",
    "technology": "Sports Data Infrastructure",
    "collegiate": "Collegiate/Amateur Sports",
    "ncaa": "Collegiate/Amateur Sports",
    "venture": "VC/PE/Investment in Sports",
    "private equity": "VC/PE/Investment in Sports",
    "investment": "VC/PE/Investment in Sports",
    "consulting": "Sports Consulting",
    "fan experience": "Fan Experience & Engagement",
    "engagement": "Fan Experience & Engagement",
}


def parse_sub_industries(raw: str) -> list[str]:
    """Map 'Sports, Broadcast Media, Entertainment' to sub-industry tags."""
    if not raw:
        return []
    parts = [p.strip().lower() for p in raw.split(",")]
    result = []
    for part in parts:
        for keyword, sub in INDUSTRY_TO_SUB.items():
            if keyword in part and sub not in result:
                result.append(sub)
    return result[:3]  # cap at 3


def normalize_location(raw: str) -> str:
    """'Los angeles, CA' → 'Los Angeles, CA'"""
    if not raw.strip():
        return ""
    parts = raw.strip().split(",")
    if len(parts) >= 2:
        city = parts[0].strip().title()
        state = parts[1].strip().upper()
        return f"{city}, {state}"
    return raw.strip().title()


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


# --- Main ---

def main():
    parser = argparse.ArgumentParser(description="Convert Duke alumni CSV export to alumni.json")
    parser.add_argument("--input", required=True, help="Path to Duke alumni CSV export")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--merge", action="store_true",
                        help="Merge into existing alumni.json (skip duplicates by id)")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        sys.exit(f"File not found: {input_path}")

    with open(input_path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    today = date.today().isoformat()
    converted, skipped, failed = [], [], []

    for i, row in enumerate(rows, 1):
        raw_name = row.get("Name", "").strip()
        if not raw_name:
            skipped.append(f"Row {i}: empty name")
            continue

        name = clean_name(raw_name)
        if not name:
            skipped.append(f"Row {i}: could not parse name from '{raw_name}'")
            continue

        grad_year = parse_grad_year(row.get("Grad Year(s)", ""))
        if not grad_year:
            skipped.append(f"Row {i}: no grad year for '{name}'")
            continue

        degree, school = parse_degree_school(row.get("Degree(s)", ""))
        location = normalize_location(row.get("Location", ""))
        linkedin_url = row.get("LinkedIn", "").strip()
        headshot_url = row.get("Profile Picture URL", "").strip() or None
        current_title = row.get("Current Title (LinkedIn)", "").strip()
        current_company = row.get("Current Company (LinkedIn)", "").strip()
        company_type = row.get("Industries", "").strip() or "Other"

        record = {
            "id": f"{slugify(name)}-{grad_year}",
            "name": name,
            "grad_year": grad_year,
            "school": school,
            "degree": degree,
            "major": "",
            "current_company": current_company or "—",
            "current_title": current_title or "—",
            "company_type": company_type,
            "sub_industries": [],
            "seniority_level": "Mid",                    # default; update after enrichment
            "linkedin_url": linkedin_url,
            "location": location,
            "headshot_url": headshot_url,
            "sports_league_affiliation": None,
            "added_date": today,
            "last_verified": today,
            "_needs_enrichment": True,                   # flag for Crustdata pass
        }
        converted.append(record)

    print(f"\nDuke export: {len(rows)} rows")
    print(f"  ✓ Converted: {len(converted)}")
    print(f"  ~ Skipped:   {len(skipped)}")
    if skipped:
        for s in skipped[:10]:
            print(f"    {s}")

    if args.dry_run:
        print("\nDry run — no changes written.")
        print("\nSample output (first 3 records):")
        for r in converted[:3]:
            print(json.dumps(r, indent=2))
        return

    if args.merge:
        # Merge into existing alumni.json, skipping duplicate ids
        with open(DATA_FILE, encoding="utf-8") as f:
            existing = json.load(f)
        existing_ids = {r["id"] for r in existing["alumni"]}
        new_records = [r for r in converted if r["id"] not in existing_ids]
        dups = [r["id"] for r in converted if r["id"] in existing_ids]
        merged = existing["alumni"] + new_records
        print(f"\nMerging: {len(new_records)} new, {len(dups)} duplicates skipped")
    else:
        # Replace alumni.json entirely with converted records
        merged = converted
        print(f"\nReplacing alumni.json with {len(merged)} records")

    output = {
        "alumni": merged,
        "meta": {
            "last_updated": today,
            "total_count": len(merged),
        },
    }

    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Written to {DATA_FILE}")
    print("\nNext steps:")
    print("  1. Run 'npm run build' to verify the build")
    print("  2. Use Crustdata to enrich current_title, current_company, linkedin_url")
    print("  3. Run 'python scripts/import_alumni.py' to update enriched records")


if __name__ == "__main__":
    main()
