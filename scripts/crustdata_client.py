#!/usr/bin/env python3
"""
Tiny stdlib-only Crustdata REST client. Reads CRUSTDATA_API_KEY from env / .env
(loaded via supabase_client's dotenv pass).

Endpoints used:
  - person enrich:  GET /screener/person/enrich?linkedin_profile_url=<csv>&fields=...
"""
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request

import supabase_client  # noqa: F401  (triggers .env load)

API = "https://api.crustdata.com"
TOKEN = os.environ.get("CRUSTDATA_API_KEY", "")


def _require():
    if not TOKEN:
        raise SystemExit(
            "Missing CRUSTDATA_API_KEY. Add to .env:\n  CRUSTDATA_API_KEY=<token>")


def _get(path, params, retries=3):
    _require()
    url = f"{API}{path}?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={
        "Authorization": f"Token {TOKEN}",
        "Accept": "application/json",
    })
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            if e.code in (429, 500, 502, 503) and attempt < retries - 1:
                time.sleep(2 * (attempt + 1))
                continue
            raise SystemExit(f"Crustdata GET {path} failed: {e.code} {body}")
        except urllib.error.URLError:
            if attempt < retries - 1:
                time.sleep(2 * (attempt + 1))
                continue
            raise


def _post(path, body, retries=3):
    _require()
    url = f"{API}{path}"
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method="POST", headers={
        "Authorization": f"Token {TOKEN}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    })
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            body_txt = e.read().decode()
            if e.code in (429, 500, 502, 503) and attempt < retries - 1:
                time.sleep(2 * (attempt + 1))
                continue
            raise SystemExit(f"Crustdata POST {path} failed: {e.code} {body_txt}")
        except urllib.error.URLError:
            if attempt < retries - 1:
                time.sleep(2 * (attempt + 1))
                continue
            raise


def enrich_people(linkedin_urls, fields=None, realtime=False):
    """Enrich up to 25 LinkedIn URLs. Returns a list of profile dicts."""
    params = {"linkedin_profile_url": ",".join(linkedin_urls)}
    if realtime:
        params["enrich_realtime"] = "True"
    if fields:
        params["fields"] = ",".join(fields)
    data = _get("/screener/person/enrich", params)
    # response may be a bare list, or {profiles:[...]} / {data:[...]}
    if isinstance(data, list):
        return data
    for k in ("profiles", "data", "results"):
        if isinstance(data, dict) and isinstance(data.get(k), list):
            return data[k]
    return [data] if isinstance(data, dict) else []


def people_search_db(filters, limit=100, cursor=None, fields=None):
    """Legacy PersonDB search (column/type/value filters).

    Returns (profiles, next_cursor, total_count). Endpoint matches the MCP
    people_search_db tool used by the discovery pipeline.
    """
    body = {"filters": filters, "limit": limit}
    if cursor:
        body["cursor"] = cursor
    if fields:
        body["fields"] = fields if isinstance(fields, str) else ",".join(fields)
    data = _post("/screener/persondb/search", body)
    if isinstance(data, list):
        return data, None, len(data)
    profiles = []
    for k in ("profiles", "data", "results", "persons"):
        if isinstance(data, dict) and isinstance(data.get(k), list):
            profiles = data[k]
            break
    next_cursor = (
        (data or {}).get("next_cursor")
        or (data or {}).get("cursor")
        or (data or {}).get("next")
    )
    total = (data or {}).get("total_count") or (data or {}).get("total") or len(profiles)
    return profiles, next_cursor, total


def enrich_companies(domains=None, names=None):
    """Enrich up to 25 companies by domain or name. Returns a list of company
    dicts (basic + firmographics bundle, including linkedin_logo_url)."""
    params = {}
    if domains:
        params["company_domain"] = ",".join(domains)
    if names:
        params["company_name"] = ",".join(names)
    if not params:
        return []
    data = _get("/screener/company/enrich", params)
    if isinstance(data, list):
        return data
    for k in ("companies", "data", "results"):
        if isinstance(data, dict) and isinstance(data.get(k), list):
            return data[k]
    return [data] if isinstance(data, dict) else []
