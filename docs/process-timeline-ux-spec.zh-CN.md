# 对话过程时间线 UX 规范

> 权威实现：`ui/src/shared/processTimelineBuilder.ts` + `ui/src/components/chat-v2/ProcessTimeline.tsx`  
> 容错交叉引用：[`docs/conversation-resilience-spec.md`](conversation-resilience-spec.md)

## 目标

- **策略 A 单点渲染（仅 dock）**：进行中时全屏最多 **1** 个 `data-testid="process-timeline"`，**仅**在底部 sticky `live-process-progress-dock` 展示步骤列表；消息流 inline **不再**并列渲染 `ProcessTimeline`（与 `MessagesPaneV2` 当前实现一致）。
- **视觉统一**：12px muted 左轨（`border-l-2`），与完成后 `InformalProcessStack` 一致。
- **降噪**：无 `tool_recovery` / 英文过程旁白 / raw stage key 泄漏；recovery 仅显示「调整中」。
- **Audience 门控**（`VITE_PROCESS_STEP_DETAIL_V2=1`）：非开发类任务（`audienceMode=non_technical`）detailed 展开隐藏 bash/write 原始块，仅保留摘要行；dock 当前步展示搜索词/文件名/域名等可读 target。
- **完成后链保留**：`InformalProcessStack` → `ProcessAttachmentRow` → `MessageRowV2`（technical 任务 detailed 仍可见工具详情）。

## 双入口（策略 A — 2026-07 修订）

| 条件 | 消息流 inline | 底部 sticky dock |
|------|---------------|------------------|
| 任务进行中 | **不渲染** ProcessTimeline | **唯一** ProcessTimeline（`buildLiveTimelineSteps`） |
| 回合结束 | 无 | dock 隐藏；最终回复上 InformalProcessStack |

共享数据源：`liveTimelineSteps`（`buildLiveTimelineSteps` + `normalizeProcessSteps` + `audienceMode`）。

## 步骤内核

```
normalizeProcessSteps(steps, t, options)
├── humanizeLiveStep（recovery→调整中、工具名本地化）
├── dedupeRecoverySteps / dedupeStageHints
├── filterEnglishNarrationSteps（zh 模式）
├── applyThinkingSanitize（英文→「正在整理思路…」）
└── slice(-maxVisibleSteps)（live 默认 5）
```

## 英文思考过滤（展示侧兜底）

| 类型 | 处理 |
|------|------|
| `The user wants…` / `Let me…` / `Good, the file…` | 不进入主行；thinking detail 替换为「正在整理思路…」 |
| 合法中文推理摘要 | 保留（italic） |
| 代码、路径、API 名、英文教学例句 | 保留 |
| `read_skill` / 技能 slug 泄漏 | 过滤 |

模式表与 [`src/agent/errors/userFacingErrors.ts`](../src/agent/errors/userFacingErrors.ts) boilerplate 对齐。

## 模型侧（源头）

- [`saasCoreStrategy.ts`](../src/context/prompt/saasCoreStrategy.ts)：`CORE_STRATEGY_ZH` 要求扩展思考块亦须中文。
- [`PromptAssembler.ts`](../src/context/prompt/PromptAssembler.ts)：`promptLanguage === 'zh-CN'` 时注入 `<thinking-language>`。

## Bridge 本地化

[`ui/server/pilotdeck-bridge.js`](../ui/server/pilotdeck-bridge.js)：

- `recovery_attempt` → `title: '调整中'`，禁止 raw reason。
- `turn_stage` → 固定中文阶段标题；`detail` 为空（禁止 raw stage key 下发 UI）。

## 设置联动

`processDetailLevel`（`useUiPreferences`）：

- **minimal**：阶段轨 + 当前一步；有成果时可锁定折叠（无 chevron）。
- **standard**（默认）：最近 5 步 + `ProcessActivitySummary` 折叠。
- **detailed**：ActivitySummary 可展开路径；**non_technical** 且 `VITE_PROCESS_STEP_DETAIL_V2=1` 时过滤 bash/write 原文，仅摘要。

## Feature flags

| Flag | 默认 dev | 默认生产 | 范围 |
|------|----------|----------|------|
| `VITE_PROCESS_STEP_DETAIL_V2` | 1 | 0 | audience 摘要 + detailed 门控 |
| `VITE_RECOVERY_SURFACE_V2` | 1 | 0 | Recovery 零废话展示层 |

## 回滚

`localStorage.setItem('pilotdeck:processUx', '0')` 关闭 dead-man guidance 等过程 UX 增强；对话收发不受影响。

## 自动化门禁

- `npm run test:process-ux:full`
- `node scripts/run-process-timeline-acceptance.mjs`
- Playwright：`ui/e2e/saas/process-ux-live.spec.ts`（P-UX1–P-UX7）

## 实机验收

见 [`docs/process-timeline-ux-acceptance-report-2026-06-14.md`](process-timeline-ux-acceptance-report-2026-06-14.md)（G1–G12 / S1–S12 矩阵）。
