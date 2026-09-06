#!/usr/bin/env python3
"""
citation_check — evidence collector

Counts internal vs external links. External links to authoritative domains
score higher than internal navigation.
Stdlib only.
"""
from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse


_LINK_RE = re.compile(r'<a\b[^>]*?\bhref=["\']([^"\']+)["\'][^>]*>', re.IGNORECASE)


# Approximate "authoritative" TLD/domain patterns
_AUTHORITY_DOMAINS = {
    "edu", "gov", "ac.uk", "wikipedia.org", "arxiv.org", "doi.org",
    "nature.com", "sciencedirect.com", "springer.com", "ieee.org", "acm.org",
    "github.com", "github.io",
    "schema.org", "w3.org",
    "nytimes.com", "wsj.com", "reuters.com", "bbc.com", "economist.com",
}


def count_citations(html: str, base_url: str) -> dict[str, Any]:
    """Return external_links, internal_links, authoritative_links, samples."""
    base_host = urlparse(base_url).netloc.lower()
    links = _LINK_RE.findall(html)

    external = 0
    internal = 0
    authoritative = 0
    external_samples: list[str] = []

    for href in links:
        if href.startswith("#") or href.startswith("javascript:") or href.startswith("mailto:"):
            continue
        parsed = urlparse(href)
        host = parsed.netloc.lower()
        if not host or host == base_host:
            internal += 1
            continue
        external += 1
        if len(external_samples) < 10:
            external_samples.append(href)
        for auth in _AUTHORITY_DOMAINS:
            if host == auth or host.endswith("." + auth):
                authoritative += 1
                break

    return {
        "total_links": internal + external,
        "external_links": external,
        "internal_links": internal,
        "authoritative_links": authoritative,
        "external_samples": external_samples,
    }


if __name__ == "__main__":
    import sys
    import json
    if len(sys.argv) < 2:
        print("usage: citation_check.py <url>", file=sys.stderr)
        sys.exit(2)
    from fetch_page import fetch_page
    url = sys.argv[1]
    html = fetch_page(url)["html"]
    print(json.dumps(count_citations(html, url), indent=2))
