#!/usr/bin/env python3
"""
robots_check — evidence collector

Fetches /robots.txt, parses User-agent / Allow / Disallow / Sitemap rules.
Stdlib only.
"""
from __future__ import annotations

from typing import Any
from urllib.parse import urljoin, urlparse

from fetch_page import fetch_page


def check_robots(url: str) -> dict[str, Any]:
    """Fetch and parse /robots.txt at the URL's host."""
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    fetched = fetch_page(robots_url)
    if fetched["status"] != 200 or not fetched["html"]:
        return {"found": False, "url": robots_url, "rules": {}, "sitemaps": [], "raw": ""}

    raw = fetched["html"]
    rules: dict[str, list[tuple[str, str]]] = {}  # ua -> [(directive, path)]
    sitemaps: list[str] = []
    current_uas: list[str] = []

    for line in raw.splitlines():
        line = line.split("#", 1)[0].strip()
        if not line:
            current_uas = []
            continue
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        key = key.strip().lower()
        value = value.strip()
        if key == "user-agent":
            current_uas.append(value.lower())
            rules.setdefault(value.lower(), [])
        elif key in ("allow", "disallow"):
            for ua in current_uas or ["*"]:
                rules.setdefault(ua, []).append((key, value))
        elif key == "sitemap":
            sitemaps.append(value)

    return {
        "found": True,
        "url": robots_url,
        "rules": rules,
        "sitemaps": sitemaps,
        "raw": raw[:2000],
    }


if __name__ == "__main__":
    import sys
    import json
    if len(sys.argv) < 2:
        print("usage: robots_check.py <url>", file=sys.stderr)
        sys.exit(2)
    print(json.dumps(check_robots(sys.argv[1]), indent=2))
