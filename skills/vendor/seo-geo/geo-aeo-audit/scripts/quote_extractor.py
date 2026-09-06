#!/usr/bin/env python3
"""
quote_extractor — evidence collector

Counts quoted passages: <blockquote>, <q>, and inline quoted strings ≥ 8 words.
Princeton KDD 2024: +41% citation likelihood from adding expert quotes.
Stdlib only.
"""
from __future__ import annotations

import re
from typing import Any


_BLOCKQUOTE_RE = re.compile(r"<blockquote\b[^>]*>(.*?)</blockquote>", re.IGNORECASE | re.DOTALL)
_Q_TAG_RE = re.compile(r"<q\b[^>]*>(.*?)</q>", re.IGNORECASE | re.DOTALL)
_TAG_RE = re.compile(r"<[^>]+>")
# Match quoted phrases of ≥ 8 words: typographic or straight quotes.
_INLINE_QUOTE_RE = re.compile(
    r'[“"]([^”"]{40,})[”"]'
)
_WORD_RE = re.compile(r"\b\w+\b")


def extract_quotes(html: str) -> dict[str, Any]:
    """Return count, blockquote_count, q_count, inline_count, samples."""
    blockquotes = [
        _TAG_RE.sub("", m).strip() for m in _BLOCKQUOTE_RE.findall(html)
    ]
    blockquotes = [b for b in blockquotes if len(b.split()) >= 8]
    q_tags = [
        _TAG_RE.sub("", m).strip() for m in _Q_TAG_RE.findall(html)
    ]
    q_tags = [q for q in q_tags if len(q.split()) >= 8]

    text = _TAG_RE.sub(" ", html)
    inline = [
        m for m in _INLINE_QUOTE_RE.findall(text)
        if len(_WORD_RE.findall(m)) >= 8
    ]

    samples = (blockquotes + q_tags + inline)[:5]
    return {
        "count": len(blockquotes) + len(q_tags) + len(inline),
        "blockquote_count": len(blockquotes),
        "q_count": len(q_tags),
        "inline_count": len(inline),
        "samples": [s[:120] + ("..." if len(s) > 120 else "") for s in samples],
    }


if __name__ == "__main__":
    import sys
    import json
    if len(sys.argv) < 2:
        print("usage: quote_extractor.py <url>", file=sys.stderr)
        sys.exit(2)
    from fetch_page import fetch_page
    html = fetch_page(sys.argv[1])["html"]
    print(json.dumps(extract_quotes(html), indent=2))
