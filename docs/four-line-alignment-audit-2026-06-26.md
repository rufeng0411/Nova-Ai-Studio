# Four-line alignment audit (2026-06-26)

- Tenant: `default`
- Sessions scanned: 140
- Turns audited: 430
- Aligned: 337 (78.4% raw, actionable 96.3% excl. missing_on_disk)

## Label distribution

| Label | Count |
|-------|-------|
| aligned | 337 |
| missing_on_disk | 80 |
| unrecoverable | 3 |
| bare_name_risk | 10 |

## G-4L gates

| ID | Status | Notes |
|----|--------|-------|
| G-4L1 | PASS | Audit completed without crash |
| G-4L2 | PASS | actionable aligned ≥ 85% (actual 96.3%, raw 78.4%) |
| G-4L3 | pending | Run `npm run test:four-line-e2e` |
| G-4L4 | pending | Run catalog legacy backfill |

## Top issue turns

- `web-s_4388f811-a008-4a13-ae2c-2537d391dc05` turn `e6e5e673-0f6f-4650-a399-5f01309da006`: **missing_on_disk** hint=`artifacts/slides-steam-q3`
- `web-s_62819708-c3f8-4fe2-bd53-3cd8ef763315` turn `c5013a38-5812-4dcc-9c5c-2a8e64e92574`: **missing_on_disk** hint=``
- `web-s_62819708-c3f8-4fe2-bd53-3cd8ef763315` turn `e84c3199-d061-4ec8-b530-b6d62e2a45a0`: **unrecoverable** hint=`artifacts/design/steam-2026-q3-recs`
- `web-s_b7bea6d3-e5fe-4e2d-bb95-a01b9781d3c4` turn `cb960f92-c35b-436b-ac50-84b7fd96f7cd`: **missing_on_disk** hint=`artifacts/brand-website-steam-q3-20260625`
- `web-s_4be40a77-4887-4592-9998-880707b55607` turn `5e1433c4-9b47-4412-98d2-723445593bed`: **missing_on_disk** hint=`artifacts/world-cup-card-launch-20260625`
- `web-s_368e1ce9-a5fb-4e75-8beb-6cda335c45f0` turn `c68d2ddc-0ea3-4a0a-975a-fbe52b06f7c3`: **missing_on_disk** hint=`artifacts/research`
- `web-s_511ad3d2-ecf6-4cb6-a3e3-564b551e56f1` turn `3f9ba9e3-7aea-4dbd-a820-616bde658136`: **missing_on_disk** hint=`artifacts/customer-research-steam-china`
- `web-s_fa34b2bd-6b61-4fd6-a1ea-1cb68bf1a2ad` turn `f8f4e73d-cbf4-4717-94ec-ccec8e34a5f1`: **missing_on_disk** hint=`artifacts/steam-sentiment-analysis-20260625-1430`
- `web-s_3ec8978b-3d39-4873-adfa-f93af7227b69` turn `7a3f9abd-b06a-48cc-b02f-57cc1ca73c22`: **missing_on_disk** hint=`artifacts/geo-keyword-research`
- `web-s_c082e142-63c9-4846-b80a-d21199271613` turn `1e768ed6-2c51-451b-bc84-55eafa15ab2e`: **missing_on_disk** hint=`artifacts/rog-intelligence-20260623`
- `web-s_a916d22a-99a5-4106-98ba-b655dff7e811` turn `ca6d10cd-ea0e-4b23-9ca3-f7f5f20fa2a2`: **missing_on_disk** hint=`artifacts/media-smoke/folder-demo`
- `web-s_58f07bd7-b7f0-44af-8e89-c4aa54bc9054` turn `c5464cac-559c-4c91-8bb8-06e6e76ff732`: **missing_on_disk** hint=`artifacts/media-smoke/folder-demo`
- `web-s_c6820a58-3538-4645-b32a-7e84b35742a6` turn `7af74803-589c-40c3-9f45-d1bb84634364`: **missing_on_disk** hint=`artifacts/media-smoke/folder-demo`
- `web-s_dcbd7c25-664e-492f-b3d2-672ec8d6c61f` turn `e4a67efd-b4fb-4e5a-aca1-f664b586857d`: **missing_on_disk** hint=`artifacts/media-smoke/folder-demo`
- `web-s_28b69be4-86bc-4058-b018-dcb46996f51a` turn `3ec42ab3-0bda-40b0-8463-855015b58bec`: **bare_name_risk** hint=`artifacts/lead-magnets/world-cup-2026`
- `web-s_6f273cb6-ecf0-4416-b674-7e64e5713035` turn `cf1df5c2-2f44-483b-823c-9666d4ee752a`: **missing_on_disk** hint=`artifacts/geo/吴裕泰`
- `web-s_6f273cb6-ecf0-4416-b674-7e64e5713035` turn `ad6fe0cf-9791-43f4-b0dd-7c44fa6ee1c8`: **missing_on_disk** hint=`artifacts/geo/吴裕泰`
- `web-s_6f273cb6-ecf0-4416-b674-7e64e5713035` turn `0a979da1-1b59-4a56-aeff-7be78efe5992`: **missing_on_disk** hint=`artifacts/geo/吴裕泰`
- `web-s_6f273cb6-ecf0-4416-b674-7e64e5713035` turn `d1b93831-4ea7-4317-9d9f-8000d9a314b6`: **missing_on_disk** hint=`artifacts/吴裕泰`
- `web-s_6f273cb6-ecf0-4416-b674-7e64e5713035` turn `f5867c05-75a3-4ed0-9e9a-27ee6cfef817`: **missing_on_disk** hint=`artifacts`

- JSONL detail: `artifacts\audit\four-line-alignment-2026-06-26.jsonl`
- Generated: 2026-06-26T01:58:03.468Z
