#!/usr/bin/env python3
"""
Load scripts/data/sports_companies_seed.json into the sports_companies table.
Idempotent: skips companies whose (lower) name already exists.
crustdata_company_id is resolved separately (MCP-driven) during discovery.

Usage:
    python scripts/build_sports_companies.py
    python scripts/build_sports_companies.py --dry-run
"""
import argparse
import json
from pathlib import Path

import supabase_client as sb

SEED = Path(__file__).parent / "data" / "sports_companies_seed.json"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    companies = json.load(open(SEED))["companies"]
    existing = {c["name"].lower() for c in sb.select("sports_companies", {"select": "name"})}

    new_rows = []
    for c in companies:
        if c["name"].lower() in existing:
            continue
        new_rows.append({
            "name": c["name"],
            "org_category": c["org_category"],
            "is_sports_native": c.get("is_sports_native", True),
            "domain": c.get("domain"),
            "aliases": c.get("aliases", []),
        })

    by_cat = {}
    native = sum(1 for c in companies if c.get("is_sports_native", True))
    for c in companies:
        by_cat[c["org_category"]] = by_cat.get(c["org_category"], 0) + 1

    print(f"seed: {len(companies)} companies ({native} sports-native)")
    for cat, n in sorted(by_cat.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {n}")
    print(f"new to insert: {len(new_rows)} (already present: {len(companies) - len(new_rows)})")

    if args.dry_run or not new_rows:
        return
    sb.insert("sports_companies", new_rows, return_rows=False)
    print(f"inserted {len(new_rows)} companies.")


if __name__ == "__main__":
    main()
