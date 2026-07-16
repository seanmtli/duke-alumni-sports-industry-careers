#!/usr/bin/env python3
"""
Apply the duke_clubs / person_clubs migration.

Prefers SUPABASE_DB_URL (Postgres connection string). Falls back to printing
the SQL for paste into the Supabase SQL editor when no DB URL is available
(service-role REST cannot run DDL).

Usage:
    python scripts/apply_club_schema.py
    python scripts/apply_club_schema.py --check
"""
import argparse
import os
import sys
from pathlib import Path

import supabase_client as sb

REPO = Path(__file__).parent.parent
MIGRATION = REPO / "supabase/migrations/20260716050000_duke_clubs.sql"


def tables_exist():
    try:
        sb.select("duke_clubs", {"select": "slug", "limit": "1"})
        sb.select("person_clubs", {"select": "id", "limit": "1"})
        return True
    except SystemExit:
        return False


def apply_via_psycopg():
    dsn = os.environ.get("SUPABASE_DB_URL") or os.environ.get("DATABASE_URL")
    if not dsn:
        return False
    try:
        import psycopg2
    except ImportError:
        print("psycopg2 not installed; cannot apply via SUPABASE_DB_URL", file=sys.stderr)
        return False
    sql = MIGRATION.read_text()
    conn = psycopg2.connect(dsn)
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
    finally:
        conn.close()
    return True


def seed_via_rest_if_empty():
    """If tables exist but have no rows, seed club catalog via REST."""
    rows = sb.select("duke_clubs", {"select": "slug"})
    if rows:
        print(f"duke_clubs already has {len(rows)} row(s).")
        return
    # Re-run seed portion by inserting from the TypeScript-mirrored catalog
    from clubs_catalog import CLUBS
    payload = []
    for c in CLUBS:
        payload.append({
            "slug": c["slug"],
            "name": c["name"],
            "short_name": c["short_name"],
            "school_scope": c["school_scope"],
            "description": c["description"],
            "sort_order": c["sort_order"],
            "match_patterns": c["match_patterns"],
        })
    sb.insert("duke_clubs", payload, on_conflict="slug", upsert=True, return_rows=False)
    print(f"Seeded {len(payload)} clubs via REST.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="Only report whether tables exist")
    args = ap.parse_args()

    if tables_exist():
        print("OK: duke_clubs and person_clubs exist.")
        if not args.check:
            seed_via_rest_if_empty()
        return

    if args.check:
        print("MISSING: duke_clubs / person_clubs not found.")
        sys.exit(1)

    if apply_via_psycopg():
        print("Applied migration via SUPABASE_DB_URL.")
        if tables_exist():
            print("OK: tables are queryable.")
            return
        print("WARNING: applied SQL but REST still cannot see tables (schema cache?).")
        return

    print(
        "Cannot apply DDL with the service-role REST key.\n"
        "Set SUPABASE_DB_URL to a Postgres connection string, or paste this\n"
        f"migration into the Supabase SQL editor:\n  {MIGRATION}\n"
    )
    print("--- SQL begin ---")
    print(MIGRATION.read_text())
    print("--- SQL end ---")
    sys.exit(2)


if __name__ == "__main__":
    main()
