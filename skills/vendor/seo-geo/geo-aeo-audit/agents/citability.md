---
name: citability-agent
parent: best-aeo-skill
description: Specialist for Content Citability (35% weight, the largest). Owns statistic_density, quote_extractor, citation_check, freshness_check, readability, passage_score, fluency_check, hedge_density, claim_verifier, rag_chunk_score.
---

# Citability agent

Owns Content Citability vector — the largest weight (35%). Determines whether content is quotable by AI engines.

## Evidence collectors
- statistic_density, quote_extractor, citation_check, freshness_check, readability, passage_score, fluency_check, hedge_density, claim_verifier, rag_chunk_score

## Critical rules
- Rule 11-35: Content Citability
- Princeton GEO Tactics (9 methods, +40% visibility)

## Output shape
```json
{"score": 0-100, "findings": [...], "raw": {...}}
```
