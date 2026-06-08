#!/usr/bin/env python3
"""
Import alumni records into alumni.json from a CSV or JSON file.

Usage:
    python scripts/import_alumni.py --input new_records.csv
    python scripts/import_alumni.py --input single_record.json
    python scripts/import_alumni.py --input records.json --dry-run

CSV format: one row per person, headers match field names (see FIELDS below).
JSON format: either a single dict or a list of dicts.
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

VALID_COMPANY_TYPES = {
    "Startup", "League", "Team", "Big Tech", "Consulting", "VC/PE", "Media", "Agency",
    "University", "Non-Profit", "Brand", "Sports Betting", "Other",
}
VALID_SENIORITY = {
    "Entry", "Mid", "Senior", "VP/Director", "C-Suite/Exec"
}
VALID_SCHOOLS = {
    "Trinity", "Pratt", "Fuqua", "Law", "Medicine", "Nicholas", "Sanford", "Other"
}
VALID_SUB_INDUSTRIES = {
    "Fan Data/CDP", "Ticketing", "Sponsorship & Partnerships",
    "Sports Gambling/Betting", "Media & Broadcasting", "Sports Analytics",
    "Fan Experience & Engagement", "Venue & Event Tech", "Athlete Tech",
    "Sports at Big Tech", "League/Team Front Office", "VC/PE/Investment in Sports",
    "Sports Consulting", "Esports & Gaming", "Sports Data Infrastructure",
    "Collegiate/Amateur Sports", "Fitness & Wellness Tech",
}

REQUIRED_FIELDS = {"name", "grad_year", "current_company", "current_title"}


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def validate_and_normalize(raw: dict) -> dict:
    errors = []

    for field in REQUIRED_FIELDS:
        if not raw.get(field):
            errors.append(f"Missing required field: {field}")

    # Normalize grad_year
    try:
        raw["grad_year"] = int(raw["grad_year"])
    except (ValueError, KeyError):
        errors.append("grad_year must be an integer")

    # Normalize school
    school = raw.get("school", "Other")
    if school not in VALID_SCHOOLS:
        raw["school"] = "Other"

    # Normalize company_type
    ct = raw.get("company_type", "Startup")
    if ct not in VALID_COMPANY_TYPES:
        errors.append(f"Invalid company_type '{ct}'. Valid: {sorted(VALID_COMPANY_TYPES)}")

    # Normalize seniority_level
    sl = raw.get("seniority_level", "Mid")
    if sl not in VALID_SENIORITY:
        errors.append(f"Invalid seniority_level '{sl}'. Valid: {sorted(VALID_SENIORITY)}")

    # Normalize sub_industries (CSV: comma-separated string; JSON: list or string)
    si_raw = raw.get("sub_industries", "")
    if isinstance(si_raw, str):
        si_list = [s.strip() for s in si_raw.split(",") if s.strip()]
    elif isinstance(si_raw, list):
        si_list = si_raw
    else:
        si_list = []

    invalid_si = [s for s in si_list if s not in VALID_SUB_INDUSTRIES]
    if invalid_si:
        errors.append(f"Unknown sub_industries: {invalid_si}")
    raw["sub_industries"] = si_list[:3]  # cap at 3

    # Nullable fields
    for nullable in ("sports_league_affiliation", "headshot_url"):
        if not raw.get(nullable):
            raw[nullable] = None

    if errors:
        raise ValueError("\n  ".join(errors))

    # Auto-generate id if missing
    if not raw.get("id"):
        raw["id"] = f"{slugify(raw['name'])}-{raw['grad_year']}"

    # Auto-set dates
    today = date.today().isoformat()
    if not raw.get("added_date"):
        raw["added_date"] = today
    raw["last_verified"] = today

    return raw


def load_input(path: Path) -> list[dict]:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        with open(path, newline="", encoding="utf-8") as f:
            return list(csv.DictReader(f))
    elif suffix == ".json":
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else [data]
    else:
        sys.exit(f"Unsupported file type: {suffix}. Use .csv or .json")


def main():
    parser = argparse.ArgumentParser(description="Import alumni records into alumni.json")
    parser.add_argument("--input", required=True, help="Path to CSV or JSON input file")
    parser.add_argument("--dry-run", action="store_true", help="Validate only, don't write")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        sys.exit(f"File not found: {input_path}")

    # Load existing data
    with open(DATA_FILE, encoding="utf-8") as f:
        existing = json.load(f)

    existing_records: list[dict] = existing["alumni"]
    existing_ids = {r["id"] for r in existing_records}

    # Load and validate incoming records
    raw_records = load_input(input_path)
    validated, skipped, failed = [], [], []

    for i, raw in enumerate(raw_records):
        try:
            record = validate_and_normalize(dict(raw))
            if record["id"] in existing_ids:
                skipped.append(record["id"])
            else:
                validated.append(record)
        except ValueError as e:
            failed.append((i + 1, str(e)))

    # Report
    print(f"\nInput: {len(raw_records)} records")
    print(f"  ✓ To add:     {len(validated)}")
    print(f"  ~ Duplicates: {len(skipped)}")
    print(f"  ✗ Errors:     {len(failed)}")

    for row_num, err in failed:
        print(f"\n  Row {row_num} failed:\n  {err}")

    if args.dry_run:
        print("\nDry run — no changes written.")
        return

    if not validated:
        print("\nNothing to add.")
        return

    # Merge and write
    merged = existing_records + validated
    output = {
        "alumni": merged,
        "meta": {
            "last_updated": date.today().isoformat(),
            "total_count": len(merged),
        },
    }
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\nWrote {len(merged)} total records to {DATA_FILE}")
    print("Next: run 'npm run build' and redeploy.")


if __name__ == "__main__":
    main()
