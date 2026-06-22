#!/usr/bin/env python3
"""
Rule-based classifier for sports functions (Axis 2) and a light org-category refiner.
Reused by both the Phase-1 backfill (over verified people) and the Phase-4 discovery
pipeline (over fresh candidates).

Signals: current_title (primary), headline, current_company.

Usage:
    python scripts/classify.py --backfill            # tag verified people missing functions
    python scripts/classify.py --backfill --all      # re-tag ALL verified people
    python scripts/classify.py --test "VP, Corporate Partnerships" "Brooklyn Nets"
"""
import argparse
import re
from collections import defaultdict

import supabase_client as sb

# function_key -> list of lowercase keyword/substring signals (matched on title+headline)
FUNCTION_RULES = {
    "front_office": [
        "business operations", "team operations", "basketball operations",
        "football operations", "baseball operations", "hockey operations",
        "general manager", "front office", "business affairs", "chief of staff",
        "chief operating", "president of", " coo", "operations manager",
        "operations associate", "operations coordinator", "club operations",
    ],
    "partnerships": [
        "partnership", "sponsorship", "corporate partner", "global partner",
        "brand partnership", "alliances", "partner marketing", "sponsor",
    ],
    "media_content": [
        "content", "media", "broadcast", "production", "producer", "editorial",
        "video", "studio", "communications", "public relations", "publicist",
        "journalist", "writer", "host", "reporter", "anchor", "creative", " pr ",
        "storytelling", "podcast", "social media",
    ],
    "ticketing_revenue": [
        "ticket", "premium seating", "premium experience", "membership sales",
        "suites", "hospitality sales", "season ticket", "revenue",
    ],
    "data_analytics": [
        "analytics", "data scientist", "data analyst", "insights", "research analyst",
        "quantitative", "scout", "scouting", "player personnel", "performance analyst",
        "machine learning", "statistician", "biomechan",
    ],
    "product_eng": [
        "engineer", "software", "developer", "product manager", "head of product",
        "director of product", "vp product", "vp, product", "technical", "data engineer",
        "platform", "chief technology", " cto", "architect", "devops", "infrastructure",
    ],
    "sales_account": [
        "sales", "account executive", "account manager", "account director",
        "client partner", "client services", "client success", "customer success",
        "business development representative", "sales development", "enterprise account",
    ],
    "strategy_corpdev": [
        "strategy", "strategic", "corporate development", "transformation",
        "consultant", "consulting", "management consult", "chief of staff",
        "business strategy", "operations strategy", "principal,",
    ],
    "marketing_fan": [
        "marketing", "brand manager", "brand director", "fan", "community",
        "engagement", "growth", "crm", "audience", "loyalty", "demand generation",
        "social impact",
    ],
    "investing_deal": [
        "investor", "investment", "venture", "private equity", "growth equity",
        "investment banking", "banker", "capital", "portfolio", "m&a",
        "mergers", "deal", "principal", "managing director",
    ],
    "legal_rep": [
        "legal", "counsel", "attorney", "lawyer", " agent", "talent representation",
        "player representation", "general counsel", "compliance", "associate, law",
    ],
    "health_athlete": [
        "physician", "athletic trainer", "physical therap", "sports medicine",
        "strength and conditioning", "nutrition", "wellness", "team doctor",
        "medical director", "performance coach", "rehabilitation", "dietitian",
    ],
}

# org_category default function fallbacks when nothing matches the title
ORG_DEFAULT_FUNCTION = {
    "leagues_governing": "front_office",
    "teams_clubs": "front_office",
    "betting_gaming": "product_eng",
    "media_broadcast": "media_content",
    "sports_tech_data": "product_eng",
    "big_tech_vertical": "sales_account",
    "agencies_rep": "legal_rep",
    "investing_advisory": "investing_deal",
    "infra_experiences": "front_office",
    "brands_sponsors": "marketing_fan",
    "collegiate": "front_office",
    "nonprofit_other": "front_office",
}


# pure-athlete signals: if the role is ONLY this (no business function), exclude per scope decision
ATHLETE_SIGNALS = [
    "professional athlete", "professional basketball player", "professional football player",
    "professional baseball player", "professional soccer player", "professional hockey player",
    "professional tennis", "professional golfer", "nba player", "nfl player", "mlb player",
    "nhl player", "wnba player", "point guard", "shooting guard", "small forward",
    "power forward", "quarterback", "wide receiver", "running back", "tight end",
    "linebacker", "cornerback", "pitcher", "outfielder", "infielder", "midfielder",
    "goalkeeper", "defenseman", "winger", "pro athlete", "current player",
    "player for", "athlete at", " player;", "roster player",
]
# business-function signals strong enough to keep someone who is ALSO listed as a player
_BUSINESS_HINTS = [
    "manager", "director", "president", "founder", "owner", "partner", "vp",
    "vice president", "head of", "chief", "analyst", "associate", "coordinator",
    "executive", "lead", "counsel", "agent", "scout", "coach", "operations",
    "strategy", "marketing", "sales", "product", "engineer", "consultant",
    "investor", "advisor", "ambassador", "broadcaster", "host", "producer",
]


def is_pure_athlete(title, headline=None):
    """True only when the role looks like an active/ex player with NO business function."""
    text = " " + " ".join(filter(None, [title, headline])).lower() + " "
    if not any(sig in text for sig in ATHLETE_SIGNALS):
        return False
    # keep if a clear business role is also present
    if any(h in text for h in _BUSINESS_HINTS):
        return False
    return True


def classify_functions(title, headline=None, company=None, org_category=None, max_fns=3):
    """Return an ordered, de-duped list of up to max_fns sports-function keys."""
    text = " ".join(filter(None, [title, headline])).lower()
    text = f" {text} "
    scored = []
    for key, signals in FUNCTION_RULES.items():
        hits = sum(1 for s in signals if s in text)
        if hits:
            scored.append((hits, key))
    scored.sort(reverse=True)
    fns = [k for _, k in scored][:max_fns]
    if not fns and org_category in ORG_DEFAULT_FUNCTION:
        fns = [ORG_DEFAULT_FUNCTION[org_category]]
    return fns


def backfill(retag_all=False):
    people = sb.select("people", {
        "select": "id,current_title,headline,current_company,org_category,sports_functions",
        "status": "eq.verified",
    })
    by_fns = defaultdict(list)
    untagged = 0
    for p in people:
        if not retag_all and p.get("sports_functions"):
            continue
        fns = classify_functions(
            p.get("current_title"), p.get("headline"),
            p.get("current_company"), p.get("org_category"),
        )
        if not fns:
            untagged += 1
        by_fns[tuple(fns)].append(p["id"])

    updated = 0
    for fns, ids in by_fns.items():
        if not fns:
            continue
        # batch PATCH in chunks via id=in.(...)
        for i in range(0, len(ids), 100):
            chunk = ids[i:i + 100]
            sb.update("people",
                      {"id": f"in.({','.join(chunk)})"},
                      {"sports_functions": list(fns)})
            updated += len(chunk)
    print(f"people considered: {len(people)}  updated: {updated}  left untagged: {untagged}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--backfill", action="store_true")
    ap.add_argument("--all", action="store_true", help="re-tag all (not just empty)")
    ap.add_argument("--test", nargs="+", help="title [company]")
    args = ap.parse_args()
    if args.test:
        title = args.test[0]
        company = args.test[1] if len(args.test) > 1 else None
        print(classify_functions(title, company=company))
    elif args.backfill:
        backfill(retag_all=args.all)
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
