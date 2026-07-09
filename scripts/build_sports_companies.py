#!/usr/bin/env python3
"""
Load scripts/data/sports_companies_seed.json into the sports_companies table.
Idempotent. New companies are inserted; companies that already exist (matched by
lower-cased name) have their aliases MERGED (union) and a missing domain filled
in from the seed. Merging matters because domain-variant aliases — the aliasing
fix, e.g. FanDuel's "fanduel.careers" — get added to companies that were seeded
long ago, and an insert-only loader would silently skip them.

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
    existing = {c["name"].lower(): c
                for c in sb.select_all("sports_companies",
                                       {"select": "id,name,domain,aliases"})}

    new_rows = []
    alias_updates = []  # (row, patch) for already-present companies
    for c in companies:
        cur = existing.get(c["name"].lower())
        if cur is None:
            new_rows.append({
                "name": c["name"],
                "org_category": c["org_category"],
                "is_sports_native": c.get("is_sports_native", True),
                "domain": c.get("domain"),
                "aliases": c.get("aliases", []),
            })
            continue
        # Merge: union aliases, fill a missing domain. Never drop existing data.
        have = list(cur.get("aliases") or [])
        have_l = {a.lower() for a in have}
        merged = have + [a for a in (c.get("aliases") or []) if a.lower() not in have_l]
        patch = {}
        if merged != have:
            patch["aliases"] = merged
        if not cur.get("domain") and c.get("domain"):
            patch["domain"] = c["domain"]
        if patch:
            alias_updates.append((cur, patch))

    by_cat = {}
    native = sum(1 for c in companies if c.get("is_sports_native", True))
    for c in companies:
        by_cat[c["org_category"]] = by_cat.get(c["org_category"], 0) + 1

    print(f"seed: {len(companies)} companies ({native} sports-native)")
    for cat, n in sorted(by_cat.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {n}")
    print(f"new to insert: {len(new_rows)}")
    print(f"existing to update (alias/domain merge): {len(alias_updates)}")
    for row, patch in alias_updates:
        print(f"  ~ {row['name']}: {patch}")

    if args.dry_run:
        return
    if new_rows:
        sb.insert("sports_companies", new_rows, return_rows=False)
        print(f"inserted {len(new_rows)} companies.")
    for row, patch in alias_updates:
        sb.update("sports_companies", {"id": f"eq.{row['id']}"}, patch)
    if alias_updates:
        print(f"updated {len(alias_updates)} existing companies.")


if __name__ == "__main__":
    main()
