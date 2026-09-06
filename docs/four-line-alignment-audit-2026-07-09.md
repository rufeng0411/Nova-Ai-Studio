# Four-line alignment audit (2026-07-09)

- Tenant: `default`
- Sessions scanned: 379
- Turns audited: 1323
- Aligned: 837 (63.3% raw, actionable 87.6% excl. missing_on_disk)

## Label distribution

| Label | Count |
|-------|-------|
| aligned | 837 |
| bare_name_risk | 101 |
| missing_on_disk | 367 |
| unrecoverable | 18 |

## G-4L gates

| ID | Status | Notes |
|----|--------|-------|
| G-4L1 | PASS | Audit completed without crash |
| G-4L2 | PASS | actionable aligned ≥ 85% (actual 87.6%, raw 63.3%) |
| G-4L3 | pending | Run `npm run test:four-line-e2e` |
| G-4L4 | pending | Run catalog legacy backfill |

## Top issue turns

- `web-s_d7890d1d-196c-4f5d-923f-593667301606` turn `747224d7-3f5d-4da7-bb2e-96f8697604b3`: **bare_name_risk** hint=`artifacts/razer-pro-click-geo`
- `web-s_d7890d1d-196c-4f5d-923f-593667301606` turn `20325714-168c-4f22-b12b-2d5b0dc4cc56`: **bare_name_risk** hint=`artifacts/razer-pro-click-geo`
- `web-s_d7890d1d-196c-4f5d-923f-593667301606` turn `240bdf4c-429f-42da-97a6-cc43604d60ba`: **bare_name_risk** hint=`artifacts/razer-pro-click-geo`
- `web-s_d7890d1d-196c-4f5d-923f-593667301606` turn `0596dd1d-0f81-45ba-af79-f6c7057a0257`: **bare_name_risk** hint=`artifacts/razer-pro-click-geo`
- `web-s_d7890d1d-196c-4f5d-923f-593667301606` turn `d6ba6fc4-3af5-49d8-a62f-25b99e5abe94`: **bare_name_risk** hint=`artifacts/razer-pro-click-geo`
- `web-s_dc7a63d3-eef6-423e-81df-1e0d7a485f53` turn `88fa0dc6-1d59-4af8-9b20-cc6ae8629df2`: **bare_name_risk** hint=`artifacts/geo/razer-blade`
- `web-s_dc7a63d3-eef6-423e-81df-1e0d7a485f53` turn `8b8a54fb-3df8-4d27-916d-9a782150e268`: **bare_name_risk** hint=`artifacts/geo/razer-blade`
- `web-s_dc7a63d3-eef6-423e-81df-1e0d7a485f53` turn `72f4dfff-06e7-468d-81c8-11166867d3c5`: **missing_on_disk** hint=`artifacts/geo`
- `web-s_dc7a63d3-eef6-423e-81df-1e0d7a485f53` turn `784af139-9305-44fd-9961-1f84c59be14a`: **missing_on_disk** hint=`artifacts/geo/razer-blade/drafts`
- `web-s_dc7a63d3-eef6-423e-81df-1e0d7a485f53` turn `a81569c8-1cf6-435c-a607-a2a1a92d5437`: **missing_on_disk** hint=`artifacts/geo`
- `web-s_dc7a63d3-eef6-423e-81df-1e0d7a485f53` turn `08167350-d320-4ecd-b7df-c7bf3b5c2b2a`: **missing_on_disk** hint=`artifacts/geo`
- `web-s_dc7a63d3-eef6-423e-81df-1e0d7a485f53` turn `536394f0-d525-4d22-b537-28bff321b7ce`: **missing_on_disk** hint=`artifacts/geo`
- `web-s_dc7a63d3-eef6-423e-81df-1e0d7a485f53` turn `99252141-b6bd-497c-8dd1-12b322f80cdf`: **missing_on_disk** hint=``
- `web-s_dc7a63d3-eef6-423e-81df-1e0d7a485f53` turn `09910f6e-30d6-4902-a9b4-6e80ed1db57a`: **missing_on_disk** hint=`artifacts/geo/razer-blade`
- `web-s_dc7a63d3-eef6-423e-81df-1e0d7a485f53` turn `e8b91c64-7e8c-4162-a1b6-96b6e0624d81`: **missing_on_disk** hint=`artifacts/geo/razer-blade`
- `web-s_dc7a63d3-eef6-423e-81df-1e0d7a485f53` turn `7f894e3f-a2ab-4293-81c6-fe98791ec303`: **bare_name_risk** hint=`artifacts/geo/razer-blade`
- `web-s_dc7a63d3-eef6-423e-81df-1e0d7a485f53` turn `6f53bf34-9390-4f45-881e-ffa60855d311`: **missing_on_disk** hint=`artifacts/geo`
- `web-s_d45a0ed0-fcf1-4270-bcc7-fd983aee7f4c` turn `62ff47c4-a9ad-4995-be8c-e99f9e501f1a`: **missing_on_disk** hint=`artifacts/monitor-razer-blade-20260709`
- `web-s_5b0b160a-a232-4e04-a833-04a8f3ee49e6` turn `2a11ed03-d60f-4ccd-838d-b3698c999386`: **missing_on_disk** hint=`artifacts/campaign/xiaoguancha-cold-brew-2026`
- `web-s_b3484e82-ccd4-4a99-96cc-748233d06c78` turn `772a9022-89bb-4445-a2ce-1450a96f8b8a`: **missing_on_disk** hint=`artifacts/slides-thunderobot-laptop-20260708-1430`

- JSONL detail: `artifacts\audit\four-line-alignment-2026-07-09.jsonl`
- Generated: 2026-07-09T07:10:44.385Z
