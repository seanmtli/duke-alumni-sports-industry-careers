#!/usr/bin/env python3
"""
Discover Duke alumni affiliated with sports clubs (DSBC, DSAC, Fuqua MES)
via Crustdata PersonDB: education activities_and_societies + employer names.

Writes:
  - people rows: tag existing verified/review/candidate; insert status=club_alumni
    for net-new Duke alumni; never auto-promote rejected → verified
  - person_clubs affiliations (Supabase table when present, else JSON fallback)
  - discovery_runs log row

Usage:
    python scripts/discover_clubs.py --dry-run
    python scripts/discover_clubs.py --club dsbc --limit 50
    python scripts/discover_clubs.py                 # all clubs, write
    python scripts/discover_clubs.py --files spill.json --club dsac
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import supabase_client as sb
import crustdata_client as cd
from clubs_catalog import CLUBS, CLUBS_BY_SLUG
from employer import pick_primary_employer

REPO = Path(__file__).parent.parent
JSON_PATH = REPO / "src/data/person_clubs.json"
PAGE = 100


def canon_linkedin(u):
    if not u:
        return None
    u = u.strip().split("?")[0].rstrip("/")
    u = re.sub(r"^http://", "https://", u)
    m = re.match(r"(https?://[^/]+)(/.*)?$", u)
    if m:
        return m.group(1).lower() + (m.group(2) or "")
    return u or None


def norm_name(n):
    if not n:
        return ""
    n = re.sub(r"[^a-z ]", "", n.lower())
    return re.sub(r"\s+", " ", n).strip()


def name_keys(n):
    """Keys used for fuzzy person matching (Blade Clark ≈ Blade Clarke)."""
    nm = norm_name(n)
    if not nm:
        return set()
    parts = nm.split()
    keys = {nm}
    if len(parts) >= 2:
        first, last = parts[0], parts[-1]
        keys.add(f"{first} {last}")
        # Stem last name lightly (Clarke/Clark, Edwards/Edward)
        if len(last) > 4 and last.endswith("s"):
            keys.add(f"{first} {last[:-1]}")
        if len(last) > 3:
            keys.add(f"{first} {last[:4]}")
        # Initial + last ("Bryan E" ≈ "Bryan Edwards")
        keys.add(f"{first} {last[0]}")
    return keys


def linkedin_slug(u):
    u = canon_linkedin(u) or ""
    m = re.search(r"/in/([^/]+)/?$", u, re.I)
    return (m.group(1) if m else "") or ""


def is_urn_slug(slug):
    return bool(slug) and slug.lower().startswith("acoa")


def load_duke():
    return {r["entity"] for r in sb.select(
        "duke_school_entities", {"select": "entity", "include": "eq.true"})}


def has_duke(prof, duke_ok):
    for e in prof.get("education_background") or []:
        if e.get("institute_name") in duke_ok:
            return True
    return False


def has_fuqua(prof, duke_ok):
    """True when a Duke include-list education entry looks like Fuqua/MBA."""
    for e in prof.get("education_background") or []:
        inst = e.get("institute_name") or ""
        if inst not in duke_ok:
            continue
        low = inst.lower()
        deg = (e.get("degree_name") or "").lower()
        if "fuqua" in low or "mba" in deg or "business" in low:
            return True
    return False


def activities_text(edu_entry):
    raw = edu_entry.get("activities_and_societies") or ""
    if isinstance(raw, list):
        return " | ".join(str(x) for x in raw)
    return str(raw)


def employer_names(prof):
    names = []
    for key in ("current_employers", "past_employers", "all_employers"):
        for e in prof.get(key) or []:
            n = e.get("name") or e.get("company_name") or e.get("employer_name")
            if n:
                names.append((str(n), e.get("title") or e.get("employee_title")))
    return names


def match_club(prof, club, duke_ok):
    """Return (matched, source, evidence, role_title, confidence) or None."""
    patterns = club["match_patterns"]
    require_fuqua = patterns.get("require_fuqua")

    # Prefer activities on a Duke education row (same-entry when possible).
    for e in prof.get("education_background") or []:
        inst = e.get("institute_name") or ""
        if inst not in duke_ok:
            continue
        text = activities_text(e)
        if not text:
            continue
        low = text.lower()
        for pat in patterns.get("activities") or []:
            if pat.lower() in low:
                if require_fuqua and not has_fuqua(prof, duke_ok):
                    continue
                # Soft role parse from the activities blob
                role = None
                m = re.search(
                    r"(president|co-president|vp|vice president|cabinet|"
                    r"chair|director|treasurer|secretary|founder)[^\n,;|]{0,40}"
                    + re.escape(pat),
                    text,
                    re.I,
                )
                if m:
                    role = m.group(0).strip()[:120]
                return True, "crustdata_activities", text[:500], role, 0.85

    # Employer / experience under the club org
    for name, title in employer_names(prof):
        low = name.lower()
        for pat in patterns.get("employers") or []:
            if pat.lower() in low:
                if require_fuqua and not has_fuqua(prof, duke_ok):
                    continue
                # Avoid Kellogg / other-school "Sports Business Conference" jobs
                # when the pattern is generic — require Duke already passed.
                return True, "crustdata_employer", f"{title or ''} @ {name}".strip(" @"), title, 0.8

    return None


def build_search_filters(club):
    patterns = club["match_patterns"]
    or_conds = []
    for pat in patterns.get("activities") or []:
        or_conds.append({
            "column": "education_background.activities_and_societies",
            "type": "[.]",
            "value": pat,
        })
    for pat in patterns.get("employers") or []:
        or_conds.append({
            "column": "all_employers.name",
            "type": "[.]",
            "value": pat,
        })
    institute = "Fuqua" if patterns.get("require_fuqua") else "Duke"
    return {
        "op": "and",
        "conditions": [
            {"column": "education_background.institute_name", "type": "[.]", "value": institute},
            {"op": "or", "conditions": or_conds},
        ],
    }


def fetch_club_profiles(club, limit=None):
    filters = build_search_filters(club)
    profiles, cursor, total = [], None, None
    fetched = 0
    while True:
        batch, cursor, total = cd.people_search_db(
            filters, limit=PAGE, cursor=cursor)
        profiles.extend(batch)
        fetched += len(batch)
        print(f"  {club['slug']}: fetched {fetched}/{total or '?'} "
              f"(page {len(batch)})", file=sys.stderr)
        if limit and fetched >= limit:
            profiles = profiles[:limit]
            break
        if not batch or not cursor:
            break
    return profiles, total


def read_spill_files(paths):
    profiles = []
    for p in paths:
        data = json.load(open(p))
        if isinstance(data, list):
            profiles.extend(data)
        else:
            profiles.extend(data.get("profiles") or [])
    return profiles


def tables_ready():
    try:
        sb.select("duke_clubs", {"select": "slug", "limit": "1"})
        sb.select("person_clubs", {"select": "id", "limit": "1"})
        return True
    except SystemExit:
        return False


def ensure_club_rows():
    """Return slug -> club_id uuid when tables exist; else {}."""
    if not tables_ready():
        return {}
    existing = {r["slug"]: r["id"] for r in sb.select_all(
        "duke_clubs", {"select": "id,slug"})}
    missing = [c for c in CLUBS if c["slug"] not in existing]
    if missing:
        rows = [{
            "slug": c["slug"],
            "name": c["name"],
            "short_name": c["short_name"],
            "school_scope": c["school_scope"],
            "description": c["description"],
            "sort_order": c["sort_order"],
            "match_patterns": c["match_patterns"],
        } for c in missing]
        inserted = sb.insert("duke_clubs", rows, on_conflict="slug", upsert=True)
        for r in inserted or []:
            existing[r["slug"]] = r["id"]
        # re-read if upsert returned nothing
        if not inserted:
            existing = {r["slug"]: r["id"] for r in sb.select_all(
                "duke_clubs", {"select": "id,slug"})}
    return existing


def load_json_affils():
    if not JSON_PATH.exists():
        return []
    data = json.loads(JSON_PATH.read_text())
    return data.get("affiliations") or []


def save_json_affils(affils):
    JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    JSON_PATH.write_text(json.dumps({
        "affiliations": affils,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "note": (
            "Written by scripts/discover_clubs.py. Synced into Supabase "
            "person_clubs when that table exists."
        ),
    }, indent=2) + "\n")


def upsert_affiliation_json(affils, person_id, club_slug, source, evidence,
                            role_title, confidence, linkedin_url, full_name,
                            directory_status):
    key = (person_id, club_slug)
    out = [a for a in affils if (a.get("person_id"), a.get("club_slug")) != key]
    out.append({
        "person_id": person_id,
        "club_slug": club_slug,
        "source": source,
        "evidence": evidence,
        "role_title": role_title,
        "confidence": confidence,
        "linkedin_url": linkedin_url,
        "full_name": full_name,
        "directory_status": directory_status,
    })
    return out


CLUB_ONLY_STATUS = "club_alumni"
# Fallback while people_status_check has not been migrated to allow club_alumni.
CLUB_ONLY_STATUS_FALLBACK = "candidate"


def resolve_club_only_status():
    """Return a status value the DB will accept for non-directory club members."""
    try:
        rows = sb.insert("people", [{
            "full_name": "__club_status_probe__",
            "status": CLUB_ONLY_STATUS,
            "source": ["probe"],
        }])
        sb.delete("people", {"id": f"eq.{rows[0]['id']}"})
        return CLUB_ONLY_STATUS
    except SystemExit:
        return CLUB_ONLY_STATUS_FALLBACK


def build_person_row(prof, status):
    headline = prof.get("headline")
    cur = pick_primary_employer(prof.get("current_employers"), headline)
    title = cur.get("title") or cur.get("employee_title")
    company = cur.get("company_name") or cur.get("name") or cur.get("employer_name")
    pid = prof.get("person_id")
    source = ["crustdata_clubs"]
    if status in (CLUB_ONLY_STATUS, CLUB_ONLY_STATUS_FALLBACK):
        source.append("club_only")
    return {
        "crustdata_person_id": str(pid) if pid is not None else None,
        "linkedin_url": canon_linkedin(
            prof.get("linkedin_flagship_url") or prof.get("linkedin_profile_url")),
        "full_name": prof.get("name"),
        "headline": headline,
        "current_company": company,
        "current_title": title,
        "location_city": prof.get("location_city"),
        "location_state": prof.get("location_state"),
        "location_country": prof.get("location_country"),
        "headshot_url": (
            prof.get("profile_picture_permalink")
            or prof.get("profile_picture_url")
        ),
        "status": status,
        "confidence": 0.75,
        "source": source,
        "raw_payload": prof,
    }


def index_existing():
    rows = sb.select_all(
        "people",
        {"select": "id,crustdata_person_id,linkedin_url,full_name,status,source"},
    )
    by_pid, by_li, by_slug, by_name = {}, {}, {}, {}
    for r in rows:
        if r.get("crustdata_person_id"):
            by_pid[str(r["crustdata_person_id"])] = r
        li = canon_linkedin(r.get("linkedin_url"))
        if li:
            by_li[li] = r
        slug = linkedin_slug(r.get("linkedin_url"))
        if slug and not is_urn_slug(slug):
            # Prefer vanity slug matches; first writer wins so verified seeds stay
            by_slug.setdefault(slug.lower(), r)
        for key in name_keys(r.get("full_name")):
            # Prefer verified when multiple share a name key
            prev = by_name.get(key)
            if prev is None or (r.get("status") == "verified" and prev.get("status") != "verified"):
                by_name[key] = r
    return by_pid, by_li, by_slug, by_name


def find_existing(prof, by_pid, by_li, by_slug, by_name):
    pid = prof.get("person_id")
    if pid is not None and str(pid) in by_pid:
        return by_pid[str(pid)]
    li = canon_linkedin(
        prof.get("linkedin_flagship_url") or prof.get("linkedin_profile_url"))
    if li and li in by_li:
        return by_li[li]
    slug = linkedin_slug(li)
    if slug and not is_urn_slug(slug) and slug.lower() in by_slug:
        return by_slug[slug.lower()]
    # Fuzzy name — only against verified/review to avoid collapsing unrelated candidates
    for key in name_keys(prof.get("name")):
        hit = by_name.get(key)
        if hit and hit.get("status") in ("verified", "review", "archived"):
            return hit
    return None


def process_club(club, profiles, duke_ok, by_pid, by_li, by_slug, by_name,
                 club_ids, affils, dry_run, stats, club_only_status):
    slug = club["slug"]
    for prof in profiles:
        stats["profiles"] += 1
        if not has_duke(prof, duke_ok):
            stats["duke_guard"] += 1
            continue
        matched = match_club(prof, club, duke_ok)
        if not matched:
            stats["no_match"] += 1
            continue
        _, source, evidence, role_title, confidence = matched
        # Low-confidence generic patterns without Duke in the evidence
        if confidence < 0.7:
            stats["ambiguous"] += 1
            continue

        existing = find_existing(prof, by_pid, by_li, by_slug, by_name)
        name = prof.get("name") or "?"
        li = canon_linkedin(
            prof.get("linkedin_flagship_url") or prof.get("linkedin_profile_url"))

        if existing:
            status = existing["status"]
            person_id = existing["id"]
            if status == "rejected":
                # Keep them off the sports directory, but make them visible on
                # club pages via club_only status (never promote to verified).
                stats["tag_rejected"] += 1
                action = "TAG_REJECTED→CLUB_ONLY"
                new_status = club_only_status
            elif status in ("verified", "review", "candidate", "club_alumni", "archived"):
                stats["tag_existing"] += 1
                action = "TAG"
                new_status = None  # leave status alone
            else:
                stats["tag_existing"] += 1
                action = "TAG"
                new_status = None

            if dry_run:
                print(f"  {action} {name} [{status}] -> {slug}")
            else:
                src = list(existing.get("source") or [])
                tag = f"club:{slug}"
                if tag not in src:
                    src.append(tag)
                if "crustdata_clubs" not in src:
                    src.append("crustdata_clubs")
                patch = {"source": src}
                if new_status:
                    patch["status"] = new_status
                    if "club_only" not in src:
                        src.append("club_only")
                        patch["source"] = src
                    status = new_status
                sb.update("people", {"id": f"eq.{person_id}"}, patch)
                existing["source"] = src
                existing["status"] = status
                if club_ids.get(slug):
                    sb.insert("person_clubs", [{
                        "person_id": person_id,
                        "club_id": club_ids[slug],
                        "source": source,
                        "evidence": evidence,
                        "role_title": role_title,
                        "confidence": confidence,
                    }], on_conflict="person_id,club_id", upsert=True, return_rows=False)
                affils[:] = upsert_affiliation_json(
                    affils, person_id, slug, source, evidence, role_title,
                    confidence, li, name, status)
            continue

        # Net-new → club_only status (club_alumni when constraint allows)
        stats["new_club_alumni"] += 1
        if dry_run:
            print(f"  INSERT {club_only_status} {name} -> {slug}")
            continue

        row = build_person_row(prof, club_only_status)
        row["source"] = list({*row["source"], f"club:{slug}"})
        inserted = sb.insert("people", [row])
        person_id = inserted[0]["id"]
        # Keep indexes warm for later clubs in the same run
        if row.get("crustdata_person_id"):
            by_pid[row["crustdata_person_id"]] = inserted[0]
        if row.get("linkedin_url"):
            by_li[row["linkedin_url"]] = inserted[0]
        slug_li = linkedin_slug(row.get("linkedin_url"))
        if slug_li and not is_urn_slug(slug_li):
            by_slug.setdefault(slug_li.lower(), inserted[0])
        for key in name_keys(row.get("full_name")):
            by_name.setdefault(key, inserted[0])

        if club_ids.get(slug):
            sb.insert("person_clubs", [{
                "person_id": person_id,
                "club_id": club_ids[slug],
                "source": source,
                "evidence": evidence,
                "role_title": role_title,
                "confidence": confidence,
            }], on_conflict="person_id,club_id", upsert=True, return_rows=False)
        affils[:] = upsert_affiliation_json(
            affils, person_id, slug, source, evidence, role_title,
            confidence, li, name, club_only_status)
        print(f"  INSERT {club_only_status} {name} -> {slug}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--club", choices=list(CLUBS_BY_SLUG),
                    help="Only process one club (default: all)")
    ap.add_argument("--files", nargs="+",
                    help="Optional spill JSON files instead of live search")
    ap.add_argument("--limit", type=int, help="Max profiles per club from live search")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    clubs = [CLUBS_BY_SLUG[args.club]] if args.club else CLUBS
    duke_ok = load_duke()
    by_pid, by_li, by_slug, by_name = index_existing()
    club_ids = {} if args.dry_run else ensure_club_rows()
    if not args.dry_run and not club_ids:
        print("NOTE: person_clubs table missing — writing JSON fallback only.",
              file=sys.stderr)
    affils = load_json_affils()
    club_only_status = resolve_club_only_status()
    if club_only_status != CLUB_ONLY_STATUS:
        print(
            f"NOTE: people_status_check does not allow '{CLUB_ONLY_STATUS}' yet; "
            f"using '{club_only_status}' + source club_only. Apply migration "
            f"20260716050000_duke_clubs.sql to enable club_alumni.",
            file=sys.stderr,
        )

    grand = {"profiles": 0, "duke_guard": 0, "no_match": 0, "ambiguous": 0,
             "tag_existing": 0, "tag_rejected": 0, "new_club_alumni": 0}

    for club in clubs:
        print(f"\n=== {club['short_name']} ({club['slug']}) ===", file=sys.stderr)
        if args.files:
            profiles = read_spill_files(args.files)
            total = len(profiles)
        else:
            profiles, total = fetch_club_profiles(club, limit=args.limit)
        stats = {k: 0 for k in grand}
        process_club(club, profiles, duke_ok, by_pid, by_li, by_slug, by_name,
                     club_ids, affils, args.dry_run, stats, club_only_status)
        print(f"  stats: {json.dumps(stats)}", file=sys.stderr)
        for k, v in stats.items():
            grand[k] += v

    print(f"\nTOTAL {json.dumps(grand)}")
    if args.dry_run:
        print("dry run — nothing written.")
        return

    save_json_affils(affils)
    print(f"Wrote {len(affils)} affiliations -> {JSON_PATH}")

    try:
        sb.insert("discovery_runs", [{
            "net": "clubs",
            "filters": {"clubs": [c["slug"] for c in clubs]},
            "results_count": grand["profiles"],
            "new_candidates": grand["new_club_alumni"],
            "credits_est": round(grand["profiles"] / 100 * 3, 1),
            "notes": json.dumps(grand),
        }], return_rows=False)
    except SystemExit as e:
        print(f"WARNING: could not log discovery_runs: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
