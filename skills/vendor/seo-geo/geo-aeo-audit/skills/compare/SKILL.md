---
name: compare
parent: best-aeo-skill
description: Head-to-head GEO Score comparison vs 2-5 competitors. Detects per-vector deltas, "they have / you don't" gaps, "you have / they don't" advantages, generates action sequence to leapfrog. Use when the user asks to "compare", "benchmark vs competitors", or "how do I beat X".
---

# compare — sub-skill

Run GEO audits in parallel against you + 2-5 competitor URLs. Generate delta tables and action sequences.

## When to invoke
- "Compare my site vs competitor1.com and competitor2.com"
- "How do I beat competitor X on GEO?"
- "Benchmark my AI search visibility"

## Outputs
- Per-vector delta table (you vs each competitor)
- "They have, you don't" finding list
- "You have, they don't" finding list
- Recommended action sequence to overtake (sorted by impact)

## Inputs
- `--you <URL>` — your URL
- `--them <URL,URL,...>` — comma-separated competitor URLs (max 5)
- `--profile [default|saas|...]`
- `--format [terminal|markdown|json|html]`

## Run
```bash
python3 scripts/compare.py --you https://yoursite.com --them https://competitor1.com,https://competitor2.com
```
