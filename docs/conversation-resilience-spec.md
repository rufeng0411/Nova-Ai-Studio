# 对话恢复与联网稳定性规格

**版本**：resilience v1（2026-06-11）  
**实现**：[`src/saas/resilience/`](../src/saas/resilience/)

## 原则

| 原则 | 要求 |
|------|------|
| 稳定 | 单轮任务不因瞬态网络抖动而中断；用户只见弱提示 |
| 强壮 | `RecoveryBudget` **双轨**：可恢复 lane 默认 **12**；硬失败确认 lane 默认 **3**（Key/欠费 **1** 次即停）；禁止引擎与 UI 双轨叠乘 |
| 高速 | WS 指数退避；`OutboundGate` 限制 `web_search`/`web_fetch`/`fetch_page_images` 并发 |
| 高效 | `ErrorClassifier` 对配置类错误快失败；同 URL/query 重复 soft 失败促换策略 |
| 为用户解决问题 | 耗尽后才展示「可能原因」；不让用户当调试员 |

## 各层职责

| 层 | 职责 | 预算 |
|----|------|------|
| Router | 模型路由瞬态重试 | 与 Loop 预算独立（后续可合并） |
| streamModel | 流式瞬态重试 | 同上 |
| AgentLoop | `model_error` / `tool_recovery` / `soft_fetch_recovery` / `auto_continue` | **计入 recoverable lane**；工具硬失败经 `HardFailStreakTracker` 确认后终局 |
| UI `useAutoRecoveryContinue` | 仅在 `recovery_pause` 后开新 turn | **计入剩余 budgetRemaining** |
| WebSocket | 指数退避重连；重连 HTTP debounce 300ms | 不消耗 recovery 预算 |

## 禁止行为

1. 引擎 `auto_continue` 与 UI 自动「继续」对同一失败连续开两个新 turn。
2. `turnBoundaryKey` 使用 `chatMessages.length`（重连刷新会重置计数）。
3. 单页 `web_fetch` 失败展示「联网有些问题」（见 `shouldShowNetworkRetryLabel`）。
4. 向用户气泡展示 Recovery 英文注入长文。

## 配置（`tools.resilience`）

```yaml
tools:
  resilience:
    maxRecoveryBudgetPerTurn: 8          # 兼容项；未设 recoverableMaxPerTurn 时作为 recoverable 上限
    recoverableMaxPerTurn: 12            # 可恢复问题（瞬态网络、工具换路、auto_continue）
    hardFailMaxPerTurn: 3                # 网关等需确认的硬失败；model_auth/billing 阈值为 1
    outboundMaxConcurrent: 3
    outboundFetchRetries: 1
    wsReconnectBaseMs: 800
    wsReconnectMaxMs: 30000
    wsReconnectDebounceMs: 300
    autoContinueStrict: false
    toolFailureRepeatGuard: true
    imageMaxConcurrent: 2
```

UI process UX (`tools.ui.processUx`, default enabled):

```yaml
tools:
  ui:
    processUx:
      enabled: true
      deadManGuidance: true
      staleTurnWarnSec: 90      # 无新进展时展示「可能卡住」提示
      staleTurnFallbackSec: 180 # UI 自动中止+备选续跑（Bridge 流空闲默认 600s，agent 子任务场景）
```

## 任务降级 / 备选路径（全局）

除非不可抗力（进程崩溃、用户主动停止），长时卡住不得无限占用「进行中」状态：

| 场景 | 默认行为 | 用户可见 |
|------|----------|----------|
| Gateway 流 120s 无事件 | Bridge 中止 turn → `recovery_pause` → UI 可 auto-continue | 提示开发服务/工具无响应 |
| UI 180s 无新 activity | 中止 + 合成续跑指令（跳过卡住步骤） | `StaleTurnFallbackCard` 说明步骤与偏差 |
| `grep`/`bash dir /s /b` 失败或超时 | 引擎 tool_recovery → 改 `glob`/`read_file` 已知 artifacts | 工具错误含 Recovery 行 |
| 全盘 `dir /s /b` | bash 直接拒绝，提示 scoped grep/glob | invalid_tool_input |
| 搜图/联网 soft 失败 | 占位图或 write_file 继续 | 弱提示，不红条 |

Bridge 环境变量：`PILOTDECK_STALE_TURN_IDLE_MS`（默认 600000，agent/subagent 长批次；120s 会在 ES9 类任务触发 aborted_streaming 循环）。

## 事件字段

`recovery_attempt` / `recovery_exhausted` 透传：`budgetRemaining`、`layer`（loop）、`reason`。

## 验收

