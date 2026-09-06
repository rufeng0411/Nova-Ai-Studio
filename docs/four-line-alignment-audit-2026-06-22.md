# Four-line alignment audit (2026-06-22)

- Tenant: `default`
- Sessions scanned: 88
- Turns audited: 134
- Aligned: 93 (69.4% raw, actionable 91.2% excl. missing_on_disk)

## Label distribution

| Label | Count |
|-------|-------|
| missing_on_disk | 32 |
| aligned | 93 |
| bare_name_risk | 8 |
| unrecoverable | 1 |

## G-4L gates

| ID | Status | Notes |
|----|--------|-------|
| G-4L1 | PASS | Audit completed without crash |
| G-4L2 | PASS | actionable aligned ≥ 85% (actual 91.2%, raw 69.4%) |
| G-4L3 | pending | Run `npm run test:four-line-e2e` |
| G-4L4 | pending | Run catalog legacy backfill |

## Top issue turns

- `web-s_acdcb4ae-cea2-4c59-a894-18409874fea6` turn `79ac7620-2d5e-4890-8d28-c8d0d7d69136`: **missing_on_disk** hint=`artifacts/last30days-razer-20260621-1430`
- `web-s_c7273358-add6-4c39-9f28-deffd6cbe671` turn `88392a08-7dfe-43ce-835c-d880a313b7f6`: **missing_on_disk** hint=`artifacts/nova-ai-solution`
- `web-s_c7273358-add6-4c39-9f28-deffd6cbe671` turn `74263c98-8138-4aac-9f53-0401a5e7fef1`: **missing_on_disk** hint=`artifacts/nova-ai-solution`
- `web-s_2f3de94f-b382-414d-8f9e-ae367e857a91` turn `733a74c2-3c64-47c0-9af1-cdc9faa08844`: **missing_on_disk** hint=`artifacts/world-cup-2026-hottopics`
- `web-s_2f465b7a-9440-4ca2-96bc-18eade9d2932` turn `f90a8c1c-b6f3-4cea-9e24-05d223ba4ef7`: **bare_name_risk** hint=``
- `web-s_cb9affc2-ee83-44f6-9cfb-841183687ef0` turn `20f6b0b5-88bb-4353-8973-ab521a4adee2`: **missing_on_disk** hint=`artifacts/design/mobile-app-preview`
- `web-s_bc44dae2-b670-4ca1-a7c7-12bc2ca1ac33` turn `adb4f2ef-f56d-4566-b8be-023919975bae`: **missing_on_disk** hint=`mnt/user-data/workspace`
- `web-s_bc44dae2-b670-4ca1-a7c7-12bc2ca1ac33` turn `2d779bfd-a8c4-4e10-b963-f3692e74ab3c`: **missing_on_disk** hint=`artifacts/images`
- `web-s_a004f50c-c186-48b8-8320-94444df3a23a` turn `ddeabda0-bf5c-46fb-b570-305d06e695ac`: **missing_on_disk** hint=`artifacts/media-smoke`
- `web-s_9dd57592-51df-4ae6-be40-69c90d8f98d9` turn `bfa52d5c-9d69-4cce-9436-ad9611809ae0`: **missing_on_disk** hint=`artifacts/canvas-e2e-playwright/fixtures`
- `web-s_610e2d6b-b38e-4d04-9aa0-97df15588d8b` turn `753c423c-cb93-4ea2-90d6-9645feb09f9c`: **missing_on_disk** hint=`artifacts/media-smoke/folder-demo`
- `web-s_d180fef5-bf83-4f10-98dd-ec67f7e751e3` turn `00eaea8b-9bd4-4417-942a-b3bca40633fd`: **missing_on_disk** hint=`F:/Ai-pilotdeck/.saas-dev-data/tenants/default`
- `web-s_caf0860c-0068-46f5-84ef-fab94e6b63e7` turn `e5dfb733-6070-4aee-be44-d8808f34b412`: **bare_name_risk** hint=``
- `web-s_c783cfec-6a53-4ae0-9eb6-a217519987a9` turn `4af50e39-7bec-4529-9487-dc62280d62bd`: **missing_on_disk** hint=`assets`
- `web-s_af97228e-8364-4b9f-91e2-17d04fb4df58` turn `2f35f7cc-a74c-4496-9ce8-90c8de9a079f`: **missing_on_disk** hint=`artifacts`
- `web-s_ac7a8fca-e06c-48f6-b3fb-e4f2f443b558` turn `6a32d132-fa95-4954-b522-d2ccc7a70a0a`: **bare_name_risk** hint=``
- `web-s_9f55df12-04ac-44be-9e3c-000c5094da80` turn `a1ffeb8a-f9bc-4881-840d-9275ab352981`: **unrecoverable** hint=``
- `web-s_9f55df12-04ac-44be-9e3c-000c5094da80` turn `641ea3e3-5a11-46f9-b034-9873ef0cb299`: **bare_name_risk** hint=``
- `web-s_e3fb9465-77d7-4bd7-a720-16f08e374fd3` turn `218d3568-5dfd-474a-8d88-a06dd2a00eb4`: **missing_on_disk** hint=`artifacts/slides-rog-dashao-you`
- `web-s_c3c22f41-66ef-45d4-977b-173f2992442d` turn `f00041ad-5220-4f90-affb-7b5fe0ba8027`: **missing_on_disk** hint=`reports`

- JSONL detail: `artifacts\audit\four-line-alignment-2026-06-22.jsonl`
- Generated: 2026-06-22T05:51:37.818Z
