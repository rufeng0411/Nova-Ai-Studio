# 僵尸 / 死循环会话审计

**生成时间**：2026-07-11T10:06:25.649Z
**扫描 jsonl**：764 · **高风险**：74 · **orphan**：55
**SDM manifest（高风险子集）**：33 / 74

## Telemetry（若存在）

- ui_auto_continue：0
- cold_resume：83
- validate cache：**无独立埋点**；下列 estValidateCalls 为 turn_acceptance + synthetic×2 代理

## 高风险会话

| sessionId | 风险 | synthetic | turn | 删除态 | estValidate | 建议 |
|-----------|------|-----------|------|--------|-------------|------|
| `web-s_3ef112c8-135c-…` | synthetic_storm, acceptance_dense, orphan_transcript | 58 | 6 | orphan | 155 | tombstone/删 |
| `web-s_57dfa750-7a52-…` | synthetic_storm, acceptance_dense, orphan_transcript | 57 | 6 | orphan | 163 | tombstone/删 |
| `web-s_a42f04d0-57d1-…` | synthetic_storm, acceptance_dense, orphan_transcript | 40 | 10 | orphan | 97 | tombstone/删 |
| `web-s_cf11fe6a-8f67-…` | synthetic_storm, acceptance_dense, orphan_transcript | 35 | 8 | orphan | 97 | tombstone/删 |
| `web-s_e67172cc-3be7-…` | synthetic_storm, acceptance_dense, orphan_transcript | 32 | 5 | orphan | 89 | tombstone/删 |
| `web-s_f8795d13-3bdd-…` | synthetic_storm, acceptance_dense, orphan_transcript | 31 | 17 | orphan | 83 | tombstone/删 |
| `web-s_f8028ecd-4325-…` | synthetic_storm, acceptance_dense | 30 | 7 | catalog_active | 77 | 锁定观察 |
| `web-s_c2108311-427b-…` | synthetic_storm, acceptance_dense, orphan_transcript | 25 | 3 | orphan | 73 | tombstone/删 |
| `web-s_3f1fe8e2-2dc5-…` | synthetic_storm, orphan_transcript | 28 | 8 | orphan | 64 | tombstone/删 |
| `web-s_49a9fff6-f88e-…` | synthetic_storm, orphan_transcript | 25 | 8 | orphan | 61 | tombstone/删 |
| `web-s_706c4514-c375-…` | synthetic_storm, acceptance_dense, orphan_transcript | 22 | 11 | orphan | 64 | tombstone/删 |
| `web-s_bcdca85b-869d-…` | synthetic_storm, acceptance_dense, orphan_transcript | 21 | 8 | orphan | 55 | tombstone/删 |
| `web-s_433ce25a-8de9-…` | synthetic_high, acceptance_dense, orphan_transcript | 20 | 16 | orphan | 66 | tombstone/删 |
| `web-s_04e5808b-aa35-…` | synthetic_storm | 27 | 3 | catalog_active | 62 | 锁定观察 |
| `web-s_606d6fa5-2189-…` | synthetic_storm, orphan_transcript | 24 | 13 | orphan | 56 | tombstone/删 |
| `web-s_4a9605af-88aa-…` | synthetic_storm, orphan_transcript | 24 | 3 | orphan | 57 | tombstone/删 |
| `web-s_0dd9097f-1a97-…` | synthetic_storm, orphan_transcript | 21 | 10 | orphan | 48 | tombstone/删 |
| `web-s_f6708458-41a9-…` | synthetic_high, orphan_transcript | 20 | 4 | orphan | 50 | tombstone/删 |
| `web-s_ab936c73-b6af-…` | synthetic_high, orphan_transcript | 20 | 9 | orphan | 49 | tombstone/删 |
| `web-s_6f273cb6-ecf0-…` | synthetic_storm | 22 | 7 | catalog_active | 51 | 锁定观察 |
| `web-s_0f8abe13-faa3-…` | synthetic_high, orphan_transcript | 18 | 1 | orphan | 39 | tombstone/删 |
| `web-s_ea380742-23eb-…` | synthetic_high, orphan_transcript | 17 | 2 | orphan | 43 | tombstone/删 |
| `web-s_bd5db827-eb8c-…` | synthetic_high, orphan_transcript | 17 | 5 | orphan | 39 | tombstone/删 |
| `web-s_c8448371-9d35-…` | synthetic_high, orphan_transcript | 17 | 6 | orphan | 41 | tombstone/删 |
| `web-s_a3474855-f998-…` | synthetic_high, orphan_transcript | 16 | 6 | orphan | 38 | tombstone/删 |
| `web-s_0156e908-7c6e-…` | synthetic_high, orphan_transcript | 15 | 4 | orphan | 36 | tombstone/删 |
| `web-s_ec45620d-0bc6-…` | synthetic_high | 18 | 5 | catalog_active | 36 | 观察 |
| `web-s_13b8c891-d82b-…` | synthetic_high | 17 | 1 | catalog_active | 37 | 观察 |
| `web-s_e5608ce2-4d7c-…` | synthetic_high | 16 | 2 | catalog_active | 40 | 观察 |
| `web-s_4388f811-a008-…` | synthetic_high | 16 | 2 | catalog_active | 34 | 观察 |
| `web-s_79726ef1-7766-…` | synthetic_high, orphan_transcript | 14 | 3 | orphan | 36 | tombstone/删 |
| `web-s_cfc4ceb2-9da1-…` | synthetic_high, orphan_transcript | 14 | 4 | orphan | 39 | tombstone/删 |
| `web-s_d7890d1d-196c-…` | synthetic_high, orphan_transcript | 14 | 8 | orphan | 34 | tombstone/删 |
| `web-s_d7f5ed9d-bbde-…` | synthetic_high, orphan_transcript | 14 | 5 | orphan | 33 | tombstone/删 |
| `web-s_db1cf7df-f4f3-…` | synthetic_high, orphan_transcript | 14 | 1 | orphan | 40 | tombstone/删 |
| `web-s_9e31b001-0f69-…` | synthetic_high, orphan_transcript | 13 | 4 | orphan | 32 | tombstone/删 |
| `web-s_f290d203-b79b-…` | synthetic_high, orphan_transcript | 13 | 4 | orphan | 29 | tombstone/删 |
| `web-s_3c86f537-5e17-…` | synthetic_high, orphan_transcript | 13 | 1 | orphan | 33 | tombstone/删 |
| `web-s_20c17458-abb8-…` | synthetic_high, orphan_transcript | 12 | 3 | orphan | 31 | tombstone/删 |
| `web-s_67b93d20-098c-…` | synthetic_high, orphan_transcript | 12 | 8 | orphan | 29 | tombstone/删 |
| `web-s_a6d46ad4-733b-…` | synthetic_high, orphan_transcript | 12 | 4 | orphan | 33 | tombstone/删 |
| `web-s_c2932bb7-013b-…` | synthetic_high, orphan_transcript | 12 | 20 | orphan | 28 | tombstone/删 |
| `web-s_d6666011-d32d-…` | synthetic_high, orphan_transcript | 12 | 2 | orphan | 25 | tombstone/删 |
| `web-s_d0f78dd2-dcb1-…` | synthetic_high, orphan_transcript | 12 | 5 | orphan | 28 | tombstone/删 |
| `web-s_04f973b0-3a08-…` | synthetic_high, orphan_transcript | 12 | 4 | orphan | 26 | tombstone/删 |
| `web-s_698c7d3e-4d13-…` | synthetic_high, orphan_transcript | 12 | 18 | orphan | 36 | tombstone/删 |
| `web-s_aad78932-f7a8-…` | synthetic_high, orphan_transcript | 11 | 7 | orphan | 29 | tombstone/删 |
| `web-s_b6ead5e8-26d9-…` | synthetic_high, orphan_transcript | 11 | 5 | orphan | 29 | tombstone/删 |
| `web-s_1e7b4dad-e8f4-…` | synthetic_high, orphan_transcript | 11 | 2 | orphan | 27 | tombstone/删 |
| `web-s_94761807-c26c-…` | synthetic_high, orphan_transcript | 11 | 5 | orphan | 30 | tombstone/删 |