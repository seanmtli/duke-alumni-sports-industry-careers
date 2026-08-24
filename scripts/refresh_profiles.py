#!/usr/bin/env python3
"""
Refresh verified alumni against Crustdata: current job, missing headshots,
location, and work history.

Unlike enrich.py (one-shot, last_enriched IS NULL, no job writes) and
backfill_work_history.py (only fixes side-gig mis-picks), this script is the
recurring job-change pass. Cached enrich by default (~3 credits/profile);
pass --realtime for a live LinkedIn scrape (~5 credits/profile).

Usage:
    python scripts/refresh_profiles.py                  # dry run, all verified
    python scripts/refresh_profiles.py --limit 25       # dry run, 25 people
    python scripts/refresh_profiles.py --apply          # write (reuses --cache)
    python scripts/refresh_profiles.py --apply --stale-days 50
"""
from __future__ import annotations

import argparse
import json
import re
from datetime import date, datetime, timezone, timedelta
from pathlib import Path

import supabase_client as sb
import crustdata_client as cd
from backfill_work_history import roles_for
from classify import classify_functions
from enrich import first, headshot_of, last_seg, parse_location
from employer import pick_primary_employer

BATCH = 25
RECENT_VERIFY_DAYS = 14
CREDITS_CACHED = 3
CREDITS_REALTIME = 5
DEFAULT_CACHE = Path(__file__).parent / "data" / "refresh_profiles.json"

# Legal / corporate suffixes stripped from the *end* of a company name.
_LEGAL_SUFFIXES = (
    "incorporated", "corporation", "company", "limited", "inc", "llc", "ltd",
    "corp", "plc", "lp", "llp", "co", "pc",
)
# Tokens ignored when comparing whether two names are the same employer
# (Fenway Sports Group vs Fenway Sports Management).
_COMPANY_STOPWORDS = {
    "group", "management", "holdings", "holding", "partners", "partner",
    "llc", "inc", "ltd", "corp", "corporation", "company", "co", "plc",
    "the", "of", "and", "fsm", "lp", "llp", "llc", "pc", "llc.",
    "fc", "afc", "cfc", "sc",
}
_NON_ALNUM = re.compile(r"[^a-z0-9]+")
_WHITESPACE = re.compile(r"\s+")


# ---------------------------------------------------------------- comparison


def _norm_text(value):
    if not value:
        return ""
    s = str(value).strip().lower().replace("&", " and ")
    s = _NON_ALNUM.sub(" ", s)
    return _WHITESPACE.sub(" ", s).strip()


def _company_tokens(value):
    s = _norm_text(value)
    if not s:
        return []
    tokens = s.split()
    while tokens and tokens[-1] in _LEGAL_SUFFIXES:
        tokens.pop()
    return [t for t in tokens if t and t not in _COMPANY_STOPWORDS]


def same_company(a, b):
    """True when two employer strings look like the same org, not a job change.

    Handles case/whitespace, Inc./LLC suffixes, subset names ("Fanatics" vs
    "Fanatics Betting & Gaming"), and stopword-only diffs ("Fenway Sports
    Group" vs "Fenway Sports Management"). Does not collapse "New York
    Yankees" into "New York Mets".
    """
    ta, tb = _company_tokens(a), _company_tokens(b)
    if not ta or not tb:
        return False
    if ta == tb:
        return True
    sa, sb = set(ta), set(tb)
    if sa == sb:
        return True
    # One name is a more specific spelling of the other.
    if sa.issubset(sb) or sb.issubset(sa):
        return True
    return False


def same_title(a, b):
    return _norm_text(a) == _norm_text(b)


def _parse_date(value):
    """Best-effort date from a YYYY-MM-DD string or timestamptz."""
    if not value or not isinstance(value, str):
        return None
    raw = value.strip()
    if not raw:
        return None
    try:
        return date.fromisoformat(raw[:10])
    except ValueError:
        return None


