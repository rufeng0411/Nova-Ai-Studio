# Four-line alignment audit (2026-07-01)

- Tenant: `default`
- Sessions scanned: 228
- Turns audited: 739
- Aligned: 553 (74.8% raw, actionable 93.1% excl. missing_on_disk)

## Label distribution

| Label | Count |
|-------|-------|
| missing_on_disk | 145 |
| aligned | 553 |
| bare_name_risk | 36 |
| unrecoverable | 5 |

## G-4L gates

| ID | Status | Notes |
|----|--------|-------|
| G-4L1 | PASS | Audit completed without crash |
| G-4L2 | PASS | actionable aligned ≥ 85% (actual 93.1%, raw 74.8%) |
| G-4L3 | pending | Run `npm run test:four-line-e2e` |
| G-4L4 | pending | Run catalog legacy backfill |

## Top issue turns

- `web-s_c2108311-427b-4737-b53f-fc836ac73fd1` turn `094de39a-0469-4ae1-bb73-b916451cf04a`: **missing_on_disk** hint=`artifacts/norway-worldcup-2026`
- `web-s_c2108311-427b-4737-b53f-fc836ac73fd1` turn `d7b3e26d-7b2f-4efa-9764-804e34069024`: **missing_on_disk** hint=`artifacts/norway-worldcup-2026`
- `web-s_3ef112c8-135c-448d-be45-92c9c82d3422` turn `2393624a-1a87-4500-b415-0de52929dce5`: **missing_on_disk** hint=`artifacts/norway-worldcup-2026`
- `web-s_3ef112c8-135c-448d-be45-92c9c82d3422` turn `cc1d3e74-2de6-41e0-b7a1-40d0343d5b6f`: **bare_name_risk** hint=`artifacts/norway-worldcup-2026`
- `web-s_ea380742-23eb-4585-82c8-12439cc41651` turn `ec92f923-ef65-4cf1-99c8-c40a0f931a2d`: **missing_on_disk** hint=`artifacts/geo/nanmei-lvyou`
- `web-s_b61d279a-029f-47eb-9b7a-16d90c9a80da` turn `3252d2ce-9fc4-4446-90ed-6da1c494e6c0`: **bare_name_risk** hint=`artifacts/research-haaland-fan-economy`
- `web-s_a9597e29-f9f7-49eb-a278-7675c273c2e8` turn `7cb513be-98c8-4f49-bbce-4e39b90cc774`: **missing_on_disk** hint=`artifacts/slides-norway-worldcup2026-b7d3e1`
- `web-s_ab936c73-b6af-4d8d-bc19-0952f123a945` turn `d286570c-70c6-497d-8bcd-3986bcef4d5e`: **bare_name_risk** hint=`artifacts/research/nova-southamerica-tour`
- `web-s_ab936c73-b6af-4d8d-bc19-0952f123a945` turn `37b5c492-3f52-4725-b6bf-3b3656b47360`: **bare_name_risk** hint=`artifacts/research/nova-southamerica-tour`
- `web-s_c4a25024-69ec-40f2-8593-8fc8dbb7befa` turn `616835a2-ac49-4080-a9e5-336a3a8347cf`: **missing_on_disk** hint=`artifacts/geo/norway-football-brand`
- `web-s_ce345f8f-2155-4626-b08e-06e2aa4a8460` turn `57653949-5c65-463f-9e3c-bcbb46f993db`: **bare_name_risk** hint=`artifacts/norway-ecommerce/full-plan-20260701`
- `web-s_67b93d20-098c-47a3-86c8-69a082ae9916` turn `ae5674b3-6cc8-4d8f-b53e-d3df13fe8bc6`: **missing_on_disk** hint=`artifacts/design/south-america-travel-brand/assets`
- `web-s_c2932bb7-013b-4497-8990-741fdf26b276` turn `979fe2ad-5597-4f2e-89a2-f311bd993ffb`: **missing_on_disk** hint=`artifacts/geo/南美旅游`
- `web-s_c2932bb7-013b-4497-8990-741fdf26b276` turn `8e4f81a1-7b81-4598-bf09-c43b14f963fa`: **missing_on_disk** hint=`artifacts/geo/南美旅游/drafts/social-publish-bundle`
- `web-s_c2932bb7-013b-4497-8990-741fdf26b276` turn `e6fe50d0-f6d8-43c0-86d3-1b85af2c29b6`: **missing_on_disk** hint=`artifacts/geo/南美旅游`
- `web-s_c2932bb7-013b-4497-8990-741fdf26b276` turn `aad65c47-ddd9-4e4a-a0f5-afc51214ed7c`: **missing_on_disk** hint=``
- `web-s_a6d46ad4-733b-47b2-b376-e7dfbbbf34b4` turn `1b1233d0-0fca-4ec7-b41e-bc36b8069709`: **bare_name_risk** hint=`artifacts/research-south-america-tourism-competitor-20260701`
- `web-s_a6d46ad4-733b-47b2-b376-e7dfbbbf34b4` turn `7486bede-5857-4f77-ba23-4a0015760e23`: **bare_name_risk** hint=`artifacts/research-south-america-tourism-competitor-20260701`
- `web-s_e7ae5c97-f859-40df-ac6e-5cf5c89d7553` turn `60c620df-ad43-4d31-a27c-8531c6b5f535`: **missing_on_disk** hint=`artifacts/精密玻璃管行业调研/精密玻璃管行业中国大陆深度调研报告.md](file:/F:/Ai-pilotdeck/.saas-dev-data/tenants/default/cloud-storage/users/1/workspaces/9a498782-6cab-4ca0-b3c7-796926e9af34/artifacts/精密玻璃管行业调研`
- `web-s_dc8f4b37-5887-4ded-88b2-62df5017bab5` turn `2b970b7f-e93a-465d-b0b4-93cbb8b1340b`: **missing_on_disk** hint=`artifacts/南美旅游/TERRA-AUSTRAL-desktop`

- JSONL detail: `artifacts\audit\four-line-alignment-2026-07-01.jsonl`
- Generated: 2026-07-01T17:16:19.011Z
