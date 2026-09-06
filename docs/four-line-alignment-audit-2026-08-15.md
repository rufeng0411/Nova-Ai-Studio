# Four-line alignment audit (2026-08-15)

- Tenant: `default`
- Sessions scanned: 111
- Turns audited: 890
- Aligned: 596 (67.0% raw, actionable 86.0% excl. missing_on_disk)

## Label distribution

| Label | Count |
|-------|-------|
| aligned | 596 |
| missing_on_disk | 197 |
| bare_name_risk | 52 |
| unrecoverable | 45 |

## G-4L gates

| ID | Status | Notes |
|----|--------|-------|
| G-4L1 | PASS | Audit completed without crash |
| G-4L2 | PASS | actionable aligned ≥ 85% (actual 86.0%, raw 67.0%) |
| G-4L3 | pending | Run `npm run test:four-line-e2e` |
| G-4L4 | pending | Run catalog legacy backfill |

## Export / certificate KPIs (0717 cursor)

| KPI | Count |
|-----|-------|
| slot_collision | 0 |
| hash_mismatch | 0 |
| literal_placeholder_path | 1 |
| snapshot_truncated | 0 |
| nonterminal_export_as_final | 0 |

## Top issue turns

- `web-s_1b793f88-8fdc-4c5d-9406-28526f06bcd6` turn `e69cf0b5-4a3d-467d-a694-13f41388203d`: **missing_on_disk** hint=``
- `web-s_1b793f88-8fdc-4c5d-9406-28526f06bcd6` turn `fd603e27-f0b2-4912-8dc6-2419ceb84dfb`: **missing_on_disk** hint=``
- `web-s_70e3abd9-588a-4bd3-8bf3-269f83c03d2d` turn `39ad03f6-0ed9-4774-a6cb-3786fb4cc44b`: **missing_on_disk** hint=`artifacts/task-20260805-0864431b/assets`
- `web-s_ee90b7fc-7121-4b1e-83c4-00e1a815fe83` turn `13562d6f-20f0-4c99-ad4f-2f3012de9a82`: **missing_on_disk** hint=`artifacts/task-20260805-fbca436e`
- `web-s_68f1ba41-17de-4748-82d6-9428334743cb` turn `ac2e6e0f-54ec-4e09-9ba2-1977f0a6d6fc`: **bare_name_risk** hint=`artifacts/task-20260803-f0a6d6fc`
- `web-s_68f1ba41-17de-4748-82d6-9428334743cb` turn `12e9febe-c336-4356-b0cc-98ba35661019`: **bare_name_risk** hint=`artifacts/task-20260803-f0a6d6fc`
- `web-s_68f1ba41-17de-4748-82d6-9428334743cb` turn `cf725fc2-39e7-4d44-aeb6-e80c73796841`: **unrecoverable** hint=``
- `web-s_531fe9cc-40b3-4f29-abf8-c24174c138fe` turn `4b4187c8-9fb2-45df-b6c4-c38994eeebb9`: **missing_on_disk** hint=`artifacts/task-20260802-comp-check`
- `web-s_531fe9cc-40b3-4f29-abf8-c24174c138fe` turn `6744eb0f-6a80-411e-b00f-35c5fd32b9a2`: **missing_on_disk** hint=`artifacts/task-comp-chenhai-2026`
- `web-s_531fe9cc-40b3-4f29-abf8-c24174c138fe` turn `bffdda56-1a16-4633-8d1b-3b28d854dc34`: **missing_on_disk** hint=`artifacts/task-20260802-canghaicompany`
- `web-s_531fe9cc-40b3-4f29-abf8-c24174c138fe` turn `b0ca36e8-6d8d-480e-b991-058da893576c`: **missing_on_disk** hint=`artifacts/task-20260802-canghaicompany`
- `web-s_531fe9cc-40b3-4f29-abf8-c24174c138fe` turn `fb36b24b-daed-4285-b995-9a55c912696e`: **missing_on_disk** hint=`artifacts/task-20260802-haha-compliance`
- `web-s_531fe9cc-40b3-4f29-abf8-c24174c138fe` turn `02ebe093-1f9c-4ebe-9e30-2338bac51020`: **missing_on_disk** hint=`artifacts/task-20260802-canghaha-checklist`
- `web-s_531fe9cc-40b3-4f29-abf8-c24174c138fe` turn `6f549edd-b180-4494-98a7-374d976c1e73`: **missing_on_disk** hint=`artifacts/task-20260802-canghaha-checklist`
- `web-s_531fe9cc-40b3-4f29-abf8-c24174c138fe` turn `e31e5840-a117-4599-8515-e07d633c91f5`: **missing_on_disk** hint=`artifacts/task-20260802-canghaha-checklist`
- `web-s_531fe9cc-40b3-4f29-abf8-c24174c138fe` turn `2b698a1a-4cde-48fa-9e46-ed65cf78fa22`: **missing_on_disk** hint=`artifacts/task-20260802-canghaha-checklist`
- `web-s_531fe9cc-40b3-4f29-abf8-c24174c138fe` turn `2580e4bc-270b-4bb4-88cf-ba49b05a522b`: **missing_on_disk** hint=`artifacts/task-20260802-canghaha-checklist`
- `web-s_531fe9cc-40b3-4f29-abf8-c24174c138fe` turn `2ff1abf1-3deb-4628-9427-6a97bb4f5118`: **missing_on_disk** hint=``
- `web-s_531fe9cc-40b3-4f29-abf8-c24174c138fe` turn `fa6478fd-45dd-4353-a391-ab459375834d`: **missing_on_disk** hint=`artifacts/task-20260802-canghaha-checklist`
- `web-s_531fe9cc-40b3-4f29-abf8-c24174c138fe` turn `f396867b-6492-4158-ae6a-4dc5cb1d289a`: **missing_on_disk** hint=`artifacts/task-20260802-canghaha-checklist`

- JSONL detail: `artifacts\audit\four-line-alignment-2026-08-15.jsonl`
- Generated: 2026-08-15T07:21:45.361Z
