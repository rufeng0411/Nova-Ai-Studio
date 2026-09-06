#!/usr/bin/env python3
"""
statistic_density — evidence collector

Counts numeric claims per word. Numeric claims include percentages, currency,
multipliers, and standalone numbers ≥ 2 digits or with decimals.

Princeton KDD 2024: +40% visibility from adding statistics. Target density:
1 stat per ~200 words (0.5 per 100 words).
Stdlib only.
"""
from __future__ import annotations

import re
from typing import Any


_TAG_RE = re.compile(r"<[^>]+>")
_WHITESPACE_RE = re.compile(r"\s+")
_WORD_RE = re.compile(r"\b\w+\b")
# Match numeric claims: percentages, currency, multipliers, decimals, large numbers
_STAT_RE = re.compile(
    r"\b(?:"
    r"\d+(?:[.,]\d+)?\s*%"            # percentages: 25%, 25.11%
    r"|\$\s*\d+(?:[.,]\d+)?[KMBkmb]?"  # currency: $848M, $33.7B
    r"|\d+(?:[.,]\d+)?\s*[×x]"         # multipliers: 5×, 2.1x
    r"|\d{2,}(?:[.,]\d+)?"             # plain large numbers: 25.11, 900, 1247
    r"|\d+\s*(?:million|billion|thousand)" # word-modified
    r"|\d+(?:[.,]\d+)?\s*[KMB]"        # K/M/B suffix: 900M, 1.4k
    r")\b",
    re.IGNORECASE,
)


def measure_statistic_density(html: str) -> dict[str, Any]:
    """Return word_count, statistic_count, density_per_100w, samples."""
    text = _TAG_RE.sub(" ", html)
    text = _WHITESPACE_RE.sub(" ", text).strip()
    words = _WORD_RE.findall(text)
    stats = _STAT_RE.findall(text)
    word_count = len(words)
    stat_count = len(stats)
    density = round(stat_count / max(word_count, 1) * 100, 3)
    return {
        "word_count": word_count,
        "statistic_count": stat_count,
        "density_per_100w": density,
        "samples": stats[:15],
    }


if __name__ == "__main__":
    import sys
    import json
    if len(sys.argv) < 2:
        print("usage: statistic_density.py <url-or-file>", file=sys.stderr)
        sys.exit(2)
    arg = sys.argv[1]
    if arg.startswith("http"):
        from fetch_page import fetch_page
        html = fetch_page(arg)["html"]
    else:
        with open(arg, "r", encoding="utf-8", errors="replace") as fh:
            html = fh.read()
    print(json.dumps(measure_statistic_density(html), indent=2))
