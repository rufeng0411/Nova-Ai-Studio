# 全链路性能优化验收报告（2026-07-16）

## 变更摘要

### Track A — 前端（P0）

| 项 | Flag | 状态 |
|----|------|------|
| A1 历史行不传全量 `sessionMessages`，父级 `sessionUserGoalText` | `VITE_MESSAGE_ROW_SESSION_SCOPE=1` | 已落地 |
| A2 流式/续跑间隙 defer pipeline + validate | `VITE_DEFER_DELIVERABLES_WHILE_STREAMING=1` | 已落地 |
| A3 过程分组增量缓存 + 虚拟化阈值 80 | `VITE_PROCESS_GROUPING_INCREMENTAL=1` / `VITE_MESSAGE_VIRTUALIZATION_THRESHOLD=80` | 已落地 |
| A4 bundle 开启时禁用 legacy SDM 全 session 扫描 | `VITE_SESSION_PIPELINE_BUNDLE=1` | 已落地 |

### Track B — Bridge/API

| 项 | Flag / 配置 | 状态 |
|----|-------------|------|
| B1 历史读 fallback 限频 warn | `PILOTDECK_HISTORY_SANITIZE/TAIL_READ`（dev/pack 默认） | 已落地 |
| B2 validate 有限并行 + async FS 生产默认 | `PILOTDECK_VALIDATE_PARALLEL=3` / `PILOTDECK_DELIVERABLE_ASYNC_RESOLVE=1` / `PILOTDECK_ARTIFACT_ROOT_SCAN=1` | 已落地 |
| B3 sessionState LRU 500 + prefetch gate 单测 | `PILOTDECK_BRIDGE_SESSION_STATE_CAP=500` | 已核对 + 单测 |

### Track C — 算力/体验（P1）

| 项 | 状态 |
|----|------|
| C1 compaction 生产灰度 | pack `deploy.env` 默认 `PILOTDECK_TOOL_RESULT_COMPACTION=1` |
| C2 synthetic budget + 排队 UI 真实位次 | pack 默认 `PILOTDECK_SESSION_SYNTHETIC_BUDGET=1`；Composer toast 显示 `queuePosition` |

### Track D — 运维

| 项 | 状态 |
|----|------|
| D1 `scripts/diag/prune-stale-dev-jsonl.mjs` dry-run | 已落地（本地 7 个 >10MB 且 >7 天候选） |
| D2 `session-switch-profile.mjs` P95 门禁 800ms + wedged | 已扩展 |

## 验收命令结果

| 命令 | 结果 |
|------|------|
| `npm --workspace ui test -- perfFeatureFlags sessionDeliverablesPipelineGate sessionMessagePrefetchGate processGrouping MessageRowV2 bridgeSessionStateLru` | **PASS**（33 tests） |
| `npm run test:deliverable-triple-unify` | **PASS** |
| `npm run test:history-messages:quick` | **PASS**（含 fallback warn 单测可见 `[Nova history-read] full-read fallback`） |
| `npm run test:recovery:breakdown` | **PASS** |
| `node scripts/diag/prune-stale-dev-jsonl.mjs` | **PASS**（dry-run，7 候选 / 125MB） |
| `node scripts/diag/session-switch-profile.mjs` | **SKIP**（本机 Bridge 未启动；磁盘基线 229 jsonl / 266MB 已写入 `artifacts/session-switch-profile/`） |
| `npm run test:prelaunch:quick` | **部分 FAIL**（`test:saas:deep` 注册路由 x-forwarded-for、`smoke:capability-hub` 营销 Pill 计数 — 与本次 perf PR 无直接关联） |
| `npm run test:bridge-stability:browse` | **未跑**（需 dev:saas 实机） |

## 回滚速查

| 现象 | 回滚 |
|------|------|
| 历史消息缺失 | `PILOTDECK_HISTORY_TAIL_READ=0` |
| 成果清单异常 | `VITE_SESSION_PIPELINE_BUNDLE=0` + `VITE_DEFER_DELIVERABLES_WHILE_STREAMING=0` |
| 过程区缺失 | `VITE_PROCESS_GROUPING_INCREMENTAL=0` |
| validate 异常 | `PILOTDECK_VALIDATE_PARALLEL=0` |
| 历史行成果回归 | `VITE_MESSAGE_ROW_SESSION_SCOPE=0` |

## 后续实机建议（dev:saas 启动后）

1. `node scripts/diag/session-switch-profile.mjs` — 目标 messages P95 **<800ms**
2. `npm run test:bridge-stability:browse`
3. 120+ 条会话流式手工：滚动/输入不掉帧，turn 末 Dock 与文件夹一致

## 关键文件

- `ui/src/shared/perfFeatureFlags.ts`
- `ui/src/components/chat-v2/MessagesPaneV2.tsx` / `MessageRowV2.tsx` / `ChatInterfaceV2.tsx`
- `ui/src/shared/sessionDeliverablesPipelineGate.ts`
- `ui/src/components/chat-v2/processGrouping.ts`
- `src/web/server/readSessionMessages.ts`
- `ui/server/utils/validateDeliverables.js` / `pathInProject.js`
- `ui/server/saas/bridgeSessionStateLru.js`
- `scripts/diag/prune-stale-dev-jsonl.mjs`
- `scripts/lib/devLauncherCore.mjs` / `scripts/release/pack.mjs`