def _parse_datetime(value):
    if not value or not isinstance(value, str):
        return None
    raw = value.strip()
    if not raw:
        return None
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(raw)
    except ValueError:
        d = _parse_date(value)
        if not d:
            return None
        return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def is_recently_verified(last_verified, today, recent_days=RECENT_VERIFY_DAYS):
    d = _parse_date(last_verified)
    if not d:
        return False
    return (today - d).days <= recent_days


def is_stale(last_enriched, now, stale_days):
    """True when this person should be fetched this run.

    stale_days <= 0 means refresh everyone. A null last_enriched is always stale.
    """
    if stale_days is None or stale_days <= 0:
        return True
    dt = _parse_datetime(last_enriched)
    if not dt:
        return True
    return (now - dt) >= timedelta(days=stale_days)


def should_apply_job_change(old_co, old_title, new_co, new_title,
                            last_verified, today, recent_days=RECENT_VERIFY_DAYS):
    """Return (apply: bool, reason: str)."""
    if not (new_co or "").strip():
        return False, "no_new_company"
    if is_recently_verified(last_verified, today, recent_days):
        return False, "recently_verified"
    co_same = same_company(old_co, new_co)
    title_same = same_title(old_title, new_title)
    if co_same and title_same:
        return False, "unchanged"
    if co_same:
        return True, "title_change"
    return True, "company_change"


def stable_headshot(prof):
    """Crustdata S3 permalink preferred; LinkedIn CDN URLs expire and are ignored."""
    url = headshot_of(prof) or first(prof, "profile_picture_permalink",
                                     "profile_picture_url", "linkedin_profile_picture")
    if not url:
        return None
    if "media.licdn.com" in url:
        return None
    return url


def primary_role(prof):
    primary = pick_primary_employer(prof.get("current_employers") or [], prof.get("headline"))
    if not primary:
        return None, None
    company = (primary.get("employer_name") or primary.get("company_name") or "").strip() or None
    title = (primary.get("employee_title") or primary.get("title") or "").strip() or None
    return company, title


# ---------------------------------------------------------------- fetch


def select_targets(limit=None, stale_days=0, now=None):
    rows = sb.select_all("people", {
        "select": (
            "id,full_name,linkedin_url,crustdata_person_id,current_company,"
            "current_title,source,headshot_url,last_enriched,last_verified,"
            "location_city,location_state,location_country,org_category,headline"
        ),
        "status": "eq.verified",
        "linkedin_url": "ilike.*linkedin.com/in/*",
    })
    now = now or datetime.now(timezone.utc)
    rows = [r for r in rows if is_stale(r.get("last_enriched"), now, stale_days)]
    rows.sort(key=lambda r: (r.get("full_name") or "").lower())
    return rows[:limit] if limit else rows


def fetch_profiles(targets, cache_path, realtime=False):
    """Enrich every target, keyed by person id. Cached so --apply is free."""
    cache = {}
    if cache_path.exists():
        cache = json.loads(cache_path.read_text())
        print(f"cache: {len(cache)} profiles from {cache_path}")

    todo = [t for t in targets if t["id"] not in cache]
    if not todo:
        return cache, 0

    per = CREDITS_REALTIME if realtime else CREDITS_CACHED
    estimated = per * len(todo)
    balance = cd.credits_balance()
    if balance is not None:
        print(f"crustdata balance: {balance:.1f}  estimated spend: ~{estimated} "
              f"({per} cr x {len(todo)} profiles)")
        if balance < estimated:
            raise SystemExit(
                f"Not enough Crustdata credits ({balance:.1f} < ~{estimated}). "
                "Top up at crustdata.com or pass --limit."
            )
    else:
        print(f"crustdata balance: unknown  estimated spend: ~{estimated} "
              f"({per} cr x {len(todo)} profiles)")

    print(f"enriching {len(todo)} profiles "
          f"({(len(todo) + BATCH - 1) // BATCH} calls, realtime={realtime})")
    fetched = 0
    for i in range(0, len(todo), BATCH):
        chunk = todo[i:i + BATCH]
        idx = {}
        for t in chunk:
            if t.get("linkedin_url"):
                idx[last_seg(t["linkedin_url"])] = t["id"]
            if t.get("crustdata_person_id"):
                idx["pid:" + str(t["crustdata_person_id"])] = t["id"]

        profs = cd.enrich_people([t["linkedin_url"] for t in chunk], realtime=realtime)
        fetched += len(profs)
        for prof in profs:
            pid = (idx.get(last_seg(first(prof, "query_linkedin_profile_urn_or_slug")))
                   or idx.get(last_seg(prof.get("linkedin_profile_url")))
                   or idx.get(last_seg(prof.get("linkedin_flagship_url")))
                   or idx.get("pid:" + str(prof.get("person_id") or "")))
            if pid:
                cache[pid] = prof

        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(json.dumps(cache))
        print(f"  {min(i + BATCH, len(todo))}/{len(todo)}")
    return cache, fetched


