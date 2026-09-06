# Four-line alignment audit (2026-06-30)

- Tenant: `default`
- Sessions scanned: 193
- Turns audited: 613
- Aligned: 472 (77.0% raw, actionable 94.8% excl. missing_on_disk)

## Label distribution

| Label | Count |
|-------|-------|
| missing_on_disk | 115 |
| aligned | 472 |
| bare_name_risk | 22 |
| unrecoverable | 4 |

## G-4L gates

| ID | Status | Notes |
|----|--------|-------|
| G-4L1 | PASS | Audit completed without crash |
| G-4L2 | PASS | actionable aligned ≥ 85% (actual 94.8%, raw 77.0%) |
| G-4L3 | pending | Run `npm run test:four-line-e2e` |
| G-4L4 | pending | Run catalog legacy backfill |

## Top issue turns

- `web-s_86e5c051-53a1-4b09-bc29-bf221fed896d` turn `7f464b3d-d8af-471b-b5bf-5efc66fc755c`: **missing_on_disk** hint=`artifacts/media-smoke/folder-demo`
- `web-s_606d6fa5-2189-4de5-b442-30a22a18d864` turn `abc06574-d153-44a0-bcec-5192e0d9fcf5`: **missing_on_disk** hint=`artifacts/argentina-travel-2025`
- `web-s_606d6fa5-2189-4de5-b442-30a22a18d864` turn `205c79fc-28f9-4ad7-8621-d2aefd41ca0d`: **missing_on_disk** hint=`artifacts/argentina-travel-2025`
- `web-s_bcdca85b-869d-4e88-9aaa-60f51c99f6f3` turn `98fe3bfb-7139-46b8-952b-c03500b73da9`: **missing_on_disk** hint=`artifacts/argentina-travel-report`
- `web-s_f8028ecd-4325-4173-85f5-8cd7185d5f92` turn `177ec64f-0d7a-47f9-9bfa-a8ea0f61cbcf`: **bare_name_risk** hint=`artifacts/design/argentina-travel-poster`
- `web-s_f8028ecd-4325-4173-85f5-8cd7185d5f92` turn `e2829908-d952-4a1a-9fbf-96f734b39801`: **missing_on_disk** hint=`artifacts/design/argentina-travel-2026`
- `web-s_f8028ecd-4325-4173-85f5-8cd7185d5f92` turn `748265c1-39a2-417e-8fc5-bbbf2e752913`: **missing_on_disk** hint=`artifacts/canvas-argentina-travel`
- `web-s_f8028ecd-4325-4173-85f5-8cd7185d5f92` turn `db5d5679-b758-4413-bc75-cedc03688c24`: **bare_name_risk** hint=`artifacts/canvas-argentina-travel`
- `web-s_f8028ecd-4325-4173-85f5-8cd7185d5f92` turn `a17abaa0-537b-4af1-8b10-1d23472007d6`: **missing_on_disk** hint=`artifacts/argentina-travel-poster-2026`
- `web-s_f8028ecd-4325-4173-85f5-8cd7185d5f92` turn `2fe2386c-6508-4488-bd31-e313e81549ce`: **missing_on_disk** hint=`artifacts/argentina-travel-final`
- `web-s_383b1628-992b-443b-bc30-1ceb0a9d0faa` turn `54edf009-d885-4f72-a5d2-db68aa43261c`: **missing_on_disk** hint=`artifacts/videos/argentina-tourism-20260629`
- `web-s_d6666011-d32d-4229-aafc-b032ab23ce2a` turn `39e0de41-9f8f-46c5-af4c-ec4b345cbb60`: **missing_on_disk** hint=`artifacts/social-matrix/argentina-travel/visuals`
- `web-s_d6666011-d32d-4229-aafc-b032ab23ce2a` turn `e1c01eb5-5063-48e8-9893-5a0eb0b4cb9c`: **missing_on_disk** hint=`artifacts/social-matrix/argentina-travel/yixiaoer`
- `web-s_66c4ceee-94df-4582-9f4d-6abd9741a60f` turn `400c52d4-ddfc-4469-93bc-4d7be73722fb`: **bare_name_risk** hint=`artifacts/research-阿根廷旅游竞品对标-20260629`
- `web-s_66c4ceee-94df-4582-9f4d-6abd9741a60f` turn `db19a5e7-4e55-4419-9337-7df0bda689a1`: **missing_on_disk** hint=`artifacts/research-阿根廷旅游竞品对标-20260629`
- `web-s_66c4ceee-94df-4582-9f4d-6abd9741a60f` turn `44638643-e117-422f-95c9-579f49a6b5ea`: **bare_name_risk** hint=`artifacts/research-阿根廷旅游竞品对标-20260629`
- `web-s_9386c29a-1493-45ad-a0e6-96b4432129bd` turn `46aa99db-2580-4c79-bf6a-191795f1b5c1`: **missing_on_disk** hint=`artifacts/design/argentina-digits`
- `web-s_13422808-ae5f-43d3-96a8-63e3d50b0da4` turn `e5342fb6-d1db-437e-9a39-85d391423890`: **bare_name_risk** hint=`artifacts/research-argentina-tourism-20260629-1430`
- `web-s_7a7c8592-000e-4d36-90bc-fcccd0b0b0be` turn `6a08b8ca-f056-4bff-b4aa-2ca43af04173`: **missing_on_disk** hint=`artifacts/slides-argentina-travel`
- `web-s_7f49e255-ec60-4b47-8a22-e974b7fa94f4` turn `4d7ec890-ed94-4148-9b89-eda279ca4fac`: **bare_name_risk** hint=`artifacts/argentina-travel-insights-20260629-1600`

- JSONL detail: `artifacts\audit\four-line-alignment-2026-06-30.jsonl`
- Generated: 2026-06-30T12:48:31.358Z
