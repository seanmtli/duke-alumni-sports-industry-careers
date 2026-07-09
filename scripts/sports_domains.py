#!/usr/bin/env python3
"""
Domain -> sports_companies lookup shared by discover.py and audit_rejected.py.

Why this is not a plain `dict[domain]`: Crustdata reports whatever host a person's
current employer happens to use, and one company answers to many hosts —
`fanduel.careers` vs `fanduel.com`, `careers.nba.com` vs `nba.com`,
`espncareers.com` vs `espn.com`. The old exact `domains[dom]` lookup silently
missed every one of those, so real sports employers were rejected.

Two matching layers, both conservative (curated set, so a hit is almost always
right; we still avoid bare-label / cross-TLD guessing which is where false
positives live):

  1. Exact key match. Keys are each company's primary `domain` PLUS any entry in
     its `aliases` array that looks like a domain (contains a dot). Cross-TLD and
     careers-site variants are handled by listing them explicitly as aliases
     (e.g. FanDuel's aliases carry "fanduel.careers").

  2. Progressive subdomain stripping on the *query*: `careers.nba.com` ->
     `nba.com`, `jobs.us.mlssoccer.com` -> `us.mlssoccer.com` -> `mlssoccer.com`.
     Only leading labels are dropped, so the registrable domain is preserved and
     a subdomain can never match an unrelated company.

Seed domains that carry a path ("nba.com/warriors") are indexed verbatim; they
never matched a bare host before and still don't — no regression.
"""


def norm_domain(d):
    """Lowercase, drop scheme and a trailing slash; keep any path segment."""
    if isinstance(d, (list, tuple)):
        d = d[0] if d else ""
    d = (d or "").strip().lower()
    if "://" in d:
        d = d.split("://", 1)[1]
    return d.strip("/").strip(".")


def build_index(companies):
    """Map every domain-ish key -> its company row.

    `companies` is an iterable of dicts with at least `domain` and `aliases`.
    First writer wins on a key collision so a company's own primary domain is
    never shadowed by another's alias.
    """
    idx = {}
    # Index primary domains first so they take precedence over any alias.
    for c in companies:
        dom = norm_domain(c.get("domain"))
        if dom:
            idx.setdefault(dom, c)
    for c in companies:
        for a in c.get("aliases") or []:
            a = norm_domain(a)
            if a and "." in a:
                idx.setdefault(a, c)
    return idx


def resolve(dom, index):
    """Return the matching company row, or None. `index` is from build_index."""
    dom = norm_domain(dom)
    if not dom:
        return None
    if dom in index:
        return index[dom]
    # Strip leading subdomain labels one at a time: careers.nba.com -> nba.com.
    # Stop before the last two labels so we never collapse to a bare TLD.
    parts = dom.split(".")
    for i in range(1, len(parts) - 1):
        cand = ".".join(parts[i:])
        if cand in index:
            return index[cand]
    return None
