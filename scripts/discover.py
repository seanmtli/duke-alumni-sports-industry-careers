#!/usr/bin/env python3
"""
Ingest Crustdata people-search spill files (produced by the MCP people_search_db with
truncate=false) into Supabase `people` as discovered records.

Pipeline per profile: Duke-confirmation guard -> athlete exclusion -> dedup
(by crustdata person_id, linkedin_url, and normalized-name vs existing verified) ->
classify sports_functions -> upsert. Logs a discovery_runs row.

Tier A (current employer = sports-native) auto-publishes to status=verified per the
agreed bar; other nets land in status=review.

Usage:
    python scripts/discover.py --net net1 --tier A --status verified \
        --source crustdata_current_employer --files /path/a.txt /path/b.txt
    python scripts/discover.py --net net3a --tier C --status review \
        --source crustdata_past_employer --files /path/c.txt --dry-run
"""
import argparse
import json
import re

import supabase_client as sb
from classify import classify_functions, is_pure_athlete
from employer import pick_primary_employer


def canon_linkedin(u):
    """Canonicalize for dedup WITHOUT corrupting case-sensitive URN ids in the path."""
    if not u:
        return None
    u = u.strip().split("?")[0].rstrip("/")
    u = re.sub(r"^http://", "https://", u)
    m = re.match(r"(https?://[^/]+)(/.*)?$", u)
    if m:
        host = m.group(1).lower()
        path = m.group(2) or ""
        return host + path  # preserve path case (LinkedIn URN ids are case-sensitive)
    return u or None


def norm_name(n):
    if not n:
        return ""
    n = re.sub(r"[^a-z ]", "", n.lower())
    return re.sub(r"\s+", " ", n).strip()


def load_reference():
    duke = {r["entity"] for r in sb.select(
        "duke_school_entities", {"select": "entity", "include": "eq.true"})}
    domains = {}
    for c in sb.select("sports_companies",
                       {"select": "name,domain,org_category,is_sports_native"}):
        if c.get("domain"):
            domains[c["domain"].lower()] = c
    return duke, domains


def load_existing():
    rows = sb.select_all("people", {"select": "crustdata_person_id,linkedin_url,full_name,status"})
    pids = {r["crustdata_person_id"] for r in rows if r.get("crustdata_person_id")}
    lis = {canon_linkedin(r["linkedin_url"]) for r in rows if r.get("linkedin_url")}
    names = {norm_name(r["full_name"]) for r in rows
             if r.get("status") in ("verified", "review", "candidate")}
    return pids, lis, names


def read_profiles(paths):
    profiles = []
    for p in paths:
        data = json.load(open(p))
        profiles.extend(data.get("profiles", []))
    return profiles


def build_candidate(prof, duke_ok, domains, net, tier, status, source):
    institutes = [e.get("institute_name") for e in prof.get("education_background", [])]
    # Duke-confirmation guard: at least one education entry in the curated include-list
    if not any(i in duke_ok for i in institutes if i):
        return None, "duke_guard"

    headline = prof.get("headline")
    cur = pick_primary_employer(prof.get("current_employers"), headline)
    title = cur.get("title")
    if is_pure_athlete(title, headline):
        return None, "athlete"

    dom = (cur.get("company_website_domain") or "").lower()
    comp = domains.get(dom)
    org_cat = comp["org_category"] if comp else None
    company_name = (comp["name"] if comp else None) or cur.get("company_name") or dom or None

    pid = prof.get("person_id")
    row = {
        "crustdata_person_id": str(pid) if pid is not None else None,
        "linkedin_url": canon_linkedin(prof.get("linkedin_profile_url")),
        "full_name": prof.get("name"),
        "headline": headline,
        "current_company": company_name,
        "current_title": title,
        "current_company_id": None,
        "org_category": org_cat,
        "sports_functions": classify_functions(title, headline, company_name, org_cat),
        "location_city": prof.get("location_city"),
        "location_state": prof.get("location_state"),
        "location_country": prof.get("location_country"),
        "status": status,
        "confidence": 0.85 if tier == "A" else (0.6 if tier == "B" else 0.5),
        "discovery_tier": tier,
        "source": [source, f"net:{net}"],
        "raw_payload": prof,
    }
    return row, "ok"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--net", required=True)
    ap.add_argument("--tier", required=True, choices=["A", "B", "C"])
    ap.add_argument("--status", required=True, choices=["candidate", "review", "verified"])
    ap.add_argument("--source", required=True)
    ap.add_argument("--files", nargs="+", required=True)
    ap.add_argument("--total", type=int, help="total_count from the search (for credit log)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    duke_ok, domains = load_reference()
    ex_pids, ex_lis, ex_names = load_existing()

    profiles = read_profiles(args.files)
    seen_pid, seen_li = set(), set()
    new_rows = []
    stats = {"profiles": len(profiles), "duke_guard": 0, "athlete": 0,
             "dup_pid": 0, "dup_li": 0, "matched_existing_name": 0, "new": 0}

    for prof in profiles:
        row, reason = build_candidate(prof, duke_ok, domains, args.net,
                                      args.tier, args.status, args.source)
        if reason != "ok":
            stats[reason] += 1
            continue
        pid, li, nm = row["crustdata_person_id"], row["linkedin_url"], norm_name(row["full_name"])
        if pid and (pid in ex_pids or pid in seen_pid):
            stats["dup_pid"] += 1; continue
        if li and (li in ex_lis or li in seen_li):
            stats["dup_li"] += 1; continue
        if nm and nm in ex_names:
            stats["matched_existing_name"] += 1; continue  # likely already in directory
        if pid:
            seen_pid.add(pid)
        if li:
            seen_li.add(li)
        new_rows.append(row)
        stats["new"] += 1

    print(f"net={args.net} tier={args.tier} -> {json.dumps(stats)}")
    if args.dry_run:
        print("dry run — nothing written.")
        return
    if new_rows:
        for i in range(0, len(new_rows), 200):
            sb.insert("people", new_rows[i:i + 200], return_rows=False)
    sb.insert("discovery_runs", [{
        "net": args.net,
        "filters": {"source": args.source, "tier": args.tier},
        "results_count": stats["profiles"],
        "new_candidates": stats["new"],
        "credits_est": round((args.total or stats["profiles"]) / 100 * 3, 1),
        "notes": json.dumps(stats),
    }], return_rows=False)
    print(f"inserted {len(new_rows)} new people (status={args.status}).")


if __name__ == "__main__":
    main()
