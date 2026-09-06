#!/usr/bin/env python3
"""
entity_extractor — evidence collector

Extracts Person/Organization entities from JSON-LD and counts sameAs links.
A simple proxy for Knowledge Graph linkage strength.
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


def _walk_collect(node: Any, kind: str, into: list[dict]) -> None:
    """Collect dicts whose @type matches kind."""
    if isinstance(node, dict):
        t = node.get("@type")
        if (isinstance(t, str) and t == kind) or (isinstance(t, list) and kind in t):
            into.append(node)
        for v in node.values():
            _walk_collect(v, kind, into)
    elif isinstance(node, list):
        for item in node:
            _walk_collect(item, kind, into)


def extract_entities(html: str) -> dict[str, Any]:
    """Return persons, orgs, sameas_count."""
    persons: list[dict] = []
    orgs: list[dict] = []

    for block in _JSON_LD_RE.findall(html):
        try:
            data = json.loads(block.strip())
        except json.JSONDecodeError:
            continue
        _walk_collect(data, "Person", persons)
        _walk_collect(data, "Organization", orgs)

    sameas_count = 0
    for entity in persons + orgs:
        sa = entity.get("sameAs")
        if isinstance(sa, str):
            sameas_count += 1
        elif isinstance(sa, list):
            sameas_count += len([x for x in sa if isinstance(x, str)])

    return {
        "person_count": len(persons),
        "org_count": len(orgs),
        "org": len(orgs) > 0,
        "person": len(persons) > 0,
        "sameas_count": sameas_count,
        "person_names": [p.get("name") for p in persons if p.get("name")][:5],
        "org_names": [o.get("name") for o in orgs if o.get("name")][:5],
    }


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("usage: entity_extractor.py <url>", file=sys.stderr)
        sys.exit(2)
    from fetch_page import fetch_page
    html = fetch_page(sys.argv[1])["html"]
    print(json.dumps(extract_entities(html), indent=2))
