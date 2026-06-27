#!/usr/bin/env python3
"""
One-off: add a hand-curated batch of Duke sports alumni (user-vouched) and promote
matching review-queue records to verified. Idempotent: dedupes on linkedin_url and name.

After running, run enrich.py to fill headshots/locations/degrees/grad-years for the
newly inserted people (those with a linkedin_url).
"""
import re
import supabase_client as sb
from classify import classify_functions

SRC = "manual_curated"


def canon_linkedin(u):
    if not u:
        return None
    u = u.strip().split("?")[0].rstrip("/")
    u = re.sub(r"^http://", "https://", u)
    m = re.match(r"(https?://[^/]+)(/.*)?$", u)
    return (m.group(1).lower() + (m.group(2) or "")) if m else u


# (name, linkedin_url, company, title, org_category, note)
FOUND = [
    ("Adam Grossman", "https://www.linkedin.com/in/ACoAAAfkYUkBJ6xiZwBEuwoQKYgHkTykFUM1aGM",
     "Fenway Sports Group", "Managing Director", "investing_advisory", None),
    ("Ali Curtis", "https://www.linkedin.com/in/ACoAAAOaGVQBT7lffC_klSuiBqnzV1CwC4K0QAo",
     "Major League Soccer", "President, MLS NEXT", "leagues_governing", None),
    ("Ben Berchuck", "https://www.linkedin.com/in/ACoAAAAxV10Bfc1fFsiTQVR9KniRjwjo5OLUzg8",
     "Range Sports", "SVP, Media Consulting", "agencies_rep",
     "Crustdata shows current role as VP/Head of Content Partnerships at FanDuel Sports Network — confirm current employer"),
    ("Chip Krotee", "https://www.linkedin.com/in/ACoAABtLH-ABt9EcPId-woGCdjuwSVCeilokuP4",
     "DSA Labs", "Founder", "sports_tech_data", None),
    ("Davin Bialow", "https://www.linkedin.com/in/ACoAAB8ltTgBMMCM18d-E5isldRAihF9wgGIfOE",
     "Legends", "Associate Director, Finance & Strategy", "infra_experiences", None),
    ("Devon Sinha", "https://www.linkedin.com/in/ACoAACzWQWMBERw8r-5ZPkWpexhUtBTjhMd0i2E",
     "Blitz", "Co-Founder & CEO", "sports_tech_data", None),
    ("Dwight DiPasquale", "https://www.linkedin.com/in/ACoAABlIC4QBihKRqLr7cuxs8fW3tHmhOrmLX0g",
     "Fanatics", "Director, VIP Strategy & Growth", "sports_tech_data", None),
    ("Jared Garten", "https://www.linkedin.com/in/ACoAABTOeU8BdAVlnhbwXU4O2Lqj7qPDJh64D48",
     "Fanatics", "Director, M&A", "sports_tech_data", None),
    ("Laura Gentile", "https://www.linkedin.com/in/ACoAAADbpZsBtlrEsZ1AhVT7hNU1gkXDj3sn8-c",
     "Storied Sports", "Co-Founder & Co-CEO", "investing_advisory", None),
]

# user-vouched but NOT verifiable via Crustdata — insert with a flag, no linkedin
UNVERIFIED = [
    ("Chris Blivin", None, "Major League Soccer",
     "VP, Consumer Products (Gaming, Collectibles & Emerging Technology)", "leagues_governing"),
    ("Omer Atesmen", None, "Snow League", "CEO", "leagues_governing"),
    ("Tejas Srinivasan", None, "Blitz", "Co-Founder", "sports_tech_data"),
]

# already in review queue -> promote to verified, set org + correct role
PROMOTE = [
    ("Doug Perlman", "Sports Media Advisors", "Founder & CEO", "investing_advisory", None),
    ("Peter Land", "", "Sports Industry Executive & Advisor", "investing_advisory",
     "Current employer vague — confirm"),
    ("Ezra Kucharz", "SailGP", "Sports & Media Executive", "investing_advisory",
     "Active across DraftKings / Maximum Effort / SailGP — confirm current employer"),
]


def existing_keys():
    rows = sb.select_all("people", {"select": "id,full_name,linkedin_url"})
    by_li = {canon_linkedin(r["linkedin_url"]): r for r in rows if r.get("linkedin_url")}
    by_name = {}
    for r in rows:
        by_name.setdefault(r["full_name"].lower(), r)
    return by_li, by_name


def main():
    by_li, by_name = existing_keys()
    inserts, skipped, promoted = [], [], []

    def build(name, li, company, title, org, note, verified_duke):
        return {
            "full_name": name,
            "linkedin_url": canon_linkedin(li),
            "current_company": company or None,
            "current_title": title,
            "org_category": org,
            "sports_functions": classify_functions(title, None, company, org),
            "status": "verified",
            "confidence": 1.0 if verified_duke else 0.6,
            "source": [SRC] + ([] if verified_duke else ["needs_duke_verification"]),
            "notes": note,
        }

    for name, li, company, title, org, note in FOUND:
        if canon_linkedin(li) in by_li or name.lower() in by_name:
            skipped.append(name); continue
        inserts.append(build(name, li, company, title, org, note, True))

    for name, li, company, title, org in UNVERIFIED:
        if name.lower() in by_name:
            skipped.append(name); continue
        inserts.append(build(name, li, company, title, org,
                             "User-vouched; Crustdata lookup failed — verify Duke + add LinkedIn",
                             False))

    if inserts:
        sb.insert("people", inserts, return_rows=False)

    for name, company, title, org, note in PROMOTE:
        row = by_name.get(name.lower())
        if not row:
            print(f"  ! promote target not found: {name}"); continue
        patch = {
            "status": "verified", "org_category": org,
            "current_company": company or None, "current_title": title,
            "sports_functions": classify_functions(title, None, company, org),
            "source": [SRC, "promoted_from_review"], "confidence": 1.0,
        }
        if note:
            patch["notes"] = note
        sb.update("people", {"id": f"eq.{row['id']}"}, patch)
        promoted.append(name)

    print(f"inserted: {len(inserts)}  promoted: {len(promoted)}  skipped(existing): {skipped}")


if __name__ == "__main__":
    main()
