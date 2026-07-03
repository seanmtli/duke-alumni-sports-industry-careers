#!/usr/bin/env python3
"""
Find likely duplicates: verified people who came from discovery/curation (non-seed)
whose name matches a seed_verified person. Token-set based so it catches maiden names,
credentials, and middle initials.

Prints candidate dup pairs; does NOT modify anything.
"""
import re
import supabase_client as sb

# credential / suffix tokens to drop before comparing
STOP = {
    "phd","md","dpt","pt","atc","lat","scs","cscs","mba","ma","ms","edd","edm","oly",
    "jr","sr","ii","iii","iv","mmci","ocs","comt","cci","ces","rn","otd","otr","dba",
    "esq","cpa","cfa","dr","mbe","pmp","hsc","mph","faan","bsn","med","msc","do","dds",
    "aasp","cmpc","llm","jd","ba","bs","ab","the","de","van","von",
}


def tokens(name):
    name = re.sub(r"\(.*?\)", " ", name or "")          # drop parenthetical (maiden)
    name = re.sub(r"[^a-zA-Z ]", " ", name).lower()
    toks = [t for t in name.split() if len(t) > 1 and t not in STOP]
    return set(toks)


def main():
    people = sb.select_all("people", {"select": "id,full_name,status,current_company,source"})
    verified = [p for p in people if p["status"] == "verified"]
    seed = [p for p in verified if "seed_verified" in (p.get("source") or [])]
    nonseed = [p for p in verified if "seed_verified" not in (p.get("source") or [])]

    seed_tok = [(p, tokens(p["full_name"])) for p in seed]
    hits = []
    for p in nonseed:
        pt = tokens(p["full_name"])
        if len(pt) < 2:
            continue
        for s, st in seed_tok:
            if len(st) < 2:
                continue
            # duplicate if one token set is a subset of the other (shared first+last at least)
            if pt <= st or st <= pt:
                hits.append((p, s))
                break

    print(f"verified: {len(verified)}  seed: {len(seed)}  non-seed: {len(nonseed)}")
    print(f"potential duplicates: {len(hits)}\n")
    for p, s in hits:
        print(f"  DUP  '{p['full_name']}' ({p.get('current_company')})")
        print(f"   vs seed '{s['full_name']}' ({s.get('current_company')})   [reject id {p['id']}]")


if __name__ == "__main__":
    main()
