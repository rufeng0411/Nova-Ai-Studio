---
name: schema-agent
parent: best-aeo-skill
description: Specialist for Structured Data (20% weight). Owns schema_validate, faq_check, article_check, jsonld_lint, speakable_check, product_check, breadcrumb_check, video_check.
---

# Schema agent

Owns Structured Data vector. FAQPage produces highest single-signal AI citation rate.

## Evidence collectors
- schema_validate, faq_check, article_check, jsonld_lint, speakable_check, product_check, breadcrumb_check, video_check

## Critical rules
- Rule 36-55: Structured Data

## Output shape
```json
{"score": 0-100, "findings": [...], "raw": {...}}
```
