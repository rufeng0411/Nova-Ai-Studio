# Four-line alignment audit (2026-07-13)

- Tenant: `default`
- Sessions scanned: 178
- Turns audited: 499
- Aligned: 377 (75.6% raw, actionable 93.1% excl. missing_on_disk)

## Label distribution

| Label | Count |
|-------|-------|
| aligned | 377 |
| missing_on_disk | 94 |
| unrecoverable | 5 |
| bare_name_risk | 23 |

## G-4L gates

| ID | Status | Notes |
|----|--------|-------|
| G-4L1 | PASS | Audit completed without crash |
| G-4L2 | PASS | actionable aligned ≥ 85% (actual 93.1%, raw 75.6%) |
| G-4L3 | pending | Run `npm run test:four-line-e2e` |
| G-4L4 | pending | Run catalog legacy backfill |

## Top issue turns

- `web-s_38d8ce2e-384b-42e3-96ac-87b23c2fb823` turn `614f6b8c-63e8-4f97-8c1c-eed357a8dce5`: **missing_on_disk** hint=`artifacts/task-20260711-57a8dce5`
- `web-s_2847ce06-bbb3-4b49-aa28-ad8bf96d6601` turn `4a30e86c-80f6-42da-9e82-b63ebb52e2ce`: **missing_on_disk** hint=`artifacts/task-20260711-bb52e2ce/visuals`
- `web-s_9d3525db-8b80-4948-b4c4-31b18f12e9d9` turn `77913d38-89d3-4fc4-b91c-cf2a7f2d7150`: **missing_on_disk** hint=`artifacts/video-commercial`
- `web-s_947f1b8c-06f9-4016-8156-d1f0eaf46cd0` turn `4e12aadf-9f84-4529-9e99-94e3371b00d8`: **missing_on_disk** hint=`artifacts/geo-razer-pro-click-20260709`
- `web-s_564ba769-ef63-4629-b91c-6e7d5087230e` turn `1beb9452-bc56-446d-8775-d6a77aa634da`: **missing_on_disk** hint=`artifacts/nova-ai-studio-ads-plan`
- `web-s_517c6c7e-3aa2-42b3-9fe8-cc93975da8c0` turn `07ed4460-aca7-445e-99e7-e58f21f4f739`: **missing_on_disk** hint=`artifacts/slides-thunderobot-laptop-showcase-20260706-a1b2c3`
- `web-s_517c6c7e-3aa2-42b3-9fe8-cc93975da8c0` turn `1a0a01bc-ef81-4b5d-8eeb-18c0856b90d9`: **missing_on_disk** hint=`artifacts/slides-thunderobot-laptop-showcase-20260706-a1b2c3`
- `web-s_517c6c7e-3aa2-42b3-9fe8-cc93975da8c0` turn `0c85e430-b736-404e-807a-7ad3a905dd71`: **unrecoverable** hint=``
- `web-s_517c6c7e-3aa2-42b3-9fe8-cc93975da8c0` turn `dd2660a3-8b11-48ff-825e-ea645266ebf3`: **unrecoverable** hint=``
- `web-s_517c6c7e-3aa2-42b3-9fe8-cc93975da8c0` turn `6b5dd7aa-926e-464d-8517-70d0f8c5f25b`: **missing_on_disk** hint=`artifacts/slides-thunderobot-laptop-showcase-20260706-a1b2c3`
- `web-s_517c6c7e-3aa2-42b3-9fe8-cc93975da8c0` turn `87f6908d-a345-459d-949f-cdf2e6b894c0`: **unrecoverable** hint=``
- `web-s_49a9fff6-f88e-47de-a16a-1e122af2233b` turn `811164e1-dbab-4680-b164-dfdeb781f751`: **missing_on_disk** hint=`artifacts/pptx-thunderobot`
- `web-s_49a9fff6-f88e-47de-a16a-1e122af2233b` turn `4a142818-44d0-447e-ba54-9f72c1137024`: **bare_name_risk** hint=`artifacts/pptx-thunderobot`
- `web-s_49a9fff6-f88e-47de-a16a-1e122af2233b` turn `b9ccc6cd-5bf5-4c94-a2a8-a6fa50d3143f`: **bare_name_risk** hint=`artifacts/pptx-thunderobot`
- `web-s_49a9fff6-f88e-47de-a16a-1e122af2233b` turn `e73684d2-2df1-4d91-bd06-c0122d12f63a`: **missing_on_disk** hint=`artifacts/pptx-thunderobot`
- `web-s_49a9fff6-f88e-47de-a16a-1e122af2233b` turn `5f19df32-1571-4bd9-afdc-7eb5b9910d0c`: **bare_name_risk** hint=`artifacts/pptx-thunderobot`
- `web-s_49a9fff6-f88e-47de-a16a-1e122af2233b` turn `b8a2550b-4108-4371-a660-082ed73e514d`: **bare_name_risk** hint=`artifacts/pptx-thunderobot`
- `web-s_aad78932-f7a8-40d8-aedc-e4c102ab7093` turn `db898019-f60e-4b42-b5ee-3568946afd4e`: **missing_on_disk** hint=`artifacts/slides-thunderobot`
- `web-s_aad78932-f7a8-40d8-aedc-e4c102ab7093` turn `8d96d1fe-831d-4cee-9ded-0d34157e1f7d`: **bare_name_risk** hint=``
- `web-s_aad78932-f7a8-40d8-aedc-e4c102ab7093` turn `82bbedf4-d53c-46ad-b423-0c93e28bba55`: **missing_on_disk** hint=``

- JSONL detail: `artifacts\audit\four-line-alignment-2026-07-13.jsonl`
- Generated: 2026-07-13T13:34:20.926Z
