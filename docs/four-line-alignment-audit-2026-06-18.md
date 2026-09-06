# Four-line alignment audit (2026-06-18)

- Tenant: `default`
- Sessions scanned: 80
- Turns audited: 140
- Aligned: 66 (47.1%)

## Label distribution

| Label | Count |
|-------|-------|
| aligned | 66 |
| missing_on_disk | 65 |
| bare_name_risk | 7 |
| unrecoverable | 2 |

## G-4L gates

| ID | Status | Notes |
|----|--------|-------|
| G-4L1 | PASS | Audit completed without crash |
| G-4L2 | WARN | aligned ≥ 85% (actual 47.1%) |
| G-4L3 | pending | Run `npm run test:four-line-e2e` |
| G-4L4 | pending | Run catalog legacy backfill |

## Top issue turns

- `web-s_c7ac2869-c39b-4b56-a25a-60c668f4ad72` turn `5057537d-98e2-450b-8ecf-5ffd627343d7`: **missing_on_disk** hint=`artifacts/chinese-grade3-poetry-interactive-ppt`
- `web-s_c7ac2869-c39b-4b56-a25a-60c668f4ad72` turn `7f7b0665-07b5-472d-832e-83024c27be8c`: **missing_on_disk** hint=`artifacts/chinese-grade3-poetry-interactive-ppt`
- `web-s_bb48df5e-5813-437d-8688-35e5b0d60889` turn `7b634186-0ca6-47d7-b105-6bd874ee9cfd`: **bare_name_risk** hint=`artifacts/media-smoke`
- `web-s_b2b1fdd5-a25e-4354-ae3c-a989ae88c851` turn `bfc272ae-91c7-4c1a-a2d3-9dabfaf1303d`: **missing_on_disk** hint=`artifacts/slides-ai-business-growth`
- `web-s_643fc8cf-81cc-434b-a513-8b174fa23bd3` turn `07c48d47-c16f-4006-812e-258a27cc621e`: **missing_on_disk** hint=`artifacts/design/ui-preview-test`
- `web-s_42b809de-6960-4d18-bf39-9eb7c4da13d7` turn `230fe8c9-606d-4026-955c-6c4ca9e6c791`: **missing_on_disk** hint=`artifacts/design/ui-preview-smoke`
- `web-s_2f465b7a-9440-4ca2-96bc-18eade9d2932` turn `ae45be60-c836-428c-b9d7-796ed64eff67`: **missing_on_disk** hint=`artifacts/slides-es9-review`
- `web-s_2a402064-a8ed-4c25-a79a-e28f8896c95c` turn `b053cbb1-01b9-4982-bb0c-226602a50ca0`: **missing_on_disk** hint=`artifacts/design/nike-g700-afterhours`
- `web-s_1a811737-87d9-4bdf-85c1-6ddf520a1355` turn `edfac85d-28ca-4e0c-8e16-f4fe95ee5223`: **missing_on_disk** hint=`artifacts/design/ui-preview-smoke`
- `web-s_f5493283-c3db-45b1-aa56-151685290fe1` turn `767e3b79-747f-4321-858d-30c358b9a3e6`: **missing_on_disk** hint=``
- `web-s_adccfd51-bede-4147-b7da-60039bdcad4e` turn `ce43e539-ffed-4d20-896a-59bf82211a98`: **missing_on_disk** hint=``
- `web-s_adccfd51-bede-4147-b7da-60039bdcad4e` turn `f177fd36-2f44-4b18-95b2-bdd5c868ec53`: **unrecoverable** hint=``
- `web-s_68688be8-6fc2-4b84-bbe9-355c16275392` turn `14319d93-b7d7-4e6d-946c-4487303bc929`: **missing_on_disk** hint=`artifacts/slides-miyazaki`
- `web-s_5c0893a9-5b17-4edb-95f9-9a6cb2653c69` turn `c8404c68-2133-4f43-ad1b-427538e65ec1`: **missing_on_disk** hint=``
- `web-s_3f7143c1-3af0-4a64-8f6a-e874be4bc37c` turn `77588374-e1a0-4e06-b8b5-023973dadbac`: **missing_on_disk** hint=`artifacts/geo/NovaAiStudio/NovaAiStudio-GEO-Report.pptx](artifacts/geo/NovaAiStudio`
- `web-s_cda0c9f2-c81e-4b0d-be94-2d2e949eacd6` turn `279290e9-bf7f-41a7-9a39-6d3d542bb8b0`: **missing_on_disk** hint=`artifacts/semaglutide-figures-20260616`
- `web-s_9e96aaf1-ec18-4d44-8496-c864a38de5b8` turn `4a78e608-829c-48f2-afa5-6ced34c415ad`: **missing_on_disk** hint=`artifacts/slides-xspace-20260616/hermes-cyber-terminal`
- `web-s_219469c1-141b-4d62-80b7-1617ad39e185` turn `584809af-c6cf-402a-af33-76da9d462388`: **missing_on_disk** hint=`artifacts/documents`
- `web-s_219469c1-141b-4d62-80b7-1617ad39e185` turn `a945cf08-61f9-4ab7-842f-59ad57423738`: **missing_on_disk** hint=`artifacts/documents`
- `web-s_13c41acb-2c78-480a-bfcb-7b902bd561e5` turn `e4e46987-fc88-4a55-a887-6e10433efab9`: **missing_on_disk** hint=`artifacts/samsung-smartwatch-20260616-1430/platforms`

- JSONL detail: `artifacts\audit\four-line-alignment-2026-06-18.jsonl`
- Generated: 2026-06-18T07:36:33.251Z
