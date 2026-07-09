#!/usr/bin/env python3
"""
Frequency of the corrected-primary-employer domain across `status='rejected'`
people that sports_companies STILL does not recognize (after alias/subdomain
resolution). This is the candidate list for the next round of coverage
expansion: eyeball the top of the list, add the real sports employers to
scripts/data/sports_companies_seed.json, re-run build_sports_companies.py.

Read-only, zero Crustdata credits — it reads people.raw_payload just like
audit_rejected.py. Most surviving domains are correctly non-sports
(bcg.com, goldmansachs.com); the point is to surface the sports ones hiding in
the long tail (a new team domain, a startup, a career-site variant).

Usage:
    python scripts/analyze_rejected_domains.py            # top 60
    python scripts/analyze_rejected_domains.py --top 200
    python scripts/analyze_rejected_domains.py --min 2    # only domains seen >=2x
"""
import argparse
from collections import Counter, defaultdict

import supabase_client as sb
import sports_domains
from employer import pick_primary_employer


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--top", type=int, default=60)
    ap.add_argument("--min", type=int, default=1, help="min occurrences to print")
    args = ap.parse_args()

    companies = sb.select_all("sports_companies",
                              {"select": "name,domain,aliases,is_sports_native"})
    index = sports_domains.build_index(companies)

    rows = sb.select_all("people", {
        "select": "full_name,current_title,raw_payload",
        "status": "eq.rejected",
    })

    freq = Counter()
    examples = defaultdict(list)
    for r in rows:
        prof = r.get("raw_payload") or {}
        emps = prof.get("current_employers") or []
        if not emps:
            continue
        emp = pick_primary_employer(emps, prof.get("headline"))
        dom = sports_domains.norm_domain(
            emp.get("company_website_domain") or emp.get("employer_company_website_domain") or "")
        if not dom or sports_domains.resolve(dom, index):
            continue  # blank, or already covered (incl. via alias/subdomain)
        freq[dom] += 1
        if len(examples[dom]) < 3:
            t = emp.get("title") or emp.get("employee_title") or "?"
            examples[dom].append(f"{r['full_name']} — {t}")

    shown = [(d, n) for d, n in freq.most_common() if n >= args.min][:args.top]
    print(f"unknown employer domains among rejected people: {len(freq)} distinct "
          f"({sum(freq.values())} people)\n")
    for dom, n in shown:
        print(f"{n:3d}  {dom}")
        for ex in examples[dom]:
            print(f"       {ex}")


if __name__ == "__main__":
    main()
