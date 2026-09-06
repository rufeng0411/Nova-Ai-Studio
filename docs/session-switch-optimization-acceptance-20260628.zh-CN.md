# 会话切换优化验收报告（本地 Tier-1）

**日期**：2026-06-28  
**范围**：`saas_会话性能优化` 计划 PR1–PR5 + Phase5（Tier-1 离线门禁）

## Tier-1 结果（通过）

| 步骤 | 命令 | 结果 |
|------|------|------|
| Pipeline 单测 | `sessionDeliverablePipeline.test.ts` + `sdmProgressDockParity.test.ts` | 4/4 通过 |
| 503 退避 | `fetchWithBackoff.test.ts` | 2/2 通过 |
| 并发门控 | `tests/server/turnConcurrencyGate.test.mjs` | 4/4 通过 |
| 登录限流 | `tests/server/loginRateLimit.test.mjs` | 1/1 通过 |
| Fork 登记 | `npm run check:saas-fork` | 491 条 verified |

编排：`node scripts/run-session-switch-validation.mjs --tier=1` → **PASS**

## 已落地能力摘要

- **PR1**：`sessionDeliverablePipeline` 单次 O(n) bundle + `processRailProgress` parity
- **PR2**：`useSessionStore` LRU（默认 10 slot）+ `fetchWithBackoff`（messages/validate/prefetch）
- **PR3**：Bridge `sessionState` LRU、projects 背压、`turnConcurrencyGate`、`loginRateLimit`
- **PR4**：Fast80 冷启动 + 静默 120 刷新、预取分级（saveData/2G/移动端）、侧栏 7 天窗 +「查看更早」
- **PR5**：`pack.mjs` / `apply-cloud-perf-env.sh` / `verify-cloud-perf.sh` / spec 文档 / E2E 占位+Long Task 门禁

## 待生产/联机验证（Tier 2–7）

需在 `dev:saas` 或云端跑：

- `npm run test:session-switch:validation`（含 bridge-stability、memory-leak、pre-production offline）
- Playwright `ui/e2e/saas/session-switch-perf.spec.ts`（需 `DIAG_USER`/`DIAG_PASS` 与 ≥2 侧栏会话）
- 云端：`scripts/release/verify-cloud-perf.sh` 新增 §8 env 与 bundle 探测

## 环境开关（构建时 VITE_*）

| 变量 | 默认 | 说明 |
|------|------|------|
| `VITE_SESSION_PIPELINE_BUNDLE` | 1 | 启用单次 pipeline |
| `VITE_SESSION_STORE_LRU_SLOTS` | 10 | 客户端 session slot 上限 |
| `VITE_TAIL_PAGE_FAST_SWITCH` | 80 | 冷启动 tail 条数（有 cache/warm slot 仍 120） |

## 服务端 env（`apply-cloud-perf-env.sh`）

`PILOTDECK_BACKPRESSURE_*`、`PILOTDECK_GATEWAY_MAX_CONCURRENT_TURNS`、`PILOTDECK_USER_MAX_ACTIVE_TURNS`、`SAAS_SIDEBAR_DEFAULT_DAYS`、`PILOTDECK_LOGIN_RATE_LIMIT_*`
