#!/usr/bin/env python3
"""
ai_bot_access — evidence collector

Determines whether each known AI bot is allowed by robots.txt.
A bot is "allowed" if either:
  - it has its own User-agent block with no Disallow: /
  - OR the wildcard (*) block doesn't Disallow: / for it

The 27 AI bots tracked here are taken from SKILL.md Rule 1-10.
Stdlib only.
"""
from __future__ import annotations

from typing import Any


AI_BOTS = [
    # Google
    "Google-Extended", "GoogleOther",
    # OpenAI
    "GPTBot", "ChatGPT-User", "OAI-SearchBot",
    # Anthropic
    "ClaudeBot", "anthropic-ai", "Claude-Web", "Claude-User", "Claude-SearchBot",
    # Perplexity
    "PerplexityBot", "Perplexity-User",
    # Apple
    "Applebot", "Applebot-Extended",
    # Meta
    "FacebookBot", "Meta-ExternalAgent",
    # Others
    "YouBot", "cohere-ai", "MistralAI-User", "CCBot",
    "Bytespider", "Diffbot", "Amazonbot",
]


def _bot_blocked(rules_for_bot: list[tuple[str, str]]) -> bool:
    """Return True if any Disallow rule blocks the entire site."""
    for directive, path in rules_for_bot:
        if directive == "disallow" and path == "/":
            return True
    return False


def check_ai_bot_access(url: str, *, robots: dict[str, Any] | None = None) -> dict[str, Any]:
    """For each tracked AI bot, determine whether it has site-wide access."""
    if robots is None:
        from robots_check import check_robots
        robots = check_robots(url)

    rules = robots.get("rules", {})
    wildcard_blocked = _bot_blocked(rules.get("*", []))

    bots_status: dict[str, bool] = {}
    for bot in AI_BOTS:
        bot_lower = bot.lower()
        # If bot has its own block, only that matters
        if bot_lower in rules:
            bots_status[bot] = not _bot_blocked(rules[bot_lower])
        else:
            # Falls under wildcard
            bots_status[bot] = not wildcard_blocked

    blocked = [b for b, allowed in bots_status.items() if not allowed]
    allowed = [b for b, allowed in bots_status.items() if allowed]

    return {
        "bots": bots_status,
        "allowed_count": len(allowed),
        "blocked_count": len(blocked),
        "blocked_list": blocked,
        "explicit_blocks": sum(1 for b in AI_BOTS if b.lower() in rules),
    }


if __name__ == "__main__":
    import sys
    import json
    if len(sys.argv) < 2:
        print("usage: ai_bot_access.py <url>", file=sys.stderr)
        sys.exit(2)
    print(json.dumps(check_ai_bot_access(sys.argv[1]), indent=2))
