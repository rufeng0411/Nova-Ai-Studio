#!/usr/bin/env python3
"""
llms_txt_check — evidence collector

Checks for /llms.txt at the URL's host. Per llmstxt.org spec.
Stdlib only.
"""
from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

from fetch_page import fetch_page


def check_llms_txt(url: str) -> dict[str, Any]:
    """Return found, url, has_h1, has_blockquote, line_count."""
    parsed = urlparse(url)
    llms_url = f"{parsed.scheme}://{parsed.netloc}/llms.txt"
    fetched = fetch_page(llms_url)

    if fetched["status"] != 200 or not fetched["html"]:
        return {"found": False, "url": llms_url, "has_h1": False, "has_blockquote": False, "line_count": 0}

    raw = fetched["html"]
    lines = raw.splitlines()
    has_h1 = any(l.lstrip().startswith("# ") for l in lines)
    has_blockquote = any(l.lstrip().startswith("> ") for l in lines)

    return {
        "found": True,
        "url": llms_url,
        "has_h1": has_h1,
        "has_blockquote": has_blockquote,
        "line_count": len(lines),
        "size_bytes": len(raw.encode("utf-8")),
    }


if __name__ == "__main__":
    import sys
    import json
    if len(sys.argv) < 2:
        print("usage: llms_txt_check.py <url>", file=sys.stderr)
        sys.exit(2)
    print(json.dumps(check_llms_txt(sys.argv[1]), indent=2))
