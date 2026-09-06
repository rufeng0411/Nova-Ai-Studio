---
name: technical-agent
parent: best-aeo-skill
description: Specialist for Technical Accessibility (20% weight). Owns robots_check, ai_bot_access, js_render, cdn_blocking, response_codes, sitemap_check, http2_check, mobile_render, lazyload_check.
---

# Technical agent

Owns Technical Accessibility vector. Determines whether AI bots can reach and parse content.

## Evidence collectors
- robots_check, ai_bot_access, js_render, cdn_blocking, response_codes, sitemap_check, http2_check, mobile_render, lazyload_check

## Critical rules (from SKILL.md ruleset)
- Rule 1-10: AI Crawler Access

## Output shape
```json
{"score": 0-100, "findings": [...], "raw": {...}}
```
