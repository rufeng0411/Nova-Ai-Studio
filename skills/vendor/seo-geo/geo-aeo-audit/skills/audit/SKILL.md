---
name: audit
parent: best-aeo-skill
description: Run a full GEO audit on a URL. Computes 0-100 composite score across Technical/Citability/Schema/Entity vectors. Returns confidence-labeled findings. Use when the user asks to "audit", "check", "diagnose", or "score" a website's AI search visibility.
---

# audit — sub-skill

Diagnose a URL's AI search visibility. Returns a 0–100 composite GEO Score with ranked, confidence-labeled findings.

## When to invoke
- "Audit https://example.com"
- "Run a GEO audit on my site"
- "Why isn't my site cited by ChatGPT?"
- "Check my AI search visibility"

## Inputs
- `--url <URL>` (required) — single page audit
- `--sitemap <URL>` (alt) — batch up to 100 pages
- `--profile [default|saas|ecommerce|publisher|local|agency|devtools|academic]`
- `--format [terminal|markdown|json]`

## Outputs
- Composite GEO Score (0-100) with band classification (Excellent/Good/Foundation/Critical)
- Per-vector breakdown
- Ranked findings with severity × confidence × projected impact
- Recommended fix command for each finding

## Run
```bash
python3 scripts/audit.py --url https://example.com --profile saas
```

## Implementation
See `scripts/audit.py`.
