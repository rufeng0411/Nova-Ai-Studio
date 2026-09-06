# Four-line alignment audit (2026-07-31)

- Tenant: `default`
- Sessions scanned: 89
- Turns audited: 700
- Aligned: 493 (70.4% raw, actionable 89.0% excl. missing_on_disk)

## Label distribution

| Label | Count |
|-------|-------|
| aligned | 493 |
| unrecoverable | 25 |
| missing_on_disk | 146 |
| bare_name_risk | 36 |

## G-4L gates

| ID | Status | Notes |
|----|--------|-------|
| G-4L1 | PASS | Audit completed without crash |
| G-4L2 | PASS | actionable aligned ≥ 85% (actual 89.0%, raw 70.4%) |
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

- `web-s_cbf12232-b618-43f3-a659-6182acff6a25` turn `c228af37-efba-4dc1-8632-37bbbe452b06`: **unrecoverable** hint=``
- `web-s_cbf12232-b618-43f3-a659-6182acff6a25` turn `e7ccd526-1e16-4779-89e1-0828f25185da`: **unrecoverable** hint=``
- `web-s_cbf12232-b618-43f3-a659-6182acff6a25` turn `6ff964ba-aae2-4973-b3f7-6b507429294e`: **unrecoverable** hint=``
- `web-s_cbf12232-b618-43f3-a659-6182acff6a25` turn `db56ecf7-198b-4eb8-812e-7a33db33baf3`: **unrecoverable** hint=``
- `web-s_cbf12232-b618-43f3-a659-6182acff6a25` turn `123ecba9-367c-4d02-91da-2991de08e932`: **unrecoverable** hint=``
- `web-s_cbf12232-b618-43f3-a659-6182acff6a25` turn `d593b7bd-1429-4194-ac89-74594ed37e26`: **unrecoverable** hint=``
- `web-s_cbf12232-b618-43f3-a659-6182acff6a25` turn `915e06b6-231c-40d0-b889-aa2923adb018`: **unrecoverable** hint=``
- `web-s_cbf12232-b618-43f3-a659-6182acff6a25` turn `f00763de-0bbb-4da2-a4cd-6920bb7c8e88`: **unrecoverable** hint=``
- `web-s_cbf12232-b618-43f3-a659-6182acff6a25` turn `20aa8308-0496-4f85-abd9-9df665937e67`: **unrecoverable** hint=``
- `web-s_cbf12232-b618-43f3-a659-6182acff6a25` turn `98b83add-5c87-435c-bc52-4442fe4132b8`: **unrecoverable** hint=``
- `web-s_cbf12232-b618-43f3-a659-6182acff6a25` turn `95efe028-e12a-45b1-a0bb-55dc3e677f44`: **unrecoverable** hint=``
- `web-s_cbf12232-b618-43f3-a659-6182acff6a25` turn `e8fdfb81-0e72-4cb7-ae71-c3fcff1d1000`: **unrecoverable** hint=``
- `web-s_cbf12232-b618-43f3-a659-6182acff6a25` turn `0ca8d025-deda-4213-9d76-567f14bc6a43`: **unrecoverable** hint=``
- `web-s_cbf12232-b618-43f3-a659-6182acff6a25` turn `a9340508-8ce7-4356-8ad7-d396088e2e19`: **unrecoverable** hint=``
- `web-s_6a26960f-883d-4528-b2ce-a2097a042b43` turn `04921b90-2860-4ba1-84a4-9f92e7734d77`: **missing_on_disk** hint=`artifacts/task-20260728-41dd1371/xiaomi-crisis-pr/research`
- `web-s_6a26960f-883d-4528-b2ce-a2097a042b43` turn `3f5ceeb1-88e1-4ed5-a311-e283e7c1887a`: **missing_on_disk** hint=`artifacts/task-20260731-e7734d77/xiaomi-crisis-pr/research`
- `web-s_6a26960f-883d-4528-b2ce-a2097a042b43` turn `0daae5c8-33e9-4746-9c97-854cf092c8d4`: **missing_on_disk** hint=`artifacts/task-20260728-41dd1371/xiaomi-crisis-pr/research`
- `web-s_6a26960f-883d-4528-b2ce-a2097a042b43` turn `674c4692-1d02-4eeb-aec2-067d93fee720`: **missing_on_disk** hint=`artifacts/task-20260728-41dd1371/xiaomi-crisis-pr/research`
- `web-s_6a26960f-883d-4528-b2ce-a2097a042b43` turn `0fcf53d8-5320-40a4-afca-b00f694a6762`: **missing_on_disk** hint=`artifacts/task-20260728-41dd1371`
- `web-s_6a26960f-883d-4528-b2ce-a2097a042b43` turn `a598c161-f181-4f39-b726-bb6a27313e3d`: **missing_on_disk** hint=`artifacts/task-20260728-41dd1371`

- JSONL detail: `artifacts\audit\four-line-alignment-2026-07-31.jsonl`
- Generated: 2026-07-31T15:30:29.498Z
