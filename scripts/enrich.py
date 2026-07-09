#!/usr/bin/env python3
"""
Enrich people via Crustdata REST -> update Supabase: headshot, location, vanity
LinkedIn URL, seniority, and Duke degrees (school/degree/grad_year/major).

Resumable: only processes people with last_enriched IS NULL (and a linkedin_url).
Sets last_enriched after each batch.

Usage:
    python scripts/enrich.py --test                 # enrich 2 profiles, dump JSON shape
    python scripts/enrich.py --limit 50 --dry-run   # preview parse for first 50
    python scripts/enrich.py                         # full resumable run (batches of 25)
"""
import argparse
import json
import re

import supabase_client as sb
import crustdata_client as cd
from us_states import US_STATES, normalize_state

BATCH = 25


def duke_school_map():
    return {r["entity"]: r["school"] for r in sb.select_all(
        "duke_school_entities", {"select": "entity,school", "include": "eq.true"})}


def first(d, *keys):
    for k in keys:
        v = d.get(k)
        if v not in (None, "", [], {}):
            return v
    return None


def parse_location(prof):
    loc = first(prof, "location", "region")
    if not loc:
        return None, None, None
    parts = [p.strip() for p in loc.split(",") if p.strip()]
    if len(parts) >= 3:        # City, State, Country
        return parts[0], normalize_state(parts[-2]), parts[-1]
    if len(parts) == 2:        # City, State  OR  City, Country
        city, tail = parts
        state = normalize_state(tail)
        if state in US_STATES:
            return city, state, "United States"
        return city, None, tail
    return parts[0], None, None


def headshot_of(prof):
    # prefer the stable Crustdata S3 permalink over the expiring licdn URL
    return first(prof, "profile_picture_permalink", "profile_picture_url",
                 "linkedin_profile_picture")


def vanity_of(prof):
    u = first(prof, "linkedin_flagship_url", "linkedin_profile_url")
    if u and "/in/acoaa" not in u.lower():
        return u.strip().split("?")[0].rstrip("/")
    return None


def last_seg(u):
    if isinstance(u, (list, tuple)):
        u = u[0] if u else None
    if not isinstance(u, str) or not u:
        return None
    return u.strip().split("?")[0].rstrip("/").rsplit("/", 1)[-1].lower()


def education_entries(prof):
    return first(prof, "education_background", "educations", "education") or []


def degrees_from(prof, duke_map):
    out = []
    for e in education_entries(prof):
        inst = e.get("institute_name") or e.get("school") or e.get("institute")
        if inst not in duke_map:
            continue
        end = e.get("end_date") or e.get("end_year") or ""
        m = re.search(r"(19|20)\d{2}", str(end))
        out.append({
            "school": duke_map[inst],
            "degree": e.get("degree_name") or e.get("degree"),
            "grad_year": int(m.group(0)) if m else None,
            "major": e.get("field_of_study") or e.get("major"),
        })
    return out


def select_targets(limit):
    params = {"select": "id,linkedin_url,crustdata_person_id,headshot_url",
              "last_enriched": "is.null",
              "linkedin_url": "ilike.*linkedin.com/in/*"}
    rows = sb.select_all("people", params)
    return rows[:limit] if limit else rows


def apply_profile(person, prof, duke_map, existing_deg_persons):
    patch = {"last_enriched": "now()"}
    hs = headshot_of(prof)
    if hs and not person.get("headshot_url"):
        patch["headshot_url"] = hs
    city, state, country = parse_location(prof)
    if city:
        patch["location_city"] = city
    if state:
        patch["location_state"] = state
    if country:
        patch["location_country"] = country
    sen = first(prof, "seniority_level") or \
        ((prof.get("employer") or prof.get("current_employers") or [{}])[0] or {}).get("seniority_level")
    if sen:
        patch["seniority_level"] = sen
    new_li = vanity_of(prof)
    degrees = []
    if person["id"] not in existing_deg_persons:
        for d in degrees_from(prof, duke_map):
            d["person_id"] = person["id"]
            degrees.append(d)
    return patch, new_li, degrees


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--test", action="store_true")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    duke_map = duke_school_map()

    if args.test:
        targets = select_targets(2)
        urls = [t["linkedin_url"] for t in targets]
        print("testing enrich on:", urls)
        profs = cd.enrich_people(urls, realtime=False)
        print(f"returned {len(profs)} profiles")
        if profs:
            print("KEYS:", sorted(profs[0].keys()))
            print(json.dumps(profs[0], indent=2)[:2500])
        return

    targets = select_targets(args.limit)
    existing_deg = {d["person_id"] for d in sb.select_all("duke_degrees", {"select": "person_id"})}
    print(f"to enrich: {len(targets)}")

    done = 0
    all_degrees = []
    for i in range(0, len(targets), BATCH):
        chunk = targets[i:i + BATCH]
        urls = [t["linkedin_url"] for t in chunk]
        # per-chunk index: last-path-segment and crustdata id -> person
        idx = {}
        for t in chunk:
            if t.get("linkedin_url"):
                idx[last_seg(t["linkedin_url"])] = t
            if t.get("crustdata_person_id"):
                idx["pid:" + str(t["crustdata_person_id"])] = t
        profs = cd.enrich_people(urls, realtime=False)
        for prof in profs:
            person = (idx.get(last_seg(first(prof, "query_linkedin_profile_urn_or_slug")))
                      or idx.get(last_seg(prof.get("linkedin_profile_url")))
                      or idx.get(last_seg(prof.get("linkedin_flagship_url")))
                      or idx.get("pid:" + str(prof.get("person_id") or "")))
            if not person:
                continue
            patch, new_li, degrees = apply_profile(person, prof, duke_map, existing_deg)
            all_degrees.extend(degrees)
            if not args.dry_run:
                if new_li and new_li != (person["linkedin_url"] or "").lower():
                    try:
                        sb.update("people", {"id": f"eq.{person['id']}"}, {**patch, "linkedin_url": new_li})
                    except SystemExit:
                        sb.update("people", {"id": f"eq.{person['id']}"}, patch)
                else:
                    sb.update("people", {"id": f"eq.{person['id']}"}, patch)
        # mark the whole chunk enriched even if some had no profile (avoid reprocessing)
        if not args.dry_run:
            ids = [t["id"] for t in chunk]
            sb.update("people", {"id": f"in.({','.join(ids)})", "last_enriched": "is.null"},
                      {"last_enriched": "now()"})
        done += len(chunk)
        print(f"  {done}/{len(targets)} processed")

    if all_degrees and not args.dry_run:
        for i in range(0, len(all_degrees), 200):
            sb.insert("duke_degrees", all_degrees[i:i + 200], return_rows=False)
    print(f"degrees added: {len(all_degrees)}  {'(dry run)' if args.dry_run else ''}")


if __name__ == "__main__":
    main()
