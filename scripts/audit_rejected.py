#!/usr/bin/env python3
"""
Zero-credit audit: how many `status='rejected'` people were rejected only because
`current_employers[0]` picked the wrong concurrent role?

discover.py decides Tier A (auto-publish) by whether the CHOSEN current employer's
domain is sports-native. The old code took `[0]`, which Crustdata orders
arbitrarily — so an adjunct professorship or a board seat could mask a real
sports job and sink the record.

1108 of the 1120 rejected rows still carry the full discovery profile in
people.raw_payload, so we can re-run the corrected picker offline against the
stored payload. No Crustdata calls, no credits.

Read-only. Writes nothing.

Usage:
    python scripts/audit_rejected.py
    python scripts/audit_rejected.py --show 40
"""
import argparse
from collections import Counter

import supabase_client as sb
from employer import pick_primary_employer, is_secondary_role


def domain_of(emp):
    d = emp.get("company_website_domain") or emp.get("employer_company_website_domain") or ""
    if isinstance(d, (list, tuple)):
        d = d[0] if d else ""
    return (d or "").strip().lower()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--show", type=int, default=25, help="how many flips to print")
    args = ap.parse_args()

    sports = {}
    for c in sb.select_all("sports_companies",
                           {"select": "name,domain,org_category,is_sports_native"}):
        if c.get("domain"):
            sports[c["domain"].lower()] = c

    rows = sb.select_all("people", {
        "select": "id,full_name,current_company,current_title,linkedin_url,raw_payload",
        "status": "eq.rejected",
    })

    stats = Counter()
    flips = []

    for r in rows:
        prof = r.get("raw_payload") or {}
        emps = prof.get("current_employers") or []
        if not emps:
            stats["no_payload_or_no_employers"] += 1
            continue
        stats["auditable"] += 1

        old = emps[0]
        new = pick_primary_employer(emps, prof.get("headline"))

        old_dom, new_dom = domain_of(old), domain_of(new)
        old_native = sports.get(old_dom, {}).get("is_sports_native", False)
        new_native = sports.get(new_dom, {}).get("is_sports_native", False)

        if old_dom == new_dom:
            stats["picker_agrees"] += 1
        else:
            stats["picker_changed_employer"] += 1

        if new_native and not old_native:
            stats["FLIPS_TO_SPORTS_NATIVE"] += 1
            comp = sports[new_dom]
            flips.append({
                "name": r["full_name"],
                "was": f'{r.get("current_title") or "?"} @ {r.get("current_company") or "?"}',
                "now": f'{new.get("title") or new.get("employee_title") or "?"} @ {comp["name"]}',
                "org": comp.get("org_category"),
                "li": r.get("linkedin_url"),
            })
        elif new_native and old_native:
            stats["already_native_either_way"] += 1

        # How often is the [0] role one the corrected picker calls secondary?
        if is_secondary_role(old):
            stats["old_[0]_was_a_secondary_role"] += 1

    print(f"rejected rows scanned: {len(rows)}\n")
    for k, v in stats.most_common():
        print(f"  {k:34s} {v:5d}")

    print(f"\n--- {len(flips)} would now resolve to a sports-native employer ---")
    by_org = Counter(f["org"] for f in flips)
    for org, n in by_org.most_common():
        print(f"  {org or '(none)':24s} {n}")

    print(f"\nfirst {min(args.show, len(flips))}:")
    for f in flips[:args.show]:
        print(f"\n  {f['name']}")
        print(f"    was: {f['was']}")
        print(f"    now: {f['now']}  [{f['org']}]")


if __name__ == "__main__":
    main()
