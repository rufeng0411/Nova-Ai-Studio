# Four-line alignment audit (2026-06-25)

- Tenant: `default`
- Sessions scanned: 123
- Turns audited: 396
- Aligned: 314 (79.3% raw, actionable 96.3% excl. missing_on_disk)

## Label distribution

| Label | Count |
|-------|-------|
| aligned | 314 |
| missing_on_disk | 70 |
| bare_name_risk | 10 |
| unrecoverable | 2 |

## G-4L gates

| ID | Status | Notes |
|----|--------|-------|
| G-4L1 | PASS | Audit completed without crash |
| G-4L2 | PASS | actionable aligned ≥ 85% (actual 96.3%, raw 79.3%) |
| G-4L3 | pending | Run `npm run test:four-line-e2e` |
| G-4L4 | pending | Run catalog legacy backfill |

## Top issue turns

- `web-s_22780d4f-491e-438b-bc84-513406d5100b` turn `cc17212f-c349-4e31-bc9c-040c302e1831`: **missing_on_disk** hint=`artifacts/norway-worldcup-2026`
- `web-s_22780d4f-491e-438b-bc84-513406d5100b` turn `62c0a6b0-3ce8-451e-ba1e-5db3e13444f0`: **missing_on_disk** hint=`artifacts/norway-worldcup-2026`
- `web-s_28b69be4-86bc-4058-b018-dcb46996f51a` turn `3ec42ab3-0bda-40b0-8463-855015b58bec`: **bare_name_risk** hint=`artifacts/lead-magnets/world-cup-2026`
- `web-s_6f273cb6-ecf0-4416-b674-7e64e5713035` turn `cf1df5c2-2f44-483b-823c-9666d4ee752a`: **missing_on_disk** hint=`artifacts/geo/吴裕泰`
- `web-s_6f273cb6-ecf0-4416-b674-7e64e5713035` turn `ad6fe0cf-9791-43f4-b0dd-7c44fa6ee1c8`: **missing_on_disk** hint=`artifacts/geo/吴裕泰`
- `web-s_6f273cb6-ecf0-4416-b674-7e64e5713035` turn `0a979da1-1b59-4a56-aeff-7be78efe5992`: **missing_on_disk** hint=`artifacts/geo/吴裕泰`
- `web-s_6f273cb6-ecf0-4416-b674-7e64e5713035` turn `d1b93831-4ea7-4317-9d9f-8000d9a314b6`: **missing_on_disk** hint=`artifacts/吴裕泰`
- `web-s_6f273cb6-ecf0-4416-b674-7e64e5713035` turn `f5867c05-75a3-4ed0-9e9a-27ee6cfef817`: **missing_on_disk** hint=`artifacts`
- `web-s_6f273cb6-ecf0-4416-b674-7e64e5713035` turn `cd8104ed-0df1-4b99-ba5b-d0536195df12`: **missing_on_disk** hint=`artifacts/吴裕泰`
- `web-s_6f273cb6-ecf0-4416-b674-7e64e5713035` turn `96f0a3f2-394f-4e0d-8517-f57109e5079b`: **missing_on_disk** hint=`artifacts/吴裕泰`
- `web-s_5a63edbe-45ad-4f54-b38d-c1722022cdf9` turn `fc20e0e8-8b51-4f64-a94f-2a3e41214a9d`: **missing_on_disk** hint=`artifacts/diagrams`
- `web-s_bf1cde39-74a6-4089-81f7-e538dc56d10c` turn `a5c5c6c4-beb8-4068-885f-eb14ef3931e2`: **missing_on_disk** hint=``
- `web-s_c082e142-63c9-4846-b80a-d21199271613` turn `1e768ed6-2c51-451b-bc84-55eafa15ab2e`: **missing_on_disk** hint=`artifacts/rog-intelligence-20260623`
- `web-s_26db5617-e732-4659-909a-1f379f2696af` turn `15d43148-5985-42ea-9e9f-efc533bdd7e6`: **missing_on_disk** hint=`F:/Ai-pilotdeck/.saas-dev-data/tenants/default/cloud-storage/users/1/workspaces/292fb441-1026-470e-b48f-533a75522a49/artifacts/remotion/norway-world-cup-2026-battlecry`
- `web-s_b3b513c4-bafb-4ee2-a561-8505fa501cca` turn `0317ba8a-f474-42ad-9c2a-600b1d33d093`: **bare_name_risk** hint=`artifacts/norway-viking-worldcup-2026`
- `web-s_b3b513c4-bafb-4ee2-a561-8505fa501cca` turn `565341a3-c799-4e22-8eab-318bfeda8411`: **missing_on_disk** hint=`artifacts/norway-viking-worldcup-2026`
- `web-s_ec45620d-0bc6-4fc1-b083-8081d69e6b44` turn `14002287-bcdb-47e1-80f3-d10d5e4b800b`: **missing_on_disk** hint=`artifacts/world-cup-jerseys`
- `web-s_ec45620d-0bc6-4fc1-b083-8081d69e6b44` turn `53a88e8d-888e-4a58-a1f7-84a1385896c5`: **missing_on_disk** hint=`artifacts/world-cup-jerseys/social-images`
- `web-s_906b1b1a-70e6-47f9-95b6-4702b4602094` turn `a1b915c2-2229-490a-8c3a-a4e036456b78`: **missing_on_disk** hint=`artifacts/norway-worldcup-2026-video`
- `web-s_8931be12-f387-4a3f-b338-bcb34177cd13` turn `625bc209-9eb2-4a13-97e6-a3c5de6dc997`: **missing_on_disk** hint=`artifacts/social-matrix/rog-big-oil-stick/visuals`

- JSONL detail: `artifacts\audit\four-line-alignment-2026-06-25.jsonl`
- Generated: 2026-06-25T02:20:16.407Z
