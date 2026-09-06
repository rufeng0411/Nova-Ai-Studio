# Four-line alignment audit (2026-07-02)

- Tenant: `default`
- Sessions scanned: 257
- Turns audited: 811
- Aligned: 590 (72.7% raw, actionable 92.0% excl. missing_on_disk)

## Label distribution

| Label | Count |
|-------|-------|
| missing_on_disk | 170 |
| aligned | 590 |
| unrecoverable | 8 |
| bare_name_risk | 43 |

## G-4L gates

| ID | Status | Notes |
|----|--------|-------|
| G-4L1 | PASS | Audit completed without crash |
| G-4L2 | PASS | actionable aligned ≥ 85% (actual 92.0%, raw 72.7%) |
| G-4L3 | pending | Run `npm run test:four-line-e2e` |
| G-4L4 | pending | Run catalog legacy backfill |

## Top issue turns

- `web-s_94761807-c26c-40c5-9406-999a566871e5` turn `1614a957-4b8e-4b0a-969a-b50ea4978ea0`: **missing_on_disk** hint=`artifacts/worldcup-competitor`
- `web-s_94761807-c26c-40c5-9406-999a566871e5` turn `8eedb2bb-e487-45ef-aab9-d434588010eb`: **missing_on_disk** hint=`artifacts/worldcup-competitor`
- `web-s_94761807-c26c-40c5-9406-999a566871e5` turn `7e8f7f29-6cf1-4078-8d8d-21cd38d99f12`: **missing_on_disk** hint=`artifacts`
- `web-s_5543c814-b835-4302-bd09-59d683af5b23` turn `a53990ad-eec4-4d1f-bb27-feb83f1b3261`: **missing_on_disk** hint=`artifacts/campaign-worldcup2026/social-assets`
- `web-s_5543c814-b835-4302-bd09-59d683af5b23` turn `49494064-70d9-47a3-8d9a-0b977b673560`: **missing_on_disk** hint=`artifacts/campaign-worldcup2026`
- `web-s_5543c814-b835-4302-bd09-59d683af5b23` turn `617f601d-3fb9-4cc9-9b20-854f54de1fa1`: **missing_on_disk** hint=`artifacts/campaign-worldcup2026/social-assets`
- `web-s_5543c814-b835-4302-bd09-59d683af5b23` turn `44619628-73d6-40c0-8cce-f33863be63c0`: **unrecoverable** hint=`artifacts/campaign-worldcup2026/website`
- `web-s_5543c814-b835-4302-bd09-59d683af5b23` turn `85e60504-39a4-46ae-bae9-ae1f31a4dc3d`: **missing_on_disk** hint=`artifacts/campaign-worldcup2026`
- `web-s_5543c814-b835-4302-bd09-59d683af5b23` turn `c89e75db-678c-4bd9-a69d-b1285077f583`: **missing_on_disk** hint=`artifacts/campaign-worldcup2026`
- `web-s_5543c814-b835-4302-bd09-59d683af5b23` turn `8185b4df-c618-4b27-b708-eb2618caa9b7`: **missing_on_disk** hint=`artifacts/campaign-worldcup2026`
- `web-s_52db1d00-cab8-455d-afe9-d486e3c395bb` turn `38a084d0-7833-4341-a420-16aefa379954`: **missing_on_disk** hint=`artifacts/surprise-world-cup-egg`
- `web-s_6f63fe6c-0460-48bb-90f0-114cd0c65e36` turn `b830f2a6-aae9-4205-881e-91744873634f`: **missing_on_disk** hint=`artifacts/football-world-cup-merch`
- `web-s_e33e1f31-06ad-403c-b1ba-9e7a2deb12d8` turn `b70b7156-1834-4cf8-b092-60635b282df6`: **bare_name_risk** hint=`artifacts/design/world-cup-merch-poster`
- `web-s_e33e1f31-06ad-403c-b1ba-9e7a2deb12d8` turn `f0eb471e-9c20-4f47-b243-3ee6d16dbf8a`: **bare_name_risk** hint=`artifacts/design/world-cup-merch-poster`
- `web-s_e33e1f31-06ad-403c-b1ba-9e7a2deb12d8` turn `35075e97-c7ca-4527-ab41-af018b145766`: **unrecoverable** hint=`artifacts/design`
- `web-s_b3faa3cd-cb53-473d-891d-c3114764cca8` turn `33c5c136-d940-466f-8371-4bb0604530ee`: **bare_name_risk** hint=`artifacts/presentation`
- `web-s_a81d2281-7bb4-4162-9be4-a866a7a74186` turn `24439357-cb07-4610-a7be-fc5bfb5df20d`: **missing_on_disk** hint=`artifacts/worldcup-2026-mkt-brief`
- `web-s_a81d2281-7bb4-4162-9be4-a866a7a74186` turn `6a47e57c-d386-4902-8854-9816dae9c89c`: **missing_on_disk** hint=`artifacts/worldcup-2026-mkt-brief`
- `web-s_a81d2281-7bb4-4162-9be4-a866a7a74186` turn `e8f36183-0f47-4709-8b30-e12e2e018a01`: **missing_on_disk** hint=`artifacts/worldcup-2026-mkt-brief`
- `web-s_8ea114de-3afb-467d-be7f-151f515a6662` turn `99caa838-9260-4049-b105-cf23358a8420`: **missing_on_disk** hint=`artifacts/research-worldcup-merchandise-20260702`

- JSONL detail: `artifacts\audit\four-line-alignment-2026-07-02.jsonl`
- Generated: 2026-07-02T14:56:57.040Z