# ---------------------------------------------------------------- plan / apply


def plan_person(person, prof, today):
    """Build the patch + side effects for one person. Pure besides date."""
    result = {
        "person": person,
        "patch": {},
        "roles": [],
        "job_change": None,          # (old_co, old_title, new_co, new_title, reason)
        "job_skip": None,            # reason
        "headshot": False,
        "no_current_role": False,
    }
    new_co, new_title = primary_role(prof)
    old_co, old_title = person.get("current_company"), person.get("current_title")

    apply, reason = should_apply_job_change(
        old_co, old_title, new_co, new_title, person.get("last_verified"), today,
    )
    if apply:
        result["patch"]["current_company"] = new_co
        result["patch"]["current_title"] = new_title
        result["patch"]["last_verified"] = today.isoformat()
        result["job_change"] = (old_co, old_title, new_co, new_title, reason)
    else:
        result["job_skip"] = reason
        if reason == "unchanged":
            result["patch"]["last_verified"] = today.isoformat()
        if reason == "no_new_company":
            result["no_current_role"] = True

    hs = stable_headshot(prof)
    if hs and not person.get("headshot_url"):
        result["patch"]["headshot_url"] = hs
        result["headshot"] = True

    city, state, country = parse_location(prof)
    if city:
        result["patch"]["location_city"] = city
    if state:
        result["patch"]["location_state"] = state
    if country:
        result["patch"]["location_country"] = country

    result["patch"]["last_enriched"] = "now()"

    rows, _primary = roles_for(prof, person["id"])
    result["roles"] = rows
    return result


def format_changelog(plans, targets, no_profile):
    job_changes = [p for p in plans if p["job_change"]]
    headshots = [p for p in plans if p["headshot"]]
    no_role = [p for p in plans if p["no_current_role"]]
    skipped_recent = [p for p in plans if p["job_skip"] == "recently_verified"]
    unchanged = [p for p in plans if p["job_skip"] == "unchanged"]
    lines = []
    w = lines.append
    w("=" * 78)
    w(f"targets considered            : {len(targets)}")
    w(f"profiles matched              : {len(plans)}")
    w(f"no Crustdata profile          : {len(no_profile)}")
    w(f"job changes to apply          : {len(job_changes)}")
    w(f"unchanged (still in role)     : {len(unchanged)}")
    w(f"skipped, recently verified    : {len(skipped_recent)}")
    w(f"headshots to fill             : {len(headshots)}")
    w(f"no current role (review)      : {len(no_role)}")
    w("=" * 78)

    if job_changes:
        w("")
        w(f"JOB CHANGES ({len(job_changes)})")
        w("")
        for p in job_changes:
            oc, ot, nc, nt, reason = p["job_change"]
            name = p["person"].get("full_name") or p["person"]["id"]
            w(f"  {name}  [{reason}]")
            w(f"    was: {ot or '—'} @ {oc or '—'}")
            w(f"    now: {nt or '—'} @ {nc}")

    if headshots:
        w("")
        w(f"HEADSHOTS TO FILL ({len(headshots)})")
        for p in headshots:
            w(f"  {p['person'].get('full_name') or p['person']['id']}")

    if no_role:
        w("")
        w(f"NO CURRENT ROLE — review, do not auto-archive ({len(no_role)})")
        for p in no_role:
            person = p["person"]
            w(f"  {person.get('full_name') or person['id']}"
              f"  was: {person.get('current_title') or '—'} @ "
              f"{person.get('current_company') or '—'}")

    if skipped_recent:
        w("")
        w(f"RECENTLY VERIFIED — job left alone, still enriching ({len(skipped_recent)})")
        for p in skipped_recent:
            w(f"  {p['person'].get('full_name') or p['person']['id']}")

    if no_profile:
        w("")
        w(f"NO CRUSTDATA PROFILE ({len(no_profile)})")
        for person in no_profile:
            w(f"  {person.get('full_name') or person['id']}  {person.get('linkedin_url')}")

    w("")
    return "\n".join(lines) + "\n"


