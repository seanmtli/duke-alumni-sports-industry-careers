#!/usr/bin/env python3
"""
Re-verify current employer for league-tagged verified people via realtime
Crustdata enrich. REPORT ONLY — writes nothing. Flags people whose live
current employer differs from what we have stored (esp. league -> team).

Usage: python scripts/reverify_leagues.py [--limit N]
"""
import argparse
import json
import re
import sys

import supabase_client as sb
import crustdata_client as cd
from employer import pick_primary_employer

BATCH = 25


def norm(s):
    if not s:
        return ""
    s = s.lower()
    s = re.sub(r"\(.*?\)", " ", s)            # drop parentheticals e.g. "(NBA)"
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def last_seg(u):
    if isinstance(u, (list, tuple)):
        u = u[0] if u else None
    if not isinstance(u, str) or not u:
        return None
    return u.strip().split("?")[0].rstrip("/").rsplit("/", 1)[-1].lower()


def cohort():
    rows = sb.select_all("people", {
        "select": "id,full_name,current_company,current_title,linkedin_url,org_category",
        "status": "eq.verified",
    })
    out = []
    league_re = re.compile(
        r"\b(NBA|WNBA|NFL|MLB|NHL|MLS|NWSL|NASCAR|PGA|USTA|USL|FIFA|CONCACAF|"
        r"National Basketball|National Football|Major League|National Hockey|"
        r"Women.s National|Olympic|Soccer Federation|Athletes Unlimited)\b", re.I)
    for r in rows:
        if r.get("org_category") == "leagues_governing" or league_re.search(r.get("current_company") or ""):
            if r.get("linkedin_url"):
                out.append(r)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int)
    args = ap.parse_args()

    people = cohort()
    if args.limit:
        people = people[:args.limit]
    print(f"cohort (league-tagged, has linkedin): {len(people)}", file=sys.stderr)

    results = []
    for i in range(0, len(people), BATCH):
        chunk = people[i:i + BATCH]
        urls = [p["linkedin_url"] for p in chunk]
        idx = {}
        for p in chunk:
            idx[last_seg(p["linkedin_url"])] = p
        try:
            profs = cd.enrich_people(urls, realtime=True)
        except SystemExit as e:
            print(f"batch {i} realtime failed: {e}", file=sys.stderr)
            profs = cd.enrich_people(urls, realtime=False)
        for prof in profs:
            person = (idx.get(last_seg(prof.get("query_linkedin_profile_urn_or_slug")))
                      or idx.get(last_seg(prof.get("linkedin_profile_url")))
                      or idx.get(last_seg(prof.get("linkedin_flagship_url"))))
            if not person:
                continue
            emp = pick_primary_employer(prof.get("current_employers"))
            fresh_co = emp.get("employer_name")
            fresh_title = emp.get("employee_title")
            dom = emp.get("domains") or emp.get("employer_company_website_domain") or []
            dom = dom[0] if isinstance(dom, list) and dom else (dom or None)
            mismatch = norm(fresh_co) != norm(person["current_company"]) if fresh_co else False
            results.append({
                "id": person["id"],
                "name": person["full_name"],
                "stored_company": person["current_company"],
                "stored_title": person["current_title"],
                "fresh_company": fresh_co,
                "fresh_title": fresh_title,
                "fresh_domain": dom,
                "start": (emp.get("start_date") or "")[:10],
                "realtime": prof.get("enriched_realtime"),
                "mismatch": mismatch,
            })
        print(f"  enriched {min(i+BATCH,len(people))}/{len(people)}", file=sys.stderr)

    json.dump(results, open("scripts/data/league_reverify.json", "w"), indent=2)
    mm = [r for r in results if r["mismatch"]]
    print(f"\ntotal enriched: {len(results)}  |  MISMATCHES: {len(mm)}\n")
    for r in sorted(mm, key=lambda x: (x["fresh_company"] or "")):
        print(f"• {r['name']}")
        print(f"    stored: {r['stored_company']} — {r['stored_title']}")
        print(f"    LIVE:   {r['fresh_company']} — {r['fresh_title']}  [{r['fresh_domain']}, since {r['start']}]")


if __name__ == "__main__":
    main()
