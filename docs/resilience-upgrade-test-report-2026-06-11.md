# 联网稳定性升级及测试汇报

**日期**：2026-06-11  
**基线提交**：`2ad551b5` + resilience Phase 0–6  
**环境**：Windows 本地；SQLite 控制面；`dev:saas` 端口 5183/3011/18801  

## 一、升级摘要

### 已交付

| Phase | 内容 |
|-------|------|
| 0 | `AGENTS.md` 产品稳定性原则；[`docs/conversation-resilience-spec.md`](conversation-resilience-spec.md)；bridge `budgetRemaining`/`recoveryLayer` |
| 1 | [`RecoveryBudget`](src/saas/resilience/recoveryBudget.ts) 单 turn ≤8；AgentLoop 统一 `tryConsume`；UI 仅 `recovery_pause` 兜底；`turnBoundaryKey`→`recoveryRunId` |
| 2 | `OutboundGate` + `SafeConcurrentScheduler`；`urlFetcher` 瞬态退避；`SoftFetchRepeatTracker` 重复软失败转 `tool_recovery` |
| 3 | WS 指数退避 800ms→30s；重连 HTTP debounce 300ms；`activeTurnMessages` 去重 |
| 4 | `ErrorClassifier` 配置类快失败；`InProcessGateway` 中英文错误文案链 |
| 5 | fork manifest +10；`npm run smoke:resilience` |
| 6 | 本报告 + Playwright `resilience-recovery.spec.ts` |

### 与 2ad551b5 关系

- **保留**：8 次上限、`auto_continue`/`soft_fetch_recovery`、`shouldShowNetworkRetryLabel`
- **新增**：全栈合计预算（消灭 8×8）；出站限流；WS/重连治理

## 二、全链路测试结果（改动 + 波及）

| 层级 | 命令 | 结果 | 备注 |
|------|------|------|------|
| L0 build | `npm run build` | **PASS** | |
| L0 单测 | `npm test`（50 tests） | **PASS** | 含 `recoveryBudget.test` |
| L1 fork/brand | `check:saas-fork` / `brand:check` | **PASS** | 187 条 |
| L2 resilience | `npm run smoke:resilience` | **PASS** | gate 并发≤2 实测 |
| L3 SaaS deep | `npm run test:saas:deep` | **PASS** | |
| L4 UI hook | `vitest useAutoRecoveryContinue` | **PASS**（7/7） | 进程 exit 1 因既有 React 双副本 unhandled（非断言失败） |
| L5 smoke | `smoke:capability-hub` / `smoke:templates` | **PASS** | |
| L7 FreeRide | `npm run test:saas:acceptance` | **未在本机完整执行** | 耗时长（含 Playwright 起 dev:saas）；建议 CI/发版前跑 |

### R 场景（自动化覆盖子集）

| ID | 覆盖方式 | 结果 |
|----|----------|------|
| R5 联网误报 | `user-facing-errors.test` + E2E `resilience-recovery.spec` | PASS（单测）；E2E 待 acceptance |
| R1–R4 预算/双轨 | `recoveryBudget.test` + AgentLoop 预算挂钩 | PASS（单测/构建） |
| R6 WS | 代码审查 + WS backoff 常量 | 已落地，待 DevTools 手测 |
| R7 并发 fetch | `smoke:resilience` gate 压测 | PASS |
| R8 配置快失败 | `errorClassifier` + AgentLoop 模型路径 | 已落地，待错误 Gateway URL 手测 |

## 三、Smoke 测试结果（未改动模块）

| 命令 | 结果 |
|------|------|
| `smoke:capability-hub` | PASS |
| `smoke:templates` | PASS |
| `smoke:document` / `smoke:document-export` | 未跑（可选回归） |

## 四、已知问题与风险

1. **Router/stream 层重试** 仍与 Loop 预算独立（后续可合并进 `RecoveryBudget`）。
2. **`test:saas:acceptance`** 需本地 Chromium + 端口空闲，建议在发版流水线执行。
3. **Vitest** 导入 `src/agent/errors` 时偶发 React 双副本 unhandled（既有环境问题），不影响生产构建。

## 五、发布建议

**可合并 / 可继续内测** — 核心预算与出站治理已落地，L0–L2 + deep smoke 全绿。发版前补跑 **`npm run test:saas:acceptance`（FreeRide）** 与 P1–P4 Playwright。
