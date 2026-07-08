#!/usr/bin/env python3
"""
Pick a person's PRIMARY current employer from Crustdata's `current_employers`.

Why this exists: Crustdata returns *all* concurrent present-day roles in a
non-deterministic order, so the old `current_employers[0]` (see the pre-fix
discover.py / reverify_leagues.py) could surface a board seat, an advisory gig,
an adjunct professorship, or a part-time "founder coach" contract instead of the
person's real job. The same profile can even come back in a different order on
two different calls: Alex Kerr's stored raw_payload has northwestern.edu at [0],
while a live enrich put georgetown.edu there.

This mis-pick is not cosmetic. discover.py decides Tier A (auto-publish) by
whether the *chosen* employer's domain is sports-native, so a bad [0] gets real
alumni rejected outright. Scott Lewis (VP Business Intelligence, NYCFC) and Alex
Kerr (CEO, Trajektory) were both rejected because [0] was a university.

Rule:
  1. Drop roles whose title looks secondary (board/advisor/mentor/ambassador/
     adjunct/professor/volunteer/fellow/contract/…) — but only if at least one
     non-secondary role remains, so we never blank out someone whose ONLY
     current role is academic or advisory (a real professor keeps their chair).
  2. If one survivor remains, take it.
  3. Else prefer the survivor named in the person's LinkedIn headline. The
     headline is self-authored and names the job people actually identify with:
     Kelsey McDonald's reads "Strategy & Business Intelligence, New York
     Yankees"; Alex Kerr's reads "CEO / Data Nerd @ Trajektory".
  4. Else fall back to the most recently started role.

Note on step 4: it must not come earlier. Kelsey McDonald started at the Yankees
in 2024-09 and picked up an adjunct post in 2026-01 — "most recently started"
alone picks the adjunct gig, which is exactly the bug being reported.

Handles both employer schemas in this repo: the discovery spill files use
`title` / `company_name` / `company_website_domain` (and carry NO dates), while
the enrich API uses `employee_title` / `employer_name` / `start_date`. The
chosen dict is returned as-is so callers keep their own field extraction.
"""
import re

# Title fragments that mark a role as secondary / non-primary. Matched on WORD
# BOUNDARIES, not as bare substrings — "intern" must not fire on "International
# Scout" or "Senior Analyst, International Strategy", both of which are real jobs
# that a substring match demoted. Deliberately conservative: "consultant" and
# bare "coach" are excluded because they are often someone's real full-time job
# (a "Head Coach", a management consultant), whereas "founder coach", "board
# member", "adjunct professor", etc. are near-always side roles.
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
    "intern",
    "internship",
    # Academic SIDE GIGS only. Sports-industry people teach a class at a local
    # university constantly; it is almost never the job they'd name first.
    # Note the deliberate absence of a bare "professor": an Assistant/Associate/
    # Clinical Professor is a real full-time job (Kevin Wilson is genuinely an
    # Assistant Professor of Sport Management), whereas an *adjunct* professor,
    # lecturer, or instructor is moonlighting. Guarded further by rule 1 — an
    # academic with no other current role always keeps their title.
    "adjunct",
    "lecturer",
    "instructor",
    "teaching",
    "visiting professor",
)

# Tokens that mark a title as somebody's real job even if a secondary pattern
# also appears inside it. "Director, Trustee & Donor Engagement" at the USOPC is
# a fundraising directorship, not a board seat — but it contains "trustee".
REAL_ROLE_TOKENS = (
    "director",
    "vice president",
    "president",
    "chief",
    "head of",
    "manager",
    "engineer",
    "coordinator",
    "counsel",
    "officer",
)

# Word-boundary matcher. Lookarounds rather than \b so that patterns starting or
# ending in punctuation — "(contract)" — still anchor correctly. A trailing "s?"
# picks up plurals ("Board Members", "Fellows") without matching "International".
_SECONDARY_RE = re.compile(
    "|".join(rf"(?<!\w){re.escape(p)}s?(?!\w)" for p in SECONDARY_TITLE_PATTERNS),
    re.I,
)
_REAL_ROLE_RE = re.compile(
    "|".join(rf"(?<!\w){re.escape(t)}s?(?!\w)" for t in REAL_ROLE_TOKENS),
    re.I,
)

# Strip a domain down to its distinctive token: "newyorkcityfc.com" -> "newyorkcityfc"
_DOMAIN_TAIL = re.compile(r"\.(com|org|net|edu|gov|io|co|tv|us|uk)$", re.I)
_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def _title(emp):
    return (emp.get("employee_title") or emp.get("title") or "").strip()


def _name(emp):
    """Best available employer name; falls back to the domain's distinctive token."""
    n = (emp.get("employer_name") or emp.get("company_name") or "").strip()
    if n:
        return n
    dom = emp.get("company_website_domain") or emp.get("employer_company_website_domain") or ""
    if isinstance(dom, (list, tuple)):
        dom = dom[0] if dom else ""
    dom = (dom or "").strip().lower()
    return _DOMAIN_TAIL.sub("", dom)


def _start(emp):
    # ISO date string; empty string sorts before any real date.
    return (emp.get("start_date") or "")[:10]


def _squash(s):
    return _NON_ALNUM.sub("", (s or "").lower())


def is_secondary_role(emp):
    """Aggressive: used to DEMOTE candidates when choosing among concurrent roles."""
    t = _title(emp)
    return bool(t) and bool(_SECONDARY_RE.search(t))


def is_clearly_side_role(emp):
    """Conservative: used to decide whether an ALREADY-STORED title is wrong.

    Overwriting a stored value needs a higher bar than ranking two candidates,
    so a title carrying a real-role token is never treated as a side gig here.
    """
    if not is_secondary_role(emp):
        return False
    return not _REAL_ROLE_RE.search(_title(emp))


