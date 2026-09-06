#!/usr/bin/env python3
"""
fetch_page — evidence collector

Fetches a URL with realistic headers, follows redirects, returns HTML + metadata.
Stdlib only.
"""
from __future__ import annotations

import gzip
import io
import ssl
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 best-aeo-skill/1.0"


def fetch_page(url: str, *, timeout: int = 15, ua: str = DEFAULT_UA) -> dict[str, Any]:
    """Fetch URL, return {status, html, headers, final_url, error}."""
    req = Request(url, headers={
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip",
    })
    ctx = ssl.create_default_context()
    try:
        with urlopen(req, timeout=timeout, context=ctx) as resp:
            raw = resp.read()
            if resp.headers.get("Content-Encoding") == "gzip":
                raw = gzip.decompress(raw)
            html = raw.decode("utf-8", errors="replace")
            return {
                "status": resp.status,
                "html": html,
                "headers": dict(resp.headers),
                "final_url": resp.geturl(),
                "error": None,
            }
    except HTTPError as e:
        return {"status": e.code, "html": "", "headers": dict(e.headers or {}), "final_url": url, "error": str(e)}
    except URLError as e:
        return {"status": 0, "html": "", "headers": {}, "final_url": url, "error": str(e)}
    except Exception as e:
        return {"status": 0, "html": "", "headers": {}, "final_url": url, "error": str(e)}


if __name__ == "__main__":
    import sys
    import json
    if len(sys.argv) < 2:
        print("usage: fetch_page.py <url>", file=sys.stderr)
        sys.exit(2)
    result = fetch_page(sys.argv[1])
    # Don't print full HTML in default output
    summary = {k: (v[:200] + "..." if k == "html" and isinstance(v, str) and len(v) > 200 else v) for k, v in result.items()}
    print(json.dumps(summary, indent=2))
