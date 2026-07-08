#!/usr/bin/env python3
"""
Backfill structured employment history + missing Duke degrees for verified people.

Crustdata returns `current_employers[]` and `past_employers[]` (with titles and
start/end dates) on every /screener/person/enrich call — the same call enrich.py
already makes and pays for. enrich.py extracted five fields and dropped the rest.
This script captures the whole thing.

It also fixes two long-standing data bugs:

  1. Missing second degrees. enrich.py only inserted duke_degrees for people with
     ZERO existing rows, so a Duke undergrad who later did a Fuqua MBA kept
     whichever degree landed first. Sam Marks (Trinity BS 2014 + Fuqua MBA 2020)
     was stored as the single conflated row "Trinity BS 2020". We now upsert
     against the duke_degrees_dedupe_idx unique index.

  2. Wrong current role. `current_employers[0]` is arbitrarily ordered, so people
     with concurrent roles surface a side gig. Kelsey McDonald (Senior Manager,
     Strategy & BI at the New York Yankees) was showing her St. John's adjunct
     professorship. We re-derive from employer.pick_primary_employer().

Credit cost: ~1 per profile. Responses are cached to --cache so that a --dry-run
followed by an --apply costs nothing extra.

Usage:
    python scripts/backfill_work_history.py --limit 25          # dry run, 25 people
    python scripts/backfill_work_history.py                     # dry run, all
    python scripts/backfill_work_history.py --apply             # write (reuses cache)
"""
import argparse
import json
import os
from pathlib import Path

import supabase_client as sb
import crustdata_client as cd
from employer import pick_primary_employer, is_secondary_role, is_clearly_side_role
from enrich import duke_school_map, degrees_from, last_seg, first

BATCH = 25
DEFAULT_CACHE = Path(__file__).parent / "data" / "backfill_profiles.json"


# ---------------------------------------------------------------- extraction

def _one(v):
    """Crustdata hands back some scalars wrapped in a list."""
    if isinstance(v, (list, tuple)):
        return v[0] if v else None
    return v


def _date(v):
    return v[:10] if isinstance(v, str) and len(v) >= 10 else None


def role_row(emp, person_id, is_current):
    """Map one Crustdata employer dict to a work_history row, or None if unusable."""
    company = (emp.get("employer_name") or emp.get("company_name") or "").strip()
    if not company:
        return None  # work_history.company is NOT NULL
    cid = _one(emp.get("employer_company_id"))
    return {
        "person_id": person_id,
        "company": company,
        "company_domain": (_one(emp.get("employer_company_website_domain")) or None),
        "crustdata_company_id": int(cid) if isinstance(cid, (int, str)) and str(cid).isdigit() else None,
        "title": (emp.get("employee_title") or emp.get("title") or "").strip() or None,
        "start_date": _date(emp.get("start_date")),
        # A "current" role can still carry an end_date in Crustdata's payload;
        # trust is_current over the date so the timeline renders consistently.
        "end_date": None if is_current else _date(emp.get("end_date")),
        "is_current": is_current,
        "is_primary": False,
        "location": (emp.get("employee_location") or "").strip() or None,
    }


def roles_for(prof, person_id):
    """All work_history rows for a profile, with is_primary set on the real job."""
    current = prof.get("current_employers") or []
    past = prof.get("past_employers") or []

    rows = []
    for emp in current:
        r = role_row(emp, person_id, True)
        if r:
            rows.append(r)
    for emp in past:
        r = role_row(emp, person_id, False)
        if r:
            rows.append(r)

    primary = pick_primary_employer(current, prof.get("headline"))
    if primary:
        pname = (primary.get("employer_name") or primary.get("company_name") or "").strip()
        pstart = _date(primary.get("start_date"))
        for r in rows:
            if r["is_current"] and r["company"] == pname and r["start_date"] == pstart:
                r["is_primary"] = True
                break

    # Collapse exact dupes within one payload (person held the same title twice
    # with no dates) — the unique index would reject the batch otherwise.
    seen, deduped = set(), []
    for r in rows:
        k = (r["company"], r["title"], r["start_date"])
        if k in seen:
            continue
        seen.add(k)
        deduped.append(r)
    return deduped, primary


