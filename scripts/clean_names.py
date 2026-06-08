#!/usr/bin/env python3
"""
Clean the Name column in duke_sports_alumni.csv:
  1. Strip grad year and degree suffixes (data already in Grad Year(s) / Degree(s) columns)
  2. Strip middle names, keeping first + last only

Preserves: parenthetical maiden names "(Mullin)", honorific suffixes "Jr.", "II", "III"

Usage:
    python scripts/clean_names.py --dry-run   # preview changes
    python scripts/clean_names.py             # write to CSV in-place
"""

import argparse
import csv
import re
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
CSV_PATH = REPO_ROOT / "duke_sports_alumni.csv"

# Comma-separated parts after the name core that should be KEPT
KEEP_SUFFIX = re.compile(r"^\s*(Jr\.?|Sr\.?|II|III|IV|V)\s*$", re.IGNORECASE)


def strip_year_degree(raw: str) -> str:
    """Phase 1: Remove year/degree comma-parts, keep honorific suffixes.

    "Michael King, '98"                    → "Michael King"
    "Bobby Sharma, '95, J.D.'98"           → "Bobby Sharma"
    "Frank Fitzgerald, III, '89"           → "Frank Fitzgerald, III"
    "Thomas Bryan Hennessy, II, '16, M.M.S.'17" → "Thomas Bryan Hennessy, II"
    "Daniel Thompson, Ph.D., Ph.D.'88"    → "Daniel Thompson"
    "Ethan Louis Shear, MS, MSQM'23"      → "Ethan Louis Shear"
    """
    parts = raw.split(",")
    core = parts[0].strip()
    kept = [p.strip() for p in parts[1:] if KEEP_SUFFIX.match(p)]
    return (core + ", " + ", ".join(kept)) if kept else core


def strip_middle_name(name: str) -> str:
    """Phase 2: Remove middle name(s) from the cleaned name.

    "Parker Steven Poliakoff"          → "Parker Poliakoff"
    "Christina Lynn Hennessy (Vucich)" → "Christina Hennessy (Vucich)"
    "Thomas Bryan Hennessy, II"        → "Thomas Hennessy, II"
    "Erin Sierer (Mullin)"             → "Erin Sierer (Mullin)"  (2 real words)
    "Harrison K. Yue"                  → "Harrison Yue"
    "Frank Fitzgerald, III"            → "Frank Fitzgerald, III" (2 real words)
    "Katie (Brown) Garmendia"          → "Katie Garmendia"  (paren in middle)
    """
    # Extract trailing honorific suffix after comma: ", II", ", Jr."
    suffix = ""
    if "," in name:
        idx = name.index(",")
        suffix = ", " + name[idx + 1 :].strip()
        name = name[:idx].strip()

    # Remove any parenthetical anywhere in the name, record it for re-appending
    # at the END only if it's a trailing maiden name (i.e. last non-space token)
    maiden = ""
    m_trailing = re.search(r"\s*\([^)]+\)\s*$", name)
    m_middle = re.search(r"\s*\([^)]+\)", name)
    if m_trailing:
        # Trailing paren: "Erin Sierer (Mullin)" — keep, append back after stripping
        maiden = " " + m_trailing.group().strip()
        name = name[: m_trailing.start()].strip()
    elif m_middle:
        # Mid-name paren: "Katie (Brown) Garmendia" — remove entirely
        name = (name[: m_middle.start()] + name[m_middle.end() :]).strip()

    # Strip middle word(s) from the core name if 3+ tokens remain
    parts = name.split()
    if len(parts) >= 3:
        name = parts[0] + " " + parts[-1]

    return name + suffix + maiden


def clean_name(raw: str) -> str:
    return strip_middle_name(strip_year_degree(raw))


def main():
    parser = argparse.ArgumentParser(description="Clean Name column in alumni CSV")
    parser.add_argument("--dry-run", action="store_true", help="Preview only, don't write")
    args = parser.parse_args()

    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
        f.seek(0)
        fieldnames = list(csv.DictReader(f).fieldnames)

    changed = []
    for r in rows:
        original = r["Name"]
        cleaned = clean_name(original)
        if cleaned != original:
            changed.append((original, cleaned))
            r["Name"] = cleaned

    print(f"{len(changed)} names changed:\n")
    for original, cleaned in changed:
        print(f"  {original!r:55s} → {cleaned!r}")

    if args.dry_run:
        print("\nDry run — no changes written.")
        return

    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nWritten to {CSV_PATH}")
    print("Next: run 'python3 scripts/convert_duke_export.py --input duke_sports_alumni.csv'")


if __name__ == "__main__":
    main()
