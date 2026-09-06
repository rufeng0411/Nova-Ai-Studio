---
name: fix-schema
parent: best-aeo-skill
description: Generate JSON-LD structured data. Auto-creates FAQPage (highest AI citation surface), Article, Organization, HowTo, Speakable, Product, BreadcrumbList, Person schemas. Validates with Schema.org. Use when the user asks for "schema", "structured data", "JSON-LD", "FAQ schema", or "rich results markup".
---

# fix-schema — sub-skill

Generate, validate, and inject JSON-LD structured data for the highest AI citation surfaces.

## When to invoke
- "Add FAQPage schema to /pricing"
- "Generate Article schema for my blog post"
- "Create Organization markup with Wikidata sameAs"
- "Validate my structured data"

## Schemas supported (priority order)
1. **FAQPage** — highest AI citation surface (Rule 36)
2. **Article / BlogPosting / NewsArticle** — required for content pages
3. **Organization** with sameAs to Wikidata/Wikipedia/LinkedIn (Rule 42)
4. **HowTo** — for tutorials
5. **Speakable** — for AI voice surfaces (Google AI Overviews)
6. **Product** + AggregateRating + offers
7. **BreadcrumbList**
8. **Person** (author bios)
9. **VideoObject** + Clip + SeekToAction
10. **LocalBusiness** + GeoCoordinates

## Validation
- Schema.org compliance check
- Google Rich Results structured data eligibility
- Required fields verification
- Cross-schema consistency

## Inputs
- `--url <URL>` or `--file <path>`
- `--types <list>` — comma-separated (e.g., `faq,article,org`)
- `--apply` — inject into HTML; without flag = print blocks only

## Run
```bash
python3 scripts/fix_schema.py --url https://example.com --types faq,article,org
```
