---
name: fix-content
parent: best-aeo-skill
description: Rewrite content for AI citability. Adds expert quotes (+41% citations), inserts statistics (+40% visibility), embeds source attributions (+115% citation likelihood). Idempotent. Use when the user asks to "rewrite", "fix content", "add quotes", "improve citability", or "make my article more citable".
---

# fix-content — sub-skill

Rewrite a page's content to maximize AI citation rates. Based on Princeton KDD 2024 findings.

## When to invoke
- "Rewrite this article for better AI citation"
- "Add quotes and statistics to https://example.com/post"
- "Fix the citability of this page"

## What it does
| Action | Princeton finding |
|--------|------------------|
| Adds expert quotes (2-4 per 1000 words) | +41% citation likelihood |
| Inserts statistics (target 1 per 200 words) | +40% visibility |
| Embeds source attributions (every numeric claim) | +115% citation likelihood |
| Adds ISO-8601 dateModified | 3.2× more citations for content <30 days |

## Constraints
- Preserves voice (analyzes tone before rewriting)
- Preserves all factual claims (never invents)
- Idempotent (running twice yields same result)
- Skips paragraphs already meeting density targets

## Inputs
- `--url <URL>` or `--file <path>`
- `--apply` — write changes (without flag = preview only)
- `--max-quotes-per-1000-words 4` (default)
- `--statistic-density 0.5` (per 100 words; default)

## Run
```bash
python3 scripts/fix_content.py --url https://example.com --apply
```
