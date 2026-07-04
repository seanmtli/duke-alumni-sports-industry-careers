#!/usr/bin/env python3
"""
Export all rejected people to a CSV for offline review:
name, employer, Duke grad year, Duke degree(s), job title, profile headline, LinkedIn, reason.

Usage: python scripts/export_rejected_csv.py
Output: rejected_alumni.csv (repo root)
"""
import csv
from pathlib import Path

import supabase_client as sb

OUT = Path(__file__).parent.parent / "rejected_alumni.csv"


def reason_of(p):
    src = p.get("source") or []
    notes = (p.get("notes") or "").lower()
    if "duplicate" in src or "duplicate" in notes:
        return "duplicate of existing record"
    if "left-sports" in notes or "student-athlete" in notes:
        return "left sports / no current sports signal"
    if "non-degree" in notes:
        return "non-degree Duke tie (course/cert/exchange)"
    if "current student" in notes:
        return "current student"
    if "reviewed_reject" in src:
        return "manual review"
    return "other"


def primary(degs):
    withyr = [d for d in degs if d.get("grad_year")]
    return min(withyr, key=lambda d: d["grad_year"]) if withyr else (degs[0] if degs else None)


def main():
    people = sb.select_all("people", {
        "select": "id,full_name,current_company,current_title,headline,linkedin_url,notes,source",
        "status": "eq.rejected",
    })
    degs = sb.select_all("duke_degrees", {"select": "person_id,school,degree,grad_year,major"})
    by_person = {}
    for d in degs:
        by_person.setdefault(d["person_id"], []).append(d)

    rows = []
    for p in people:
        pd = by_person.get(p["id"], [])
        prim = primary(pd)
        all_deg = "; ".join(
            f"{d.get('school') or ''} {d.get('degree') or ''}".strip()
            + (f" ({d['grad_year']})" if d.get("grad_year") else "")
            for d in pd
        )
        rows.append({
            "Name": p.get("full_name"),
            "Employer": p.get("current_company") or "",
            "Duke Grad Year": (prim or {}).get("grad_year") or "",
            "Duke School": (prim or {}).get("school") or "",
            "Duke Degree(s)": all_deg,
            "Job Title": p.get("current_title") or "",
            "Profile Headline": p.get("headline") or "",
            "LinkedIn": p.get("linkedin_url") or "",
            "Reject Reason": reason_of(p),
        })

    rows.sort(key=lambda r: (r["Name"] or "").lower())
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {len(rows)} rejected records -> {OUT}")


if __name__ == "__main__":
    main()