def _headline_match(emp, headline_squashed):
    """True when this employer's name or title is named in the person's headline."""
    if not headline_squashed:
        return False
    name = _squash(_name(emp))
    if name and len(name) >= 4 and name in headline_squashed:
        return True
    title = _squash(_title(emp))
    return bool(title and len(title) >= 6 and title in headline_squashed)


def pick_primary_employer(employers, headline=None):
    """Return the best current employer dict, or {} if the list is empty."""
    emps = [e for e in (employers or []) if isinstance(e, dict) and e]
    if not emps:
        return {}

    primary = [e for e in emps if not is_secondary_role(e)]
    candidates = primary or emps
    if len(candidates) == 1:
        return candidates[0]

    hl = _squash(headline)
    named = [e for e in candidates if _headline_match(e, hl)]
    if len(named) == 1:
        return named[0]
    if len(named) > 1:
        candidates = named  # headline narrowed it; break the remaining tie by date

    # Most recently started real role wins; stable for ties (max keeps the first).
    return max(candidates, key=_start)


if __name__ == "__main__":
    # Mitch Heath: real job is buried behind a mentorship and a board seat.
    mitch = [
        {"employer_name": "Playmakers by SportsTechX", "employee_title": "Founder Coach",
         "start_date": "2024-01-01T00:00:00+00:00"},
        {"employer_name": "Catholic Charities", "employee_title": "Board Member",
         "start_date": "2023-09-01T00:00:00+00:00"},
        {"employer_name": "Teamworks", "employee_title": "Co-Founder",
         "start_date": "2011-01-01T00:00:00+00:00"},
    ]
    assert _name(pick_primary_employer(mitch)) == "Teamworks", pick_primary_employer(mitch)

    # Kelsey McDonald: the adjunct post started MORE RECENTLY than the real job,
    # so a date-only rule picks wrong. This is the reported bug.
    kelsey = [
        {"employer_name": "New York Yankees",
         "employee_title": "Senior Manager, Strategy & Business Intelligence",
         "start_date": "2024-09-01T00:00:00+00:00"},
        {"employer_name": "St. John's University",
         "employee_title": "Adjunct Professor - Sports Analytics",
         "start_date": "2026-01-01T00:00:00+00:00"},
    ]
    assert _name(pick_primary_employer(kelsey, "Strategy & Business Intelligence, New York Yankees")) \
        == "New York Yankees", pick_primary_employer(kelsey)
    # ...and it must still resolve correctly with NO headline to lean on.
    assert _name(pick_primary_employer(kelsey)) == "New York Yankees"

    # Scott Lewis, as actually stored in people.raw_payload: domains only, no dates.
    scott = [
        {"title": "Adjunct Professor", "company_website_domain": "columbia.edu"},
        {"title": "Adjunct Professor", "company_website_domain": "gwu.edu"},
        {"title": "Vice President Business Intelligence", "company_website_domain": "newyorkcityfc.com"},
    ]
    assert _name(pick_primary_employer(scott)) == "newyorkcityfc", pick_primary_employer(scott)

    # Alex Kerr, same shape.
    alex = [
        {"title": "Adjunct Professor", "company_website_domain": "northwestern.edu"},
        {"title": "CEO & Founder", "company_website_domain": "trajektory.com"},
        {"title": "Adjunct Professor", "company_website_domain": "georgetown.edu"},
    ]
    assert _name(pick_primary_employer(alex)) == "trajektory", pick_primary_employer(alex)

    # Guard: someone whose ONLY current role is academic keeps it.
    prof_only = [{"employer_name": "Duke University", "employee_title": "Professor of the Practice"}]
    assert _name(pick_primary_employer(prof_only)) == "Duke University"

    # Guard: two real concurrent roles, disambiguated purely by headline.
    two_real = [
        {"employer_name": "Sports Media Advisors", "employee_title": "Founder",
         "start_date": "2012-01-01T00:00:00+00:00"},
        {"employer_name": "SailGP", "employee_title": "Chief Commercial Officer",
         "start_date": "2020-01-01T00:00:00+00:00"},
    ]
    assert _name(pick_primary_employer(two_real, "Founder & CEO at Sports Media Advisors")) \
        == "Sports Media Advisors"

    # --- is_clearly_side_role: the bar for OVERWRITING a stored title ---

    # Real jobs that merely contain a secondary substring must not be overwritten.
    for real in (
        "Director, Trustee & Donor Engagement",       # USOPC — contains "trustee"
        "Assistant Professor in Sport Management",    # tenure-track, not moonlighting
        "Clinical Professor",
        "Head of Advisory Services",                  # contains "advisor"
        "Chief Investment Officer",
        # Word-boundary regressions: "intern" hides inside "International".
        "International Scout - Men's National Team",
        "Senior Analyst, International Strategy",
    ):
        assert not is_clearly_side_role({"title": real}), real

    # ...and the same two must not be demoted when ranking candidates either.
    assert not is_secondary_role({"title": "International Scout - Men's National Team"})
    assert not is_secondary_role({"title": "Senior Analyst, International Strategy"})
    assert is_secondary_role({"title": "Summer Intern"})
    assert is_secondary_role({"title": "Marketing Interns"})

    # Genuine side gigs, which we WILL overwrite when a real job is available.
    for side in (
        "Adjunct Professor - Sports Analytics",       # Kelsey McDonald
        "Adjunct Professor",                          # Scott Lewis, Alex Kerr
        "Board Member",
        "Foundation Board Member",
        "Senior Advisor",
        "She Champion Mentor",
        "MBA Fellow",
        "Corporate Strategy Intern",
    ):
        assert is_clearly_side_role({"title": side}), side

    print("ok: all primary-employer cases pass")
