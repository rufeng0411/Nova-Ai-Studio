# Four-line alignment audit (2026-07-21)

- Tenant: `default`
- Sessions scanned: 0
- Turns audited: 0
- Aligned: 0 (100.0% raw, actionable 100.0% excl. missing_on_disk)

## Label distribution

| Label | Count |
|-------|-------|


## G-4L gates

| ID | Status | Notes |
|----|--------|-------|
| G-4L1 | PASS | Audit completed without crash |
| G-4L2 | PASS | actionable aligned ≥ 85% (actual 100.0%, raw 100.0%) |
| G-4L3 | pending | Run `npm run test:four-line-e2e` |
| G-4L4 | pending | Run catalog legacy backfill |

## Export / certificate KPIs (0717 cursor)

| KPI | Count |
|-----|-------|
| slot_collision | 0 |
| hash_mismatch | 0 |
| literal_placeholder_path | 0 |
| snapshot_truncated | 0 |
| nonterminal_export_as_final | 0 |

## Top issue turns

_None_

- JSONL detail: `artifacts\audit\four-line-alignment-2026-07-21.jsonl`
- Generated: 2026-07-21T16:37:07.985Z
