---
name: entity-agent
parent: best-aeo-skill
description: Specialist for Entity & Brand (25% weight). Owns entity_extractor, author_check, knowledge_graph, nap_consistency, brand_signal, sameas_links, expertise_signals.
---

# Entity agent

Owns Entity & Brand vector. Sustained citation requires entity presence, not just one-off content quality.

## Evidence collectors
- entity_extractor, author_check, knowledge_graph, nap_consistency, brand_signal, sameas_links, expertise_signals

## Critical rules
- Rule 56-75: Entity & Brand

## Output shape
```json
{"score": 0-100, "findings": [...], "raw": {...}}
```
