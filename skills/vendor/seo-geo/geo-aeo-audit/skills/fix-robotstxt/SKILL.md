---
name: fix-robotstxt
parent: best-aeo-skill
description: Patch robots.txt to explicitly allow 27 AI bots (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.). Diff-aware — never overwrites existing rules. Use when the user asks to "allow AI bots", "fix robots.txt", "block GPTBot", or "patch robots".
---

# fix-robotstxt — sub-skill

Patch `/robots.txt` to explicitly Allow the 27 AI bots that drive AI search citations.

## When to invoke
- "Allow GPTBot in my robots.txt"
- "Fix robots.txt for AI bots"
- "Make sure ChatGPT can crawl my site"
- "Allow Claude to read my site"

## Bots allowed by default (27 total)

| Provider | User-agents |
|----------|------------|
| Google | Googlebot, Google-Extended, GoogleOther |
| OpenAI | GPTBot, ChatGPT-User, OAI-SearchBot |
| Anthropic | ClaudeBot, anthropic-ai, Claude-Web, Claude-User, Claude-SearchBot |
| Perplexity | PerplexityBot, Perplexity-User |
| Apple | Applebot, Applebot-Extended |
| Meta | FacebookBot, Meta-ExternalAgent |
| You.com | YouBot |
| Cohere | cohere-ai |
| Mistral | MistralAI-User |
| Common Crawl | CCBot |
| ByteDance | Bytespider |
| Diffbot | Diffbot |
| Amazon | Amazonbot |
| DuckDuckGo | DuckDuckBot |
| Yandex | YandexBot |
| Bing | Bingbot |

## Safety
- **Diff-aware:** never overwrites existing User-agent blocks
- **Additive only:** adds explicit Allow: lines where missing
- **Preview mode:** without `--apply`, prints diff only
- **Backup:** original file written to `robots.txt.bak`

## Important caveat
robots.txt rules don't guarantee CDN compliance. Cloudflare bot management can block AI bots even with explicit Allow. Verify in Cloudflare dashboard "AI Bots" rule.

## Inputs
- `--url <URL>` (fetches existing robots.txt)
- `--file <path>` (alt: local robots.txt)
- `--apply` — write changes; without flag = preview only
- `--bots <list>` — limit to specific bots (default: all 27)

## Run
```bash
python3 scripts/fix_robotstxt.py --url https://example.com --apply
```
