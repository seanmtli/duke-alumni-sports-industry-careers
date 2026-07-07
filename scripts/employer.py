#!/usr/bin/env python3
"""
Pick a person's PRIMARY current employer from Crustdata's `current_employers`.

Why this exists: Crustdata returns *all* concurrent present-day roles in a
non-deterministic order, so the old `current_employers[0]` (see the pre-fix
discover.py / reverify_leagues.py) could surface a board seat, an advisory gig,
or a part-time "founder coach" contract instead of the person's real job.
Example: Mitch Heath is Co-Founder of Teamworks (since 2011) but also sits on a
nonprofit board and mentors as a "Founder Coach" at Playmakers — `[0]` grabbed
Playmakers.

Rule:
  1. Drop roles whose title looks secondary (board/advisor/mentor/ambassador/
     volunteer/fellow/contract/…) — but only if at least one non-secondary role
     remains, so we never blank out someone whose ONLY current role is advisory.
  2. Among the survivors, keep the most recently started one (real job hops win
     over stale titles). Missing start_date sorts oldest.

Handles both employer schemas in this repo: the discovery spill files use
`title` / `company_name`, while the enrich API uses `employee_title` /
`employer_name`. The chosen dict is returned as-is so callers keep their own
field extraction.
"""
import re

# Title fragments that mark a role as secondary / non-primary. Matched as
# substrings on the lowercased title. Deliberately conservative: "consultant"
# and bare "coach" are excluded because they are often someone's real full-time
# job (a "Head Coach", a management consultant), whereas "founder coach",
# "startup coach", "board member", etc. are near-always side roles.
SECONDARY_TITLE_PATTERNS = (
    "board member",
    "board of director",
    "board of advisor",
    "advisory board",
    "advisor",
    "adviser",
    "mentor",
    "founder coach",
    "startup coach",
    "career coach",
    "ambassador",
    "volunteer",
    "fellow",
    "contributor",
    "angel investor",
    "trustee",
    "emeritus",
    "(contract)",
    "contractor",
    "on contract",
)


def _title(emp):
    return (emp.get("employee_title") or emp.get("title") or "").strip()


def _start(emp):
    # ISO date string; empty string sorts before any real date.
    return (emp.get("start_date") or "")[:10]


def is_secondary_role(emp):
    t = _title(emp).lower()
    if not t:
        return False
    return any(p in t for p in SECONDARY_TITLE_PATTERNS)


def pick_primary_employer(employers):
    """Return the best current employer dict, or {} if the list is empty."""
    emps = [e for e in (employers or []) if isinstance(e, dict) and e]
    if not emps:
        return {}
    primary = [e for e in emps if not is_secondary_role(e)]
    candidates = primary or emps
    # Most recently started real role wins; stable for ties.
    return max(candidates, key=_start)


if __name__ == "__main__":
    # tiny self-check against the Mitch Heath shape
    sample = [
        {"employer_name": "Playmakers by SportsTechX", "employee_title": "Founder Coach",
         "start_date": "2024-01-01T00:00:00+00:00"},
        {"employer_name": "Catholic Charities", "employee_title": "Board Member",
         "start_date": "2023-09-01T00:00:00+00:00"},
        {"employer_name": "Teamworks", "employee_title": "Co-Founder",
         "start_date": "2011-01-01T00:00:00+00:00"},
    ]
    chosen = pick_primary_employer(sample)
    assert chosen["employer_name"] == "Teamworks", chosen
    print("ok:", chosen["employer_name"], "-", chosen["employee_title"])
