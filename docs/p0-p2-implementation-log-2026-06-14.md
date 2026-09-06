# P0–P2 任务驱动对话实现日志（2026-06-14）

## 概述

按「任务驱动对话 P0–P2 开发计划（审阅修订版 v2）」完成 Sprint0–Sprint6 与终验脚本接线。

## 已落地项

| ID | 内容 | 关键文件 |
|----|------|----------|
| Sprint0 | 统一裁决 + slug 注册表 + 三确 streak | `taskContinuationPolicy.ts`, `deliverableCapabilityProfiles.ts`, `userActionBlocker*.ts` |
| P0-1 | 会话级 capability binding 每 turn 透传 | `capabilitySessionBinding.ts`, `useChatComposerState.ts` |
| P0-2 | turn 结束前引擎 validate 门控 | `validateDeliverablesEngine.ts`, `AgentLoop.ts` |
| P0-3 | PPT 专用 tool_recovery | `toolFailureRecovery.ts`, `resolveToolRecoveryProfile.ts` |
| P0-4 | resume-context API + UI fetch | `messages.js` GET `resume-context`, `fetchTaskResumeContext.ts`, `useAutoRecoveryContinue.ts` |
| P0-5 | orchestration bypass 读 profile | `shouldBypassOrchestration.ts` |
| P0-6 | Bridge deliverable_repair | `deliverableRepairEmitter.js`, `useAutoRecoveryContinue.ts` |
| P1-1 | 澄清门控 | `clarificationGate.ts` |
| P1-2 | Key/附件豁免 + 三确 user_action | `userActionBlocker.ts`, `taskContinuationPolicy.ts` |
| P1-3 | 跨 turn repeat guard | `crossTurnToolFailureTracker.ts` → `AgentLoop.ts` |
| P1-4 | 阶段 recovery 子预算 | `stageRecoveryBudget.ts` |
| P1-5 | prelaunch skill 门禁 stub | `integration-prelaunch-skill-live.mjs` |
| P2-1 | 续跑弱提示 | `ResumeHintToast.tsx` → `ChatInterfaceV2.tsx` |
| P2-2 | 首 turn 跳过 memory（5s 超时已有） | `DefaultContextRuntime.ts` `shouldSkipMemoryRetrievalForTurn` |
| P2-3 | stage hint dedup | `stageHintDedup.ts`（AgentLoop 已用） |
| FIX-B | 脑爆升档 recovery profile | `resolveToolRecoveryProfile.ts`, `taskContinuationPolicy.ts` |

## 验收命令

```bash
npm run test:p0-p2:unit      # 53 单测
npm run test:p0-p2:integration
npm run selfcheck:p0-p2      # 16/16 roadmap 探测
npm run test:p0-p2:full      # 全量
```

## 已知 partial

- **StageProgressRail**：计划中的阶段进度条组件未单独新建，P2-1 selfcheck 为 partial（弱提示已接）。
- **P1-5 实跑**：当前为 skill manifest 存在性门禁；完整 Playwright 对话实跑留 prelaunch stability 全量。
- **双层续跑 dedup `continuationOwner`**：taskResumeCoordinator 单槽已接；Bridge/UI 层 metadata dedup 未再扩展。

## fork manifest

新增 15 条登记于 `config/pilotdeck-core-fork.manifest.json`（deliverable profiles、continuation policy、resume API 等）。
