# Four-line alignment audit (2026-06-24)

- Tenant: `default`
- Sessions scanned: 103
- Turns audited: 161
- Aligned: 105 (65.2% raw, actionable 92.1% excl. missing_on_disk)

## Label distribution

| Label | Count |
|-------|-------|
| missing_on_disk | 47 |
| bare_name_risk | 7 |
| aligned | 105 |
| unrecoverable | 2 |

## G-4L gates

| ID | Status | Notes |
|----|--------|-------|
| G-4L1 | PASS | Audit completed without crash |
| G-4L2 | PASS | actionable aligned ≥ 85% (actual 92.1%, raw 65.2%) |
| G-4L3 | pending | Run `npm run test:four-line-e2e` |
| G-4L4 | pending | Run catalog legacy backfill |

## Top issue turns

- `web-s_6f273cb6-ecf0-4416-b674-7e64e5713035` turn `cf1df5c2-2f44-483b-823c-9666d4ee752a`: **missing_on_disk** hint=`artifacts/geo/吴裕泰`
- `web-s_f442dace-082d-487a-9a0d-297e774f8acc` turn `d6461d75-067f-4170-a918-544bd3fa5d7a`: **missing_on_disk** hint=`artifacts/media-smoke/folder-demo`
- `web-s_59b82cad-2bf3-48cf-8ae0-10586f09d7f4` turn `9d4c1096-87a8-4f1e-b06f-ae854388a847`: **bare_name_risk** hint=`artifacts/design/directory-list-failed`
- `web-s_c86761db-b6cd-4f1e-8364-fbca1d793d52` turn `7f9b0403-3759-48c0-a9d5-cadd16990be1`: **unrecoverable** hint=``
- `web-s_8f4edbc8-4684-4ced-834a-38ef1c6c6f8f` turn `d9c5448d-f0a4-469f-9014-a12a8116e54f`: **missing_on_disk** hint=``
- `web-s_d7318a85-c1ac-49ff-aa33-c6d06554e000` turn `6453b752-a864-48bf-8433-d0a2fe8932f9`: **missing_on_disk** hint=`artifacts/design/razer-blade-2026-sales-plan`
- `web-s_e7fc6e09-70c9-4695-88a2-417867be1b05` turn `630b0f06-e84f-4426-bcfd-985131bccd69`: **missing_on_disk** hint=`artifacts/social-razer-blade-2026-20260623-1500`
- `web-s_c082e142-63c9-4846-b80a-d21199271613` turn `1e768ed6-2c51-451b-bc84-55eafa15ab2e`: **missing_on_disk** hint=`artifacts/rog-intelligence-20260623`
- `web-s_02e3cec7-9ac9-49b3-9183-62d082fec12f` turn `b116bd53-021f-4785-aa48-37a245420355`: **missing_on_disk** hint=`artifacts/razer-blade-5090-geo-20260623/02-pd-geo`
- `web-s_02e3cec7-9ac9-49b3-9183-62d082fec12f` turn `fe8d675f-4a64-4994-b1b8-8dcbe1f1e7e4`: **missing_on_disk** hint=``
- `web-s_2f9dd292-e01f-4439-a5d6-ca0919f8b65f` turn `cff63394-e718-4713-8712-ffa3120400f7`: **missing_on_disk** hint=`artifacts/slides-razer-blade-geo-20260623-1430`
- `web-s_b7b6c334-699d-48cb-ab4d-b3ca676d727e` turn `83045f56-4ca4-43db-81cb-ba73458fb920`: **missing_on_disk** hint=``
- `web-s_b360d7ca-c456-49c3-afe3-166f4375b2a7` turn `30f354da-30e6-45ca-8459-5bd42627ce40`: **missing_on_disk** hint=`artifacts/razer-blade-2026-monitor-20260622`
- `web-s_2cd092ec-aee9-4914-a3ce-94cfaa4c8627` turn `1924a72b-68e4-44cc-bf3e-5096bc2b25da`: **missing_on_disk** hint=`artifacts/geo/razer-blade-20260623`
- `web-s_03dfd3dd-a581-4660-a8a6-67631641b9ac` turn `bc042967-1847-4742-aeb9-901405127437`: **missing_on_disk** hint=`artifacts/razer-blade-2026-geo/content`
- `web-s_03dfd3dd-a581-4660-a8a6-67631641b9ac` turn `66011966-6553-4c24-8a2f-c7736a6aa158`: **missing_on_disk** hint=`artifacts/razer-blade-2026-geo/xiaohongshu-draft`
- `web-s_03dfd3dd-a581-4660-a8a6-67631641b9ac` turn `9689defe-f4bb-411e-8e40-6ae86bd1c2f7`: **missing_on_disk** hint=`artifacts/razer-blade-2026-geo/content`
- `web-s_03dfd3dd-a581-4660-a8a6-67631641b9ac` turn `4da8ea32-23a3-414a-8741-604bf77dd654`: **missing_on_disk** hint=`ai-video-template/src`
- `web-s_03dfd3dd-a581-4660-a8a6-67631641b9ac` turn `fd5fd338-fa5a-4b17-b425-749e02359da9`: **missing_on_disk** hint=``
- `web-s_03dfd3dd-a581-4660-a8a6-67631641b9ac` turn `4dadef32-3294-4d78-8f1b-3a0a22997823`: **missing_on_disk** hint=`artifacts/razer-blade-2026-geo/content`

- JSONL detail: `artifacts\audit\four-line-alignment-2026-06-24.jsonl`
- Generated: 2026-06-24T06:36:30.014Z
