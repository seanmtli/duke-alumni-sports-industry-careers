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
import sports_domains
from classify import is_pure_athlete
from employer import pick_primary_employer, is_secondary_role


def domain_of(emp):
    return sports_domains.norm_domain(
        emp.get("company_website_domain") or emp.get("employer_company_website_domain") or "")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--show", type=int, default=25, help="how many flips to print")
    args = ap.parse_args()

    companies = sb.select_all(
        "sports_companies",
        {"select": "name,domain,aliases,org_category,is_sports_native"})
    sports = sports_domains.build_index(companies)
    # Exact primary-domain set = what the OLD `domains[dom]` dict lookup could see.
    # Anything resolving to native that is NOT an exact primary hit is an aliasing/
    # subdomain-variant win.
    primary_native = {sports_domains.norm_domain(c["domain"])
                      for c in companies
                      if c.get("domain") and c.get("is_sports_native")}

    def native(dom):
        c = sports_domains.resolve(dom, sports)
        return bool(c and c.get("is_sports_native"))

    rows = sb.select_all("people", {
        "select": "id,full_name,current_company,current_title,linkedin_url,source,raw_payload",
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
        old_native = native(old_dom)
        new_native = native(new_dom)
        new_comp = sports_domains.resolve(new_dom, sports)

        if old_dom == new_dom:
            stats["picker_agrees"] += 1
        else:
            stats["picker_changed_employer"] += 1

        # Promotion candidates: the corrected picker + expanded/aliased table now
        # lands this rejected person on a sports-native employer. This is the
        # human-triage queue (rejected -> review), NOT an auto-verify list.
        if new_native:
            stats["NOW_RESOLVES_SPORTS_NATIVE"] += 1
            title = new.get("title") or new.get("employee_title") or ""
            athlete = is_pure_athlete(title, prof.get("headline"))
            src = r.get("source") or []
            human_reviewed = "reviewed_reject" in src  # a person already said no
            variant_only = new_native and sports_domains.norm_domain(new_dom) not in primary_native

            if athlete:
                stats["  ...pure athlete (still exclude)"] += 1
            elif human_reviewed:
                stats["  ...already human-reviewed reject (leave alone)"] += 1
            else:
                stats["  ...NET-NEW auto-reject -> PROMOTE TO REVIEW"] += 1
            if variant_only:
                stats["  (matched via alias/subdomain variant)"] += 1
            if new_native and not old_native:
                stats["FLIPS_TO_SPORTS_NATIVE (picker fix alone)"] += 1
            flips.append({
                "name": r["full_name"],
                "was": f'{r.get("current_title") or "?"} @ {r.get("current_company") or "?"}',
                "now": f'{title or "?"} @ {new_comp["name"]}',
                "org": new_comp.get("org_category"),
                "athlete": athlete,
                "human_reviewed": human_reviewed,
                "variant_only": variant_only,
                "li": r.get("linkedin_url"),
            })

        # How often is the [0] role one the corrected picker calls secondary?
        if is_secondary_role(old):
            stats["old_[0]_was_a_secondary_role"] += 1

    print(f"rejected rows scanned: {len(rows)}\n")
    for k, v in stats.most_common():
        print(f"  {k:34s} {v:5d}")

    # Review queue: resolves to sports-native and not a pure athlete. Note that
    # previously human-reviewed rejects are KEPT here on purpose — the named
    # misses (Ariana Andonian @ 76ers/HBSE, the PLL CMO, ...) were human-rejected
    # precisely because the pre-fix picker/table showed the wrong (or no) employer,
    # so they are the highest-value re-reviews, not noise. They are tagged so a
    # reviewer can weigh the prior decision.
    promote = [f for f in flips if not f["athlete"]]
    reviewed = [f for f in promote if f["human_reviewed"]]
    print(f"\n--- {len(flips)} rejected rows now resolve to a sports-native employer; "
          f"{len(promote)} non-athlete -> review queue ---")
    print(f"    of those, {len(reviewed)} were previously human-reviewed rejects "
          f"(re-review: prior call used pre-fix data)")
    by_org = Counter(f["org"] for f in promote)
    for org, n in by_org.most_common():
        print(f"  {org or '(none)':24s} {n}")

    print(f"\nfirst {min(args.show, len(promote))} promotion candidates:")
    for f in promote[:args.show]:
        tags = "".join(t for t in (
            " [variant-match]" if f["variant_only"] else "",
            " [prior-reject]" if f["human_reviewed"] else "") if t)
        print(f"\n  {f['name']}{tags}")
        print(f"    was: {f['was']}")
        print(f"    now: {f['now']}  [{f['org']}]")


if __name__ == "__main__":
    main()
