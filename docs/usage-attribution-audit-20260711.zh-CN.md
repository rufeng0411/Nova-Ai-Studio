# 路由用量归因审计报告

**生成时间**：2026-07-11T10:06:26.606Z
**stats.jsonl**：`C:\Users\rufen\.pilotdeck\router\stats.jsonl`
**记录数**：19,143 · **会话数**：888

## owner 映射

| 指标 | 数量 |
|------|------|
| owner 命中 | 144 |
| owner 缺失 | 744 |
| 仅变体命中 (web:s_ ↔ web-s_) | 0 |

## 三分桶（全量 jsonl）

| 桶 | session 数 | Token | 请求 |
|----|-----------|-------|------|
| 已归属 user | 146 | — | — |
| 后台 tenant:* | 471 | — | — |
| 系统/历史 __system__ | 209 | — | — |

| 用户/桶 | Token | 请求 |
|---------|-------|------|
| default（后台任务） | 1,652,081,563 | 13,343 |
| admin | 275,046,942 | 2,734 |
| 系统/历史 | 121,208,045 | 2,422 |
| tenantb | 378,320 | 16 |
| tenanttest | 11 | 1 |

## 全量 jsonl vs dashboard 每项目 slice(-1000)

| 维度 | 全量 | slice | 差值 |
|------|------|-------|------|
| Token | 2,048,714,881 | 1,868,995,327 | 179,719,554 |
| 请求 | 18,516 | 16,741 | 1,775 |

> KPI「未归属」计数仅计 __system__ session 数（209），非表格全部无用户名 Token。

## projectPath 分布（record 级）

- **legacy-pilotdeck**：1,358
- **other**：1,228
- **saas-tenant**：16,557

## Top20 高消耗无 userId session

| sessionId | Token | 请求 | projectPath | owner | 变体 |
|-----------|-------|------|-------------|-------|------|
| `web-s_e67172cc-3be7-4c8c…` | 73,610,123 | 486 | ces\1260c63f-cc44-4761-b77c-7a711c6c7d0f | N | N |
| `web-s_94761807-c26c-40c5…` | 62,242,886 | 432 | ces\e9af480d-9f2c-41e2-b02f-ef40725cae13 | N | N |
| `web-s_a42f04d0-57d1-4f64…` | 41,012,614 | 288 | ces\1260c63f-cc44-4761-b77c-7a711c6c7d0f | N | N |
| `web-s_3ef112c8-135c-448d…` | 37,433,890 | 252 | ces\054848eb-e723-4fd7-b199-2ecf82922212 | N | N |
| `web-s_f8795d13-3bdd-475c…` | 36,909,564 | 246 | ces\852d15a3-7335-4cf5-b7ec-c02c942c4357 | N | N |
| `web-s_57dfa750-7a52-4e5f…` | 31,056,616 | 212 | ces\1260c63f-cc44-4761-b77c-7a711c6c7d0f | N | N |
| `web-s_4a9605af-88aa-47ae…` | 30,647,581 | 198 | ces\852d15a3-7335-4cf5-b7ec-c02c942c4357 | N | N |
| `web-s_6f273cb6-ecf0-4416…` | 24,459,374 | 167 | ces\581758ca-f90d-493f-aa51-14bf68222dfe | N | N |
| `web-s_606d6fa5-2189-4de5…` | 21,802,703 | 174 | ces\ce5b5e79-a714-4a9f-bb5b-fe8cf5eec0ff | N | N |
| `web-s_433ce25a-8de9-4565…` | 20,941,245 | 146 | ces\852d15a3-7335-4cf5-b7ec-c02c942c4357 | N | N |
| `web-s_cfc4ceb2-9da1-4679…` | 20,527,639 | 125 | ces\f24faa9b-0dca-4d7f-a7e0-0cad1c018d52 | N | N |
| `web-s_0dd9097f-1a97-4ea7…` | 20,365,308 | 139 | ces\1260c63f-cc44-4761-b77c-7a711c6c7d0f | N | N |
| `web-s_ea380742-23eb-4585…` | 19,772,885 | 145 | ces\ce5b5e79-a714-4a9f-bb5b-fe8cf5eec0ff | N | N |
| `web-s_79726ef1-7766-42f9…` | 19,118,875 | 136 | ces\3bf5f9f2-ceec-4a89-8e63-8e883c4968cc | N | N |
| `web-s_49a9fff6-f88e-47de…` | 18,772,485 | 123 | ces\aaea97be-fddc-4fb4-bc33-ef302952e7e8 | N | N |
| `web-s_b2721bdd-b5c6-4168…` | 17,472,640 | 116 | ces\aaea97be-fddc-4fb4-bc33-ef302952e7e8 | N | N |
| `web-s_706c4514-c375-472f…` | 16,459,402 | 117 | ces\852d15a3-7335-4cf5-b7ec-c02c942c4357 | N | N |
| `web-s_67b93d20-098c-47a3…` | 15,417,469 | 105 | ces\ce5b5e79-a714-4a9f-bb5b-fe8cf5eec0ff | N | N |
| `web-s_c2108311-427b-4737…` | 15,385,847 | 120 | ces\054848eb-e723-4fd7-b199-2ecf82922212 | N | N |
| `web-s_2c427f1d-783a-48b2…` | 15,059,760 | 106 | ces\86a31ca0-168c-4462-9d85-7636d3d5cd86 | N | N |

---
audit_only — 未改写 stats.jsonl