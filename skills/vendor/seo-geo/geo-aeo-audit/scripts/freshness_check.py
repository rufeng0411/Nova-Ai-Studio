#!/usr/bin/env python3
"""
freshness_check — evidence collector

Extracts dateModified / datePublished / article:modified_time and computes
content age in days. Empirical: content <30 days old receives 3.2× more
citations.
Stdlib only.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any


_JSON_LD_RE = re.compile(
    r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    re.IGNORECASE | re.DOTALL,
)
_META_MOD_RE = re.compile(
    r'<meta[^>]+property=["\']article:modified_time["\'][^>]+content=["\']([^"\']+)["\']',
    re.IGNORECASE,
)
_META_PUB_RE = re.compile(
    r'<meta[^>]+property=["\']article:published_time["\'][^>]+content=["\']([^"\']+)["\']',
    re.IGNORECASE,
)
_TIME_TAG_RE = re.compile(
    r'<time\b[^>]*\bdatetime=["\']([^"\']+)["\']',
    re.IGNORECASE,
)


def _try_parse_date(s: str) -> datetime | None:
    """Try multiple ISO-8601-ish date formats."""
    s = s.strip()
    fmts = [
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d",
        "%Y/%m/%d",
    ]
    for fmt in fmts:
        try:
            dt = datetime.strptime(s.replace("Z", "+0000"), fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue
    return None


def _walk(node: Any, key: str) -> Any:
    """Find first occurrence of key recursively in a JSON-LD structure."""
    if isinstance(node, dict):
        if key in node:
            return node[key]
        for v in node.values():
            r = _walk(v, key)
            if r:
                return r
    elif isinstance(node, list):
        for item in node:
            r = _walk(item, key)
            if r:
                return r
    return None


def check_freshness(html: str) -> dict[str, Any]:
    """Return modified_date (str), age_days (int), source (str)."""
    found_date: str | None = None
    found_source: str = "none"

    # 1. JSON-LD dateModified
    for block in _JSON_LD_RE.findall(html):
        try:
            data = json.loads(block.strip())
        except json.JSONDecodeError:
            continue
        for key in ("dateModified", "datePublished"):
            val = _walk(data, key)
            if isinstance(val, str):
                found_date = val
                found_source = f"json-ld {key}"
                break
        if found_date:
            break

    # 2. Open Graph meta tags
    if not found_date:
        m = _META_MOD_RE.search(html) or _META_PUB_RE.search(html)
        if m:
            found_date = m.group(1)
            found_source = "og meta"

    # 3. <time datetime="">
    if not found_date:
        m = _TIME_TAG_RE.search(html)
        if m:
            found_date = m.group(1)
            found_source = "time tag"

    age_days: int | None = None
    parsed = _try_parse_date(found_date) if found_date else None
    if parsed:
        delta = datetime.now(timezone.utc) - parsed
        age_days = max(0, delta.days)

    return {
        "modified_date": found_date,
        "age_days": age_days,
        "source": found_source,
    }


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("usage: freshness_check.py <url>", file=sys.stderr)
        sys.exit(2)
    from fetch_page import fetch_page
    html = fetch_page(sys.argv[1])["html"]
    print(json.dumps(check_freshness(html), indent=2))
