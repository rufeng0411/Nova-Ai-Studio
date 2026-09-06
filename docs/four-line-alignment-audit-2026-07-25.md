# Four-line alignment audit (2026-07-25)

- Tenant: `default`
- Sessions scanned: 61
- Turns audited: 492
- Aligned: 340 (69.1% raw, actionable 87.9% excl. missing_on_disk)

## Label distribution

| Label | Count |
|-------|-------|
| bare_name_risk | 41 |
| aligned | 340 |
| missing_on_disk | 105 |
| unrecoverable | 6 |

## G-4L gates

| ID | Status | Notes |
|----|--------|-------|
| G-4L1 | PASS | Audit completed without crash |
| G-4L2 | PASS | actionable aligned ≥ 85% (actual 87.9%, raw 69.1%) |
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

- `web-s_7c2c59c6-e255-43b3-b4b4-d0c0216df270` turn `5741a064-0081-40cc-8129-db8ec1aca31b`: **bare_name_risk** hint=``
- `web-s_64cbcc73-9816-49ed-9e7c-95f38f5e1e2f` turn `72ec6a13-4beb-48d8-a55a-63a9a80b1b00`: **missing_on_disk** hint=`tmp_workspace/geo-novapage-20260115-001`
- `web-s_64cbcc73-9816-49ed-9e7c-95f38f5e1e2f` turn `8bafcb34-198f-430f-986b-3bf09fefc184`: **missing_on_disk** hint=`artifacts/task-20260725-00aa0b8f`
- `web-s_64cbcc73-9816-49ed-9e7c-95f38f5e1e2f` turn `4a2686e0-53fb-46ca-9373-728183bc0ba9`: **missing_on_disk** hint=`artifacts/task-20260725-00aa0b8f`
- `web-s_64cbcc73-9816-49ed-9e7c-95f38f5e1e2f` turn `e1acbd00-13a5-40aa-b180-72a75154249c`: **missing_on_disk** hint=`artifacts/task-20260725-00aa0b8f`
- `web-s_64cbcc73-9816-49ed-9e7c-95f38f5e1e2f` turn `5c6768bf-61db-4763-8ce7-1cb83130ea63`: **missing_on_disk** hint=`artifacts/task-20260725-00aa0b8f`
- `web-s_520f9bdf-8461-4361-94cf-794c63e63ec3` turn `137da492-528f-4d47-b3a8-41ee031f1d38`: **missing_on_disk** hint=``
- `web-s_520f9bdf-8461-4361-94cf-794c63e63ec3` turn `61399f9a-7ce6-4488-8019-dc7a6f90c8cb`: **missing_on_disk** hint=`artifacts/research-gta6-trailer-20260725`
- `web-s_520f9bdf-8461-4361-94cf-794c63e63ec3` turn `a28e0385-6eeb-4e07-8c29-14174b9a7601`: **missing_on_disk** hint=``
- `web-s_520f9bdf-8461-4361-94cf-794c63e63ec3` turn `d66faa8e-36c9-45b2-a434-40284ec0590a`: **missing_on_disk** hint=`artifacts/research-gta6-trailer-20260725`
- `web-s_520f9bdf-8461-4361-94cf-794c63e63ec3` turn `069072e5-16b7-47e7-892a-98c28060332d`: **missing_on_disk** hint=`artifacts/task-20260725-4ec0590a`
- `web-s_2b513a30-2b6f-477d-ac2d-ae4026cbf86a` turn `c4443c7c-678b-47bb-8677-022bbf310cfa`: **missing_on_disk** hint=`artifacts/task-20260725-bf310cfa/hf-project`
- `web-s_2b513a30-2b6f-477d-ac2d-ae4026cbf86a` turn `9f8acccf-46a8-45ea-b0f0-b5f247699f75`: **missing_on_disk** hint=`artifacts/task-20260725-bf310cfa/hf-project`
- `web-s_f88cc6cd-44a9-45a1-8b1a-398f4ac96524` turn `29f70616-84dc-4d0b-bb99-2565ae9afdc9`: **missing_on_disk** hint=`F:/Ai-pilotdeck/.saas-dev-data/tenants/default/cloud-storage/users/1/workspaces/9a498782-6cab-4ca0-b3c7-796926e9af34/hf-project`
- `web-s_f88cc6cd-44a9-45a1-8b1a-398f4ac96524` turn `0651cf9e-aebe-4b75-9f26-22f57ad68ded`: **missing_on_disk** hint=`artifacts/task-20260725-0cca2bdb`
- `web-s_9d51d7a9-e78a-4304-afce-fddccf4f71ed` turn `1b5cb629-a648-49ac-9703-4321782f378f`: **missing_on_disk** hint=`artifacts/task-20260725-782f378f/hf-project`
- `web-s_9d51d7a9-e78a-4304-afce-fddccf4f71ed` turn `a4302a85-fdde-41ea-91db-5bd8460490a6`: **missing_on_disk** hint=`artifacts/task-20260725-782f378f/hf-project`
- `web-s_43109d40-b53b-440f-809f-cdcf68678a52` turn `43891ff4-1de1-4d2e-995d-3752d9721025`: **missing_on_disk** hint=`F:/Ai-pilotdeck/.saas-dev-data/tenants/default/cloud-storage/users/1/workspaces/7936dd37-08ca-4a33-a27b-7bbb2467c7be/artifacts/task-20260725-63a3ac28`
- `web-s_43109d40-b53b-440f-809f-cdcf68678a52` turn `da81f46e-d119-4786-8e60-c82a1d97c6e2`: **missing_on_disk** hint=`artifacts/task-20260725-63a3ac28`
- `web-s_43109d40-b53b-440f-809f-cdcf68678a52` turn `2573b393-841b-4c5c-a1a6-ff6bf3c0825b`: **missing_on_disk** hint=`artifacts/task-20260725-63a3ac28`

- JSONL detail: `artifacts\audit\four-line-alignment-2026-07-25.jsonl`
- Generated: 2026-07-25T15:52:55.290Z