- `npm run smoke:resilience`
- `npm run test:saas:acceptance`（FreeRide）
- `npm run test:task-resilience:acceptance`（会话 durability + infra 续跑 + 成果 validate 离线门禁）
- `npm run test:goal-loop:acceptance`（Goal Loop P2 增量门禁）
- 报告：`docs/resilience-upgrade-test-report-*.md`

## H0 网络/model 错误（Goal Loop Phase 2, 2026-07-01）

| 场景 | 行为 | 用户可见 |
|------|------|----------|
| Provider `fetch failed` / 超时 | Router 回退链 + Bridge 不假 complete | 弱提示，非裸错误 |
| turn_result.error + 空 assistant | 历史 API 注入 error + assistant 占位 | 刷新后不空白 |
| task-resume XML | messages API / strip 过滤 | **零可见** |
| turn 墙钟 | `PILOTDECK_TURN_WALL_CLOCK_MS`（dev 45min / prod 30min） | 温和暂停说明 |

运维：DashScope/模型池异常时优先看 Gateway 日志与 `recovery-events.jsonl`；勿让用户手改 `.env`，生产墙钟经 `pack.mjs` 注入。

## 基础设施中断与软续跑（2026-06-16）

| 场景 | Bridge/UI 行为 | 预算 |
|------|----------------|------|
| Gateway/WS 断、ECONNRESET、idle timeout | Bridge 发 `statusKind: infra_interrupt`（非裸 `error`） | **不消耗** recoverable lane |
| UI auto-continue | `TaskResumeCoordinator` 同 boundary 仅 1 次；优先级 infra > deliverable_repair > recovery_pause | UI grace |
| 新 turn 上下文 | JSONL `turn_progress` / `<task-resume>` 注入（见 `docs/task-soft-resume-spec.zh-CN.md`） | 新 turn |

## 会话 durability（SaaS catalog shadow）

- 新会话：`await` catalog UPSERT（300ms 超时）→ `status=pending` → JSONL 出现后 `active`
- 刷新/重连：`sessionStorage.pendingSessionIntent` 合并侧栏占位
- 开发默认：`SAAS_CONVERSATION_CATALOG_SHADOW=1`（`dev:saas`）

## 成果 validate-before-show

- `POST /api/projects/:projectName/deliverables/validate` 批量 stat
- T2 成果区仅展示 `verified` / 短暂 `pending`；`phantom`（纯正文路径）默认隐藏
- `deliverable_repair` 通道可绕过「像已交付」suppress，仍受 boundary 1 次 grace 约束

## Goal-Loop 交付验收 repair 子预算（2026-06-28）

| 项 | 行为 |
|----|------|
| `acceptance_repair` | 计入 recoverable lane，但 **保留末 4 槽**（`PILOTDECK_ACCEPTANCE_REPAIR_RESERVED`，默认 4）专供成果补齐 |
| `deliverableValidation` 开启 | 引擎 **禁用** `incompleteDeliverableStop` 启发式双轨，避免与 acceptance repair 竞态 |
| `continuationOwner` | 引擎写入 `turn_acceptance_meta`；Bridge `turnDeliverableMetaWriter` **不覆盖** 已有 meta |
| UI 终端态 | 部分交付（如 2/5）**必须展示**汇总表（已完成+未完成行）；repair 中 missing 行显示「补齐中…」，**不整表隐藏**；仅最新助手 `isStreaming` 未结束时暂不 mount；**禁止** UI 第四轨 auto-continue（`engineRepairOwned`）；同会话多表时**仅最新表** active validate，上文表 frozen 快照 |
| 验收 | `npm run test:goal-loop:acceptance`；终验 `npm run test:goal-loop:final`（`--skip-live` 可跳过 prelaunch:quick） |

## Session Deliverable Manifest（SDM，2026-06-28）

| 项 | 行为 |
|----|------|
| Flag | `PILOTDECK_SESSION_DELIVERABLE_MANIFEST`（默认 OFF；dev:saas / 生产 pack 可开） |
| 权威源 | JSONL `session_deliverable_manifest` 最新行；`turn_acceptance_meta.sdmSnapshot` 为 turn 快照 |
| repair missing | `hasSdmIncompleteSlots` 驱动 `deliverable_repair`；续跑读 **SDM slots**，不靠重扫末条 goal |
| completionGate | SDM incomplete 时与 acceptance unmet 同等视为 contract 未满足 |
| Bridge | `turnDeliverableMetaWriter` **不写** SDM 行；ledger `goalVersion` 来自最新 SDM |
| UI | 有 SDM 即 mount 汇总表；dock 显示 `done/total`；slot.label 不被正文 parse 覆盖 |
| 降级 | Flag OFF 时 compile 返回 null，行为与现网一致 |
| 验收 | `npm run test:sdm:unit` + `test:sdm:replay` + `test:sdm:acceptance`；spec `docs/session-deliverable-manifest-spec.zh-CN.md` |
