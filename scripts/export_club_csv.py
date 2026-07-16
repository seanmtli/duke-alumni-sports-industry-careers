#!/usr/bin/env python3
"""
Export per-club CSVs for leadership gap-fill.

Columns: full_name, linkedin_url, directory_status, source, evidence, role_title,
already_in_sports_directory (yes/no).

Usage:
    python scripts/export_club_csv.py
    python scripts/export_club_csv.py --club dsbc --out /tmp/dsbc.csv
"""
import argparse
import csv
import json
import sys
from pathlib import Path

import supabase_client as sb
from clubs_catalog import CLUBS, CLUBS_BY_SLUG

REPO = Path(__file__).parent.parent
JSON_PATH = REPO / "src/data/person_clubs.json"
OUT_DIR = REPO / "scripts/data/club_exports"


def load_affils():
    # Prefer Supabase person_clubs when present
    try:
        rows = sb.select_all("person_clubs", {
            "select": (
                "person_id,source,evidence,role_title,confidence,"
                "duke_clubs(slug),people(full_name,linkedin_url,status)"
            ),
        })
        if rows:
            out = []
            for r in rows:
                person = r.get("people") or {}
                club = r.get("duke_clubs") or {}
                out.append({
                    "person_id": r.get("person_id"),
                    "club_slug": club.get("slug"),
                    "source": r.get("source"),
                    "evidence": r.get("evidence"),
                    "role_title": r.get("role_title"),
                    "full_name": person.get("full_name"),
                    "linkedin_url": person.get("linkedin_url"),
                    "directory_status": person.get("status"),
                })
            return out
    except SystemExit:
        pass

    if not JSON_PATH.exists():
        return []
    return json.loads(JSON_PATH.read_text()).get("affiliations") or []


def write_csv(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "full_name", "linkedin_url", "directory_status",
        "already_in_sports_directory", "source", "evidence", "role_title",
        "person_id", "club_slug",
    ]
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in rows:
            status = r.get("directory_status") or ""
            w.writerow({
                "full_name": r.get("full_name") or "",
                "linkedin_url": r.get("linkedin_url") or "",
                "directory_status": status,
                "already_in_sports_directory": "yes" if status == "verified" else "no",
                "source": r.get("source") or "",
                "evidence": (r.get("evidence") or "").replace("\n", " ")[:300],
                "role_title": r.get("role_title") or "",
                "person_id": r.get("person_id") or "",
                "club_slug": r.get("club_slug") or "",
            })
    print(f"Wrote {len(rows)} rows -> {path}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--club", choices=list(CLUBS_BY_SLUG))
    ap.add_argument("--out", help="Single output CSV path (requires --club)")
    args = ap.parse_args()

    affils = load_affils()
    if not affils:
        print("No affiliations found. Run discover_clubs.py first.", file=sys.stderr)
        sys.exit(1)

    clubs = [CLUBS_BY_SLUG[args.club]] if args.club else CLUBS
    for club in clubs:
        rows = [a for a in affils if a.get("club_slug") == club["slug"]]
        rows.sort(key=lambda r: (r.get("full_name") or "").lower())
        if args.out:
            if not args.club:
                print("--out requires --club", file=sys.stderr)
                sys.exit(2)
            path = Path(args.out)
        else:
            path = OUT_DIR / f"{club['slug']}.csv"
        write_csv(path, rows)


if __name__ == "__main__":
    main()
