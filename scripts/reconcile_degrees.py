#!/usr/bin/env python3
"""
Reconcile duke_degrees after backfill_work_history.py.

The backfill UPSERTs Crustdata-derived degrees on (person_id, school, degree,
grad_year). Pre-existing rows written by the old alumni.json import spell the
same degree differently, so they do not collide and both survive:

    Sam Marks     [OLD] Trinity / BS / 2020
                  [NEW] General / Bachelor of Science (BS) / 2014
                  [NEW] Fuqua   / Master of Business Administration - MBA / 2020

The OLD row is a CONFLATION — his undergrad school with his Fuqua year — and it
is exactly the double-Dukie population we are trying to fix, so old grad_years
cannot be trusted as a set. But neither side is wholly authoritative:

  Crustdata owns    the DEGREE LIST (it alone knows about the second degree)
                    and the per-degree years.
  The old rows own  the SCHOOL. Crustdata matches the parent "Duke University"
                    entity and yields school='General', losing the fact that
                    Michael King's BSE was from Pratt, not Trinity.

So a fresh row ADOPTS what the old row knows better — school when the fresh row
is a generic 'General', grad_year when Crustdata returned none (its education
end_dates are frequently null) — and only then is the old row dropped.

The old row is matched to a fresh row by equal grad_year first (a strong signal),
falling back to equal normalized school. School is only adopted onto a 'General'
fresh row, which is what stops Sam Marks's conflated `Trinity/2020` from
overwriting the school of his genuine `Fuqua/MBA/2020`.

Old rows are kept untouched for:
  - people with no fresh Crustdata degree (nothing better to replace them with)
  - people sourced 'admin' / 'manual_curated' (a human entered those degrees)

Usage:
    python scripts/reconcile_degrees.py            # dry run
    python scripts/reconcile_degrees.py --apply
"""
import argparse
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import supabase_client as sb

VALID_SCHOOLS = {"Trinity", "Pratt", "Fuqua", "Law", "Medicine", "Nicholas", "Sanford", "Other"}
GRAD_DEGREE = re.compile(r"\b(MBA|JD|MD|PhD|LLM|MPP|MPA|MEM|MS|MA|Master|Doctor)\b", re.I)


def normalize_school(school, degree):
    """Mirror of normalizeSchool() in src/lib/alumniMap.ts."""
    s = school or "Other"
    if s in VALID_SCHOOLS:
        return s
    # 'General' == matched the parent "Duke University" entity. That is the
    # undergraduate college unless the degree says otherwise.
    if s == "General":
        return "Other" if GRAD_DEGREE.search(degree or "") else "Trinity"
    return "Other"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--cutoff-minutes", type=int, default=90,
                    help="rows newer than this are the backfill's output")
    args = ap.parse_args()

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=args.cutoff_minutes)

    protected = {
        p["id"] for p in sb.select_all("people", {"select": "id,source"})
        if {"admin", "manual_curated"} & set(p.get("source") or [])
    }
    names = {p["id"]: p["full_name"] for p in sb.select_all("people", {"select": "id,full_name"})}

    rows = sb.select_all("duke_degrees",
                         {"select": "id,person_id,school,degree,grad_year,major,created_at"})
    by_person = defaultdict(list)
    for r in rows:
        r["fresh"] = datetime.fromisoformat(r["created_at"]) > cutoff
        by_person[r["person_id"]].append(r)

    to_delete, to_patch, skipped_protected = [], {}, 0
    named_schools = VALID_SCHOOLS - {"Other"}

    for pid, degs in by_person.items():
        fresh = [d for d in degs if d["fresh"]]
        old = [d for d in degs if not d["fresh"]]
        if not fresh or not old:
            continue  # nothing to reconcile
        if pid in protected:
            skipped_protected += 1
            continue

        for f in fresh:
            # Equal grad_year is the strongest same-degree signal. Fall back to
            # equal normalized school when Crustdata gave us no year at all.
            cands = [o for o in old
                     if f["grad_year"] is not None and o["grad_year"] == f["grad_year"]]
            if not cands:
                cands = [o for o in old
                         if normalize_school(o["school"], o["degree"])
                         == normalize_school(f["school"], f["degree"])]
            if len(cands) != 1:
                continue
            o = cands[0]

            patch = {}
            if f["grad_year"] is None and o["grad_year"] is not None:
                patch["grad_year"] = o["grad_year"]
            # Only a generic 'General' row may inherit a school. A fresh row that
            # already names its school (Fuqua, Law) must never be overwritten by
            # a conflated old row that happens to share its year.
            if f["school"] == "General" and o["school"] in named_schools:
                patch["school"] = o["school"]
            if patch:
                to_patch[f["id"]] = (f, o, patch)

        to_delete.extend(old)

    print(f"people reconciled     : {len({d['person_id'] for d in to_delete})}")
    print(f"stale rows to delete  : {len(to_delete)}")
    print(f"fresh rows to enrich  : {len(to_patch)}")
    print(f"  school adopted      : {sum(1 for _f, _o, p in to_patch.values() if 'school' in p)}")
    print(f"  grad_year adopted   : {sum(1 for _f, _o, p in to_patch.values() if 'grad_year' in p)}")
    print(f"protected (admin)     : {skipped_protected}")

    print("\nadoptions:")
    for f, o, patch in list(to_patch.values())[:14]:
        print(f"  {names.get(f['person_id'], '?'):28s} "
              f"{f['school']}/{(f['degree'] or '?')[:28]}/{f['grad_year']}"
              f"  <- {patch}  (from {o['school']}/{o['degree']}/{o['grad_year']})")

    if not args.apply:
        print("\nDRY RUN — nothing written.")
        return

    # Delete BEFORE patching. A fresh row that adopts both school and grad_year
    # becomes byte-identical to the old row it adopted them from, and
    # duke_degrees_dedupe_idx rejects the UPDATE with a 23505.
    ids = [d["id"] for d in to_delete]
    for i in range(0, len(ids), 100):
        sb.delete("duke_degrees", {"id": f"in.({','.join(ids[i:i + 100])})"})
    print(f"\ndeleted {len(ids)} stale rows")

    patched = redundant = 0
    for f, _o, patch in to_patch.values():
        try:
            sb.update("duke_degrees", {"id": f"eq.{f['id']}"}, patch)
            patched += 1
        except SystemExit as e:
            # Still colliding after the delete => a SECOND fresh row already
            # occupies this exact (school, degree, grad_year). This one is a
            # duplicate spelling of a degree we already have; drop it.
            if "23505" not in str(e):
                raise
            sb.delete("duke_degrees", {"id": f"eq.{f['id']}"})
            redundant += 1

    print(f"enriched {patched} fresh rows; dropped {redundant} redundant duplicates")


if __name__ == "__main__":
    main()
