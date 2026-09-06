#!/usr/bin/env python3
"""
schema_validate — evidence collector

Detects JSON-LD blocks in HTML, parses them, returns the @type values seen
and counts of invalid blocks.
Stdlib only.
"""
from __future__ import annotations

import json
import re
from typing import Any


_SCRIPT_RE = re.compile(
    r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    re.IGNORECASE | re.DOTALL,
)


def _collect_types(node: Any, out: list[str]) -> None:
    """Recursively collect @type values from a parsed JSON-LD structure."""
    if isinstance(node, dict):
        t = node.get("@type")
        if isinstance(t, str):
            out.append(t)
        elif isinstance(t, list):
            out.extend([x for x in t if isinstance(x, str)])
        for v in node.values():
            _collect_types(v, out)
    elif isinstance(node, list):
        for item in node:
            _collect_types(item, out)


def detect_schemas(html: str) -> dict[str, Any]:
    """Return {types: [...], blocks: N, invalid_count: N, parsed: [...]}.

    types is a deduplicated list of all @type values found.
    """
    matches = _SCRIPT_RE.findall(html)
    types: list[str] = []
    parsed_ok: list[Any] = []
    invalid = 0

    for raw_block in matches:
        block = raw_block.strip()
        if not block:
            continue
        try:
            data = json.loads(block)
            _collect_types(data, types)
            parsed_ok.append(data)
        except json.JSONDecodeError:
            invalid += 1

    return {
        "types": sorted(set(types)),
        "blocks": len(matches),
        "valid_blocks": len(parsed_ok),
        "invalid_count": invalid,
        "type_counts": {t: types.count(t) for t in set(types)},
    }


if __name__ == "__main__":
    import sys
    import json as jsonmod
    if len(sys.argv) < 2:
        print("usage: schema_validate.py <url-or-file>", file=sys.stderr)
        sys.exit(2)
    arg = sys.argv[1]
    if arg.startswith("http"):
        from fetch_page import fetch_page
        html = fetch_page(arg)["html"]
    else:
        with open(arg, "r", encoding="utf-8", errors="replace") as fh:
            html = fh.read()
    print(jsonmod.dumps(detect_schemas(html), indent=2))
