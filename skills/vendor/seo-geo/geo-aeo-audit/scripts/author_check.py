#!/usr/bin/env python3
"""
author_check — evidence collector

Checks for author markup: schema.org/Person, byline patterns, "By X" patterns.
Anonymous authorship reduces citation rate by ~60% (Rule 41).
Stdlib only.
"""
from __future__ import annotations

import json
import re
from typing import Any


_JSON_LD_RE = re.compile(
    r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    re.IGNORECASE | re.DOTALL,
)
_REL_AUTHOR_RE = re.compile(r'rel=["\']author["\']', re.IGNORECASE)
_BYLINE_RE = re.compile(
    r"\bby\s+([A-Z][a-zA-Z'\-]+(?:\s[A-Z][a-zA-Z'\-]+){1,3})",
)
_TAG_RE = re.compile(r"<[^>]+>")
_CREDENTIAL_HINTS = (
    "credentials", "phd", "ph.d", "md", "ceo", "cto", "founder", "professor",
    "engineer", "author of", "expert", "specialist", "director",
)


def _walk_for_author(node: Any) -> dict | None:
    """Find first author markup in JSON-LD."""
    if isinstance(node, dict):
        a = node.get("author")
        if isinstance(a, dict):
            return a
        if isinstance(a, list) and a and isinstance(a[0], dict):
            return a[0]
        for v in node.values():
            r = _walk_for_author(v)
            if r:
                return r
    elif isinstance(node, list):
        for item in node:
            r = _walk_for_author(item)
            if r:
                return r
    return None


def check_author(html: str) -> dict[str, Any]:
    """Return has_author, has_credentials, source, name."""
    text_lower = _TAG_RE.sub(" ", html).lower()

    # 1. JSON-LD author
    for block in _JSON_LD_RE.findall(html):
        try:
            data = json.loads(block.strip())
        except json.JSONDecodeError:
            continue
        author = _walk_for_author(data)
        if author:
            name = author.get("name") if isinstance(author, dict) else None
            sameas = author.get("sameAs") if isinstance(author, dict) else None
            jobtitle = author.get("jobTitle") if isinstance(author, dict) else None
            has_creds = bool(jobtitle or sameas)
            return {
                "has_author": True,
                "has_credentials": has_creds,
                "source": "json-ld",
                "name": name,
                "credentials_detected": jobtitle,
            }

    # 2. rel=author
    if _REL_AUTHOR_RE.search(html):
        return {
            "has_author": True,
            "has_credentials": any(h in text_lower for h in _CREDENTIAL_HINTS),
            "source": "rel=author",
            "name": None,
            "credentials_detected": None,
        }

    # 3. "By X Y" byline pattern
    m = _BYLINE_RE.search(_TAG_RE.sub(" ", html[:5000]))
    if m:
        return {
            "has_author": True,
            "has_credentials": any(h in text_lower for h in _CREDENTIAL_HINTS),
            "source": "byline",
            "name": m.group(1),
            "credentials_detected": None,
        }

    return {
        "has_author": False,
        "has_credentials": False,
        "source": "none",
        "name": None,
        "credentials_detected": None,
    }


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("usage: author_check.py <url>", file=sys.stderr)
        sys.exit(2)
    from fetch_page import fetch_page
    html = fetch_page(sys.argv[1])["html"]
    print(json.dumps(check_author(html), indent=2))
