# Four-line alignment audit (2026-06-29)

- Tenant: `default`
- Sessions scanned: 184
- Turns audited: 578
- Aligned: 450 (77.9% raw, actionable 94.9% excl. missing_on_disk)

## Label distribution

| Label | Count |
|-------|-------|
| bare_name_risk | 20 |
| aligned | 450 |
| missing_on_disk | 104 |
| unrecoverable | 4 |

## G-4L gates

| ID | Status | Notes |
|----|--------|-------|
| G-4L1 | PASS | Audit completed without crash |
| G-4L2 | PASS | actionable aligned ≥ 85% (actual 94.9%, raw 77.9%) |
| G-4L3 | pending | Run `npm run test:four-line-e2e` |
| G-4L4 | pending | Run catalog legacy backfill |

## Top issue turns

- `web-s_f8028ecd-4325-4173-85f5-8cd7185d5f92` turn `177ec64f-0d7a-47f9-9bfa-a8ea0f61cbcf`: **bare_name_risk** hint=`artifacts/design/argentina-travel-poster`
- `web-s_66c4ceee-94df-4582-9f4d-6abd9741a60f` turn `400c52d4-ddfc-4469-93bc-4d7be73722fb`: **bare_name_risk** hint=`artifacts/research-阿根廷旅游竞品对标-20260629`
- `web-s_66c4ceee-94df-4582-9f4d-6abd9741a60f` turn `db19a5e7-4e55-4419-9337-7df0bda689a1`: **missing_on_disk** hint=`artifacts/research-阿根廷旅游竞品对标-20260629`
- `web-s_9386c29a-1493-45ad-a0e6-96b4432129bd` turn `46aa99db-2580-4c79-bf6a-191795f1b5c1`: **missing_on_disk** hint=`artifacts/design/argentina-digits`
- `web-s_13422808-ae5f-43d3-96a8-63e3d50b0da4` turn `e5342fb6-d1db-437e-9a39-85d391423890`: **bare_name_risk** hint=`artifacts/research-argentina-tourism-20260629-1430`
- `web-s_7a7c8592-000e-4d36-90bc-fcccd0b0b0be` turn `6a08b8ca-f056-4bff-b4aa-2ca43af04173`: **missing_on_disk** hint=`artifacts/slides-argentina-travel`
- `web-s_7f49e255-ec60-4b47-8a22-e974b7fa94f4` turn `4d7ec890-ed94-4148-9b89-eda279ca4fac`: **bare_name_risk** hint=`artifacts/argentina-travel-insights-20260629-1600`
- `web-s_7f49e255-ec60-4b47-8a22-e974b7fa94f4` turn `97808c69-393b-449d-b19e-f7d9dc8f6101`: **missing_on_disk** hint=`artifacts/argentina-travel-insights-20260629-1600/index.html](artifacts/argentina-travel-insights-20260629-1600`
- `web-s_7602a9d9-59c1-42a6-a7c8-ba5be6628f0f` turn `b1d82701-bdc4-4e81-976f-d01fdd5f4cf2`: **missing_on_disk** hint=`artifacts/travel-argentina-20260629`
- `web-s_06e12606-e461-47db-bd5e-e0eaecbcf757` turn `86b12778-26cc-45dc-8bdd-26f3eeaebd50`: **missing_on_disk** hint=`artifacts/postgresql-promo-20260628`
- `web-s_24648c74-c351-4873-bbd0-778824d8876a` turn `1d6ce39b-2d1a-4250-bd65-861c10381a03`: **missing_on_disk** hint=`artifacts/argentina-fans-report-2026`
- `web-s_1e2c454e-fa9e-44ba-9e00-28f4345ca9e5` turn `2b170a73-90cf-445a-b202-746268b07eb3`: **missing_on_disk** hint=`artifacts/design/postgres-user-research-video`
- `web-s_1e2c454e-fa9e-44ba-9e00-28f4345ca9e5` turn `442e866d-0db8-4ee8-a11c-d7a83804e1ff`: **bare_name_risk** hint=`artifacts/design/postgres-user-research-video`
- `web-s_1e2c454e-fa9e-44ba-9e00-28f4345ca9e5` turn `d05139d5-412c-4aef-8ece-dccc7a99691f`: **bare_name_risk** hint=`artifacts/design/postgres-user-research-video`
- `web-s_630fdf78-2f9f-4be3-b9f1-982b44a78d64` turn `0783c746-851f-4a7e-ab59-361e28c9b470`: **bare_name_risk** hint=`artifacts/xhs-mate-20260628`
- `web-s_630fdf78-2f9f-4be3-b9f1-982b44a78d64` turn `aa018122-c701-4c67-814f-a42caf120c55`: **bare_name_risk** hint=`artifacts/xhs-mate-20260628`
- `web-s_6647b14f-9a12-4005-a2f7-9120aa1a74a4` turn `11ecc879-5c0b-48a2-8b19-fe1900cbe53b`: **unrecoverable** hint=`artifacts/design/postgres-onboarding`
- `web-s_2829e202-dd54-4776-aa7f-9bcae51e7d5f` turn `527bfeee-b20f-42cf-9fec-78c9e35e7167`: **missing_on_disk** hint=`artifacts/delivery-docs/交付文件汇总-README-20260628`
- `web-s_2829e202-dd54-4776-aa7f-9bcae51e7d5f` turn `a6848c1b-1bab-4a6e-8daf-2d40ebfc5bb5`: **missing_on_disk** hint=`artifacts/618大促`
- `web-s_2829e202-dd54-4776-aa7f-9bcae51e7d5f` turn `6912382e-47a4-4f2e-87f9-3fbe42b9e42d`: **missing_on_disk** hint=`artifacts/delivery-docs/交付文件汇总-README-20260628`

- JSONL detail: `artifacts\audit\four-line-alignment-2026-06-29.jsonl`
- Generated: 2026-06-29T15:41:19.870Z
