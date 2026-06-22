#!/usr/bin/env python3
"""
Tiny stdlib-only Supabase REST (PostgREST) client shared by the data scripts.

Credentials are read from the environment or a local .env file (gitignored):
    SUPABASE_URL=https://<ref>.supabase.co
    SUPABASE_SERVICE_KEY=<service_role key>   # bypasses RLS; server-side only

No third-party packages required (urllib + json).
"""
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO = Path(__file__).parent.parent


def _load_dotenv():
    env_path = REPO / ".env"
    if not env_path.exists():
        env_path = REPO / ".env.local"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")


def _require_creds():
    if not SUPABASE_URL or not SERVICE_KEY:
        raise SystemExit(
            "Missing SUPABASE_URL / SUPABASE_SERVICE_KEY.\n"
            "Add them to a .env file in the repo root (gitignored):\n"
            "  SUPABASE_URL=https://<ref>.supabase.co\n"
            "  SUPABASE_SERVICE_KEY=<service_role key>"
        )


def _headers(extra=None):
    h = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    if extra:
        h.update(extra)
    return h


def _request(method, path, params=None, body=None, headers=None):
    _require_creds()
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params, doseq=True)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=_headers(headers))
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raise SystemExit(f"Supabase {method} {path} failed: {e.code} {e.read().decode()}")


def insert(table, rows, on_conflict=None, return_rows=True, upsert=False):
    """Bulk insert/upsert. Returns inserted rows when return_rows."""
    if not rows:
        return []
    params = {}
    prefer = []
    if return_rows:
        prefer.append("return=representation")
    if upsert:
        prefer.append("resolution=merge-duplicates")
    if on_conflict:
        params["on_conflict"] = on_conflict
    headers = {"Prefer": ",".join(prefer)} if prefer else None
    return _request("POST", table, params=params, body=rows, headers=headers) or []


def select(table, params=None):
    return _request("GET", table, params=params) or []


def select_all(table, params=None, page=1000):
    """Paginate through ALL rows (PostgREST caps a single response at 1000)."""
    out, offset = [], 0
    base = dict(params or {})
    while True:
        p = dict(base)
        p["limit"] = page
        p["offset"] = offset
        batch = _request("GET", table, params=p) or []
        out.extend(batch)
        if len(batch) < page:
            break
        offset += page
    return out


def update(table, params, patch):
    return _request("PATCH", table, params=params, body=patch,
                    headers={"Prefer": "return=representation"}) or []


def delete(table, params):
    return _request("DELETE", table, params=params)


def count(table, params=None):
    p = dict(params or {})
    p["select"] = "id"
    res = _request("GET", table, params=p,
                   headers={"Prefer": "count=exact", "Range-Unit": "items", "Range": "0-0"})
    return len(res) if isinstance(res, list) else 0
