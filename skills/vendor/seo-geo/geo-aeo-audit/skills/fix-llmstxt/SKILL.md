---
name: fix-llmstxt
parent: best-aeo-skill
description: Generate /llms.txt per llmstxt.org spec. Creates AI-engine catalog with H1, summary, primary pages, optional reference. Anthropic honors this for ClaudeBot. Use when the user asks for "llms.txt", "AI catalog", or "llmstxt spec".
---

# fix-llmstxt — sub-skill

Generate a llmstxt.org-compliant `/llms.txt` for the site.

## When to invoke
- "Generate llms.txt for my site"
- "Create an AI catalog file"
- "Add llmstxt.org-compliant index"

## Output structure
```
# {Site Name}
> {1-3 sentence summary}

{Optional 2-paragraph context}

## Primary pages
- [Title](URL): {summary}
- ...

## Optional reference
- [Title](URL): {summary}
```

## Heuristics
- Pulls H1 + meta description for site-level header
- Categorizes pages by URL pattern (home, product, docs, blog, support)
- Excludes pages with `noindex` or password-protected
- Caps at 50 primary + 50 optional URLs
- Generates summaries via passage extraction, not LLM hallucination

## Why this matters in 2026
As of Q1 2026:
- 10.13% of domains have llms.txt (SE Ranking, 2026)
- Only 0.1% of AI bot traffic actually fetches it
- BUT Anthropic officially honors it for ClaudeBot
- Cursor uses it for project understanding
- Standard adoption is growing
- Cost to generate is near-zero

## Inputs
- `--base-url <URL>`
- `--sitemap <URL>` (optional, otherwise crawls)
- `--output <path>` (default: `./public/llms.txt`)
- `--max-primary 50`
- `--max-reference 50`

## Run
```bash
python3 scripts/fix_llmstxt.py --base-url https://example.com --output ./llms.txt
```
