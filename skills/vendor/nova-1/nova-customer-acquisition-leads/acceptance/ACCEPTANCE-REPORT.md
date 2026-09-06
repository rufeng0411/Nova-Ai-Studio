# Acceptance Report

**Date:** 2026-06-01  
**Skill:** `customer-acquisition-leads` v1.0.0  
**Validator:** `acceptance/validate_manifest.py`

## Result: PASS (structural)

| Theme | Leads | Query expansion | Contact on High |
|---|---:|---|---|
| beijing-ooh-procurement | 5 | 8 alternates | ✓ |
| ai-software-outsourcing | 5 | 8 alternates | ✓ |

## Checks passed

- Manifest JSON shape matches Phase G contract
- ≥5 leads per theme, no `noise_irrelevant` in delivery set
- `query_expansion.alternate_queries` ≥6
- High track_level leads have contact_info or contact_candidates

## Live run note

Acceptance fixtures use `example.*` URLs. Production Agent runs must use real discovery tools and populate `field_provenance` honestly.
