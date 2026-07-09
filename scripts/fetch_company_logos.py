#!/usr/bin/env python3
"""
Backfill sports_companies.logo_url for the top employers (by current-employee
count, same metric as the stats page's "Top Companies") via Crustdata's
company enrich endpoint. Feeds the employer-logo stats row + home page belt.

Rerunnable: always re-fetches the current top N, only writes companies missing
a logo_url (or all, with --refresh).

Usage:
    python scripts/fetch_company_logos.py --test            # top 3, print only
    python scripts/fetch_company_logos.py --dry-run          # preview writes
    python scripts/fetch_company_logos.py                    # top 15, write
    python scripts/fetch_company_logos.py --top 20 --refresh # widen + overwrite
"""
import argparse
from collections import Counter

import supabase_client as sb
import crustdata_client as cd


def top_companies(n):
    people = sb.select_all("people", {"select": "current_company", "status": "eq.verified"})
    counts = Counter(p["current_company"] for p in people if p.get("current_company"))
    return [name for name, _ in counts.most_common(n)]


def match_sports_company(name, companies_by_name):
    row = companies_by_name.get(name.lower())
    if row:
        return row
    for row in companies_by_name.values():
        if name.lower() in {a.lower() for a in (row.get("aliases") or [])}:
            return row
    return None


def logo_of(company):
    return company.get("linkedin_logo_url") or company.get("linkedin_logo_permalink")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--top", type=int, default=15)
    ap.add_argument("--test", action="store_true", help="only the top 3, print results, no writes")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--refresh", action="store_true", help="overwrite existing logo_url too")
    args = ap.parse_args()

    n = 3 if args.test else args.top
    names = top_companies(n)
    print(f"top {n} employers: {names}")

    sports_companies = sb.select_all("sports_companies", {"select": "id,name,domain,aliases,logo_url"})
    by_name = {c["name"].lower(): c for c in sports_companies}

    matched = [(name, match_sports_company(name, by_name)) for name in names]
    to_fetch = [(name, row) for name, row in matched if row and (args.refresh or not row.get("logo_url"))]
    skipped_no_row = [name for name, row in matched if not row]
    if skipped_no_row:
        print(f"no sports_companies row (skipping, not enough info to enrich): {skipped_no_row}")

    domains = [row["domain"] for _, row in to_fetch if row.get("domain")]
    name_only = [(name, row) for name, row in to_fetch if not row.get("domain")]

    results_by_domain = {}
    if domains:
        for c in cd.enrich_companies(domains=domains):
            domain = (c.get("company_website_domain") or "").lower()
            if domain:
                results_by_domain[domain] = c

    results_by_name = {}
    if name_only:
        for c in cd.enrich_companies(names=[name for name, _ in name_only]):
            cname = (c.get("linkedin_profile_name") or c.get("company_name") or "").lower()
            if cname:
                results_by_name[cname] = c

    updates = []
    for name, row in to_fetch:
        company = results_by_domain.get((row.get("domain") or "").lower()) or results_by_name.get(name.lower())
        logo = logo_of(company) if company else None
        if logo:
            updates.append((row, logo))
        else:
            print(f"  ! no logo found for {name}")

    for row, logo in updates:
        print(f"  {row['name']}: {logo}")

    if args.test or args.dry_run:
        return

    for row, logo in updates:
        sb.update("sports_companies", {"id": f"eq.{row['id']}"}, {"logo_url": logo})
    print(f"updated {len(updates)} companies.")


if __name__ == "__main__":
    main()