# ---------------------------------------------------------------- fetching

def select_targets(limit):
    rows = sb.select_all("people", {
        "select": "id,full_name,linkedin_url,crustdata_person_id,current_company,current_title,source",
        "status": "eq.verified",
        "linkedin_url": "ilike.*linkedin.com/in/*",
    })
    rows.sort(key=lambda r: r["full_name"] or "")
    return rows[:limit] if limit else rows


def fetch_profiles(targets, cache_path):
    """Enrich every target, keyed by person id. Cached so --apply is free."""
    cache = {}
    if cache_path.exists():
        cache = json.loads(cache_path.read_text())
        print(f"cache: {len(cache)} profiles from {cache_path}")

    todo = [t for t in targets if t["id"] not in cache]
    if not todo:
        return cache

    print(f"enriching {len(todo)} profiles ({(len(todo) + BATCH - 1) // BATCH} calls, ~{len(todo)} credits)")
    for i in range(0, len(todo), BATCH):
        chunk = todo[i:i + BATCH]
        idx = {}
        for t in chunk:
            if t.get("linkedin_url"):
                idx[last_seg(t["linkedin_url"])] = t["id"]
            if t.get("crustdata_person_id"):
                idx["pid:" + str(t["crustdata_person_id"])] = t["id"]

        profs = cd.enrich_people([t["linkedin_url"] for t in chunk], realtime=False)
        for prof in profs:
            pid = (idx.get(last_seg(first(prof, "query_linkedin_profile_urn_or_slug")))
                   or idx.get(last_seg(prof.get("linkedin_profile_url")))
                   or idx.get(last_seg(prof.get("linkedin_flagship_url")))
                   or idx.get("pid:" + str(prof.get("person_id") or "")))
            if pid:
                cache[pid] = prof

        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(json.dumps(cache))  # checkpoint after every call
        print(f"  {min(i + BATCH, len(todo))}/{len(todo)}")
    return cache


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write to Supabase (default: dry run)")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    args = ap.parse_args()

    duke_map = duke_school_map()
    targets = select_targets(args.limit)
    print(f"targets: {len(targets)} verified people with a LinkedIn URL")

    profiles = fetch_profiles(targets, args.cache)

    role_changes, all_roles, all_degrees, skipped, review = [], [], [], [], []
    stats = {"no_profile": 0, "no_roles": 0, "roles": 0, "degrees": 0,
             "role_unchanged": 0, "single_employer_no_ambiguity": 0, "hand_curated": 0,
             "ambiguous_left_alone": 0}

    for t in targets:
        prof = profiles.get(t["id"])
        if not prof:
            stats["no_profile"] += 1
            continue

        rows, primary = roles_for(prof, t["id"])
        if not rows:
            stats["no_roles"] += 1
        all_roles.extend(rows)
        stats["roles"] += len(rows)

        for d in degrees_from(prof, duke_map):
            d["person_id"] = t["id"]
            all_degrees.append(d)

        new_co = (primary.get("employer_name") or primary.get("company_name") or "").strip() or None
        new_title = (primary.get("employee_title") or primary.get("title") or "").strip() or None
        old_co, old_title = t.get("current_company"), t.get("current_title")
        changed = bool(new_co) and (new_co != old_co or new_title != old_title)

        if not changed:
            stats["role_unchanged"] += 1
            continue

        # The bug being fixed is AMBIGUITY: `current_employers[0]` mis-picking
        # among concurrent roles. With a single current employer there was never
        # a choice to get wrong, so any difference is just Crustdata's naming
        # drifting from ours ("Fenway Sports Group" vs "Fenway Sports Management
        # (FSM)"). Rewriting those would churn 100s of records for no gain.
        if len(prof.get("current_employers") or []) < 2:
            stats["single_employer_no_ambiguity"] += 1
            skipped.append((t, old_co, old_title, new_co, new_title, "single employer"))
            continue

        # A human explicitly vouched for these values; never clobber them.
        src = t.get("source") or []
        if "manual_curated" in src or "admin" in src:
            stats["hand_curated"] += 1
            skipped.append((t, old_co, old_title, new_co, new_title, "hand-curated"))
            continue

        # Only auto-correct a DEMONSTRABLY BAD stored pick: one where the stored
        # title is a side role (adjunct professorship, board seat, advisory gig)
        # and we found a real job to replace it with. That is exactly the
        # reported bug (Kelsey McDonald showing her St. John's adjunct post
        # instead of the Yankees).
        #
        # Anything else is us second-guessing a plausible stored value on a
        # person who genuinely holds several real concurrent roles, and the
        # picker is not good enough for that. Left alone, it would demote
        # Amber Scott from "Director, Social Impact @ NBA" to "Senior Pastor @
        # Waters Memorial AME Church", and Beau Dure to "Musician @ The Randos"
        # — both real titles, neither the one this directory is about.
        if not (is_clearly_side_role({"title": old_title}) and not is_secondary_role(primary)):
            stats["ambiguous_left_alone"] += 1
            review.append((t, old_co, old_title, new_co, new_title))
            continue

        role_changes.append((t, old_co, old_title, new_co, new_title))

    stats["degrees"] = len(all_degrees)

    print(f"\n{'=' * 78}")
    print(f"work_history rows to write   : {stats['roles']}")
    print(f"duke_degrees rows to upsert  : {stats['degrees']}")
    print(f"current-role changes to apply: {len(role_changes)}")
    print(f"unchanged                    : {stats['role_unchanged']}")
    print(f"skipped, single employer     : {stats['single_employer_no_ambiguity']}")
    print(f"skipped, hand-curated        : {stats['hand_curated']}")
    print(f"left alone, ambiguous        : {stats['ambiguous_left_alone']}")
    print(f"no profile returned          : {stats['no_profile']}")
    print(f"profile had no usable roles  : {stats['no_roles']}")
    print("=" * 78)

    if role_changes:
        print(f"\nWILL APPLY ({len(role_changes)}) — stored title is a side role")
        print("(adjunct/board/advisor) and a real job exists to replace it.\n")
        for t, oc, ot, nc, nt in role_changes:
            print(f"  {t['full_name']}")
            print(f"    was: {ot or '—'} @ {oc or '—'}")
            print(f"    now: {nt or '—'} @ {nc}")

    if review:
        print(f"\nLEFT ALONE ({len(review)}) — several real concurrent roles; the picker")
        print("is not confident enough to overrule the stored value. Eyeball these;")
        print("fix any that are genuinely wrong via /admin.\n")
        for t, oc, ot, nc, nt in review:
            print(f"  {t['full_name']:32s} {ot or '—'} @ {oc or '—'}")
            print(f"  {'':32s}   -> would have been: {nt or '—'} @ {nc}")

    if skipped:
        print(f"\nNAME CHURN, NOT APPLIED ({len(skipped)}):\n")
        for t, oc, _ot, nc, _nt, why in skipped:
            print(f"  {t['full_name']:32s} {oc or '—'!r} vs {nc!r}  [{why}]")

    if not args.apply:
        print("\nDRY RUN — nothing written. Re-run with --apply (uses the cache, no extra credits).")
        return

    # work_history is fully derived from Crustdata and has no admin edit surface,
    # so delete-then-insert per person keeps is_primary/is_current correct across
    # re-runs. duke_degrees IS admin-editable, so upsert instead of replacing.
    touched = sorted({r["person_id"] for r in all_roles})
    print(f"\nwriting work_history for {len(touched)} people...")
    for i in range(0, len(touched), 50):
        ids = touched[i:i + 50]
        sb.delete("work_history", {"person_id": f"in.({','.join(ids)})"})
    for i in range(0, len(all_roles), 200):
        sb.insert("work_history", all_roles[i:i + 200], return_rows=False)

    print(f"upserting {len(all_degrees)} duke_degrees...")
    for i in range(0, len(all_degrees), 200):
        sb.insert("duke_degrees", all_degrees[i:i + 200],
                  on_conflict="person_id,school,degree,grad_year",
                  upsert=True, return_rows=False)

    print(f"patching {len(role_changes)} current roles...")
    for t, _oc, _ot, nc, nt in role_changes:
        sb.update("people", {"id": f"eq.{t['id']}"},
                  {"current_company": nc, "current_title": nt})

    print("done.")


if __name__ == "__main__":
    main()
