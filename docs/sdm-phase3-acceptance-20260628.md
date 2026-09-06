# SDM Phase 3 验收报告（2026-06-28）

## 范围

Session Deliverable Manifest（SDM）Goal Loop Phase 3：引擎编译/持久化、验收续跑、UI 汇总表与 dock 进度。

权威规格：`docs/session-deliverable-manifest-spec.zh-CN.md`  
冲突矩阵：`docs/sdm-phase3-conflict-matrix.zh-CN.md`

## 自动化门禁

| `npm run test:sdm:unit` | compile / mutation / mount policy SDM |
| `tests/web/server/messages.sdm-hydrate.test.ts` | messages.js SDM 字段映射 |
| `ui/src/shared/deliverableSummaryMountPolicy.sdm-live.test.ts` | 有 SDM 无 deliverable 正则仍 mount |
| `npm run test:sdm:replay` | WC-01/05/06 + AR-Pivot fixtures |
| `npm run test:sdm:acceptance` | 上列 + goal-loop 子集 |
| Playwright `sdm-session-manifest.spec.ts` | snapshot 接线 + live（`SDM_E2E=1`） |

## 接线修复（2026-07-03）

### 根因与修复

| 层级 | 问题 | 修复 |
|------|------|------|
| 历史 API | `readSessionMessages` 写了 SDM，但 `messages.js` 未映射 | `mapWebMessageToNormalized` 增加 `sessionDeliverableManifest` |
| 实时 WS | 回合结束 acceptance meta 未 patch 到 assistant 气泡 | 引擎 `turn_acceptance_snapshot` → Bridge → `applyTurnAcceptanceSnapshot` |
| Mount 双轨 | dock 用 session cache，mount 仍靠 deliverable 正则 | `DeliverableValidationSessionContext` 同源 SDM + mount 门控 |
| 引擎验收 | 仅 `userGoalImpliesDeliverable` 时 validate | `deliverableTask \|\| SDM slots` |
| Repair 重复 | Bridge 窄正则二次校验 | 有 `turn_acceptance_meta` 时 skip fallback |

### 实时数据流

1. Turn 开始：`session_manifest_updated` → 用户/assistant 气泡带 SDM → skeleton 表可 mount  
2. Turn 结束：`turn_acceptance_snapshot` → 原地 merge `verifiedDeliverablePaths` / `turnAcceptanceMeta`  
3. F5：`messages.js` 映射 SDM + acceptance → 与实时一致  

### 环境变量

- `PILOTDECK_SESSION_DELIVERABLE_MANIFEST=1`（`pack.mjs` / `apply-cloud-perf-env.sh` 生产注入）
- 回滚：`.env` 设 `0` 并 recreate nova 容器

## 自动化门禁（Phase 3 基线）

| `npm run test:sdm:unit` | **11/11 PASS** | compile / mutation / flag-off 降级 |
| `npm run test:sdm:replay` | **5/5 PASS** | WC-01/05/06 + AR-Pivot fixtures |
| `npm run test:sdm:acceptance` | SDM 步骤绿；goal-loop 子集有 2 项历史失败 | `dialogue-stability:historical`、`messages-pane-render` 与 SDM 无关 |
| Playwright `sdm-session-manifest.spec.ts` | **2 pass / 1 skip** | live 需 `SDM_E2E=1` |

## 案例覆盖

| ID | 场景 | 断言 |
|----|------|------|
| WC-01 | Campaign 8 阶段 | SDM 8 slots；jsonl hydrate |
| WC-05 | 社媒轮播 | 短 goal 编译 slots（D 类） |
| WC-06 | 行业市场 | md/pdf/html kinds |
| AR-Pivot | md→PDF | manifestVersion++；pdf slot |

## 生产开关

- `pack.mjs` / `apply-cloud-perf-env.sh` 默认注入 `PILOTDECK_SESSION_DELIVERABLE_MANIFEST=1`
- 回滚：`.env` 设 `0` 并 recreate nova 容器

## 已知限制

- P3-9 流程模板预编译 SDM：后续迭代
- Live WC E2E 依赖 dev:saas + `SDM_E2E=1`