def apply_plans(plans):
    job_changes = [p for p in plans if p["job_change"]]
    all_roles = []
    for p in plans:
        all_roles.extend(p["roles"])

    print(f"patching {len(plans)} people...")
    for p in plans:
        patch = dict(p["patch"])
        # PostgREST can't take the SQL now() literal through JSON; use today's
        # date for last_verified (already ISO) and a timestamptz for last_enriched.
        if patch.get("last_enriched") == "now()":
            patch["last_enriched"] = datetime.now(timezone.utc).isoformat()
        if patch:
            sb.update("people", {"id": f"eq.{p['person']['id']}"}, patch)

    touched = sorted({r["person_id"] for r in all_roles})
    print(f"writing work_history for {len(touched)} people...")
    for i in range(0, len(touched), 50):
        ids = touched[i:i + 50]
        sb.delete("work_history", {"person_id": f"in.({','.join(ids)})"})
    for i in range(0, len(all_roles), 200):
        sb.insert("work_history", all_roles[i:i + 200], return_rows=False)

    print(f"reclassifying sports_functions for {len(job_changes)} job-changers...")
    for p in job_changes:
        person = p["person"]
        new_co = p["patch"].get("current_company")
        new_title = p["patch"].get("current_title")
        fns = classify_functions(
            new_title, person.get("headline"), new_co, person.get("org_category"),
        )
        if fns:
            sb.update("people", {"id": f"eq.{person['id']}"},
                      {"sports_functions": fns})
    print("done.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write to Supabase (default: dry run)")
    ap.add_argument("--realtime", action="store_true",
                    help="live LinkedIn scrape (5 cr/profile; default is cached at 3)")
    ap.add_argument("--stale-days", type=int, default=0,
                    help="skip people enriched more recently than this many days (0 = everyone)")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    ap.add_argument("--changelog", type=Path,
                    help="write the changelog to this file as well as stdout")
    args = ap.parse_args()

    today = date.today()
    now = datetime.now(timezone.utc)
    targets = select_targets(args.limit, args.stale_days, now)
    print(f"targets: {len(targets)} verified people with a LinkedIn URL "
          f"(stale-days={args.stale_days})")

    profiles, _fetched = fetch_profiles(targets, args.cache, realtime=args.realtime)

    plans, no_profile = [], []
    for t in targets:
        prof = profiles.get(t["id"])
        if not prof:
            no_profile.append(t)
            continue
        plans.append(plan_person(t, prof, today))

    text = format_changelog(plans, targets, no_profile)
    print(text, end="")
    if args.changelog:
        args.changelog.write_text(text)
        print(f"wrote changelog to {args.changelog}")

    if not args.apply:
        print("DRY RUN — nothing written. Re-run with --apply (uses the cache, no extra credits).")
        return

    apply_plans(plans)


if __name__ == "__main__":
    main()
