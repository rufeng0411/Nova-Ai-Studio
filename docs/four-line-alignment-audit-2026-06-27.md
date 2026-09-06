# Four-line alignment audit (2026-06-27)

- Tenant: `default`
- Sessions scanned: 116
- Turns audited: 406
- Aligned: 336 (82.8% raw, actionable 97.4% excl. missing_on_disk)

## Label distribution

| Label | Count |
|-------|-------|
| missing_on_disk | 61 |
| aligned | 336 |
| unrecoverable | 2 |
| bare_name_risk | 7 |

## G-4L gates

| ID | Status | Notes |
|----|--------|-------|
| G-4L1 | PASS | Audit completed without crash |
| G-4L2 | PASS | actionable aligned ≥ 85% (actual 97.4%, raw 82.8%) |
| G-4L3 | pending | Run `npm run test:four-line-e2e` |
| G-4L4 | pending | Run catalog legacy backfill |

## Top issue turns

- `web-s_04e5808b-aa35-4c51-a7c7-3c7ca4de2a22` turn `50407b18-06f8-4e09-8720-f12869d2b911`: **missing_on_disk** hint=`artifacts/canvas-canvas-g700dinghuo-20260627`
- `web-s_dfad1d1e-4853-4826-9c61-1bb845939e57` turn `2d38f009-4e89-4356-bcc0-a50edf97f916`: **missing_on_disk** hint=`artifacts/geo/纵横G700顶火鸣嘀版`
- `web-s_97bdac2c-95ae-4c2b-84af-a6e08edec691` turn `dfa3578a-95e4-4e4b-9680-b6d09ada497f`: **missing_on_disk** hint=`artifacts/research-g700-dinghuo-20260627-1530`
- `web-s_519ed8e8-4f6b-4ff0-bf60-ce5fd2fa9a77` turn `1a00eed7-f1b4-4888-8238-6620d50c1a0f`: **missing_on_disk** hint=`artifacts/media-smoke/folder-demo`
- `web-s_9c27c9e6-36d7-4c0e-875c-f17f45fad1ce` turn `5fd09774-d482-4420-a378-0f02a7202417`: **missing_on_disk** hint=`artifacts/nike-worldcup`
- `web-s_13b8c891-d82b-490a-b137-fa260c168639` turn `3a8aa067-88f4-4a6d-a64b-a0f30bf48eb8`: **missing_on_disk** hint=`artifacts/nike-mercurial-worldcup2026-launch`
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
- `web-s_28b69be4-86bc-4058-b018-dcb46996f51a` turn `3ec42ab3-0bda-40b0-8463-855015b58bec`: **bare_name_risk** hint=`artifacts/lead-magnets/world-cup-2026`
- `web-s_6f273cb6-ecf0-4416-b674-7e64e5713035` turn `cf1df5c2-2f44-483b-823c-9666d4ee752a`: **missing_on_disk** hint=`artifacts/geo/吴裕泰`
- `web-s_6f273cb6-ecf0-4416-b674-7e64e5713035` turn `ad6fe0cf-9791-43f4-b0dd-7c44fa6ee1c8`: **missing_on_disk** hint=`artifacts/geo/吴裕泰`
- `web-s_6f273cb6-ecf0-4416-b674-7e64e5713035` turn `0a979da1-1b59-4a56-aeff-7be78efe5992`: **missing_on_disk** hint=`artifacts/geo/吴裕泰`

- JSONL detail: `artifacts\audit\four-line-alignment-2026-06-27.jsonl`
- Generated: 2026-06-27T16:35:58.583Z
