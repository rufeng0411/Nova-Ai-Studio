# Goal Loop 失败模式（内部）

| 模式 | 症状 | 严重度 | Nova 缓解 | 验收 |
|------|------|--------|-----------|------|
| Infinite Fix Loop | 同路径反复 repair | 高 | RecoveryBudget + verifier 每 turn 1 次 | `test:recovery:breakdown` |
| Verifier Theater | LLM pass 但成果不合格 | 中 | `needs_repair` → `deliverable_repair` | `verificationReviewer.test.ts` |
| State Rot | SDM 与 acceptance 分裂 | 高 | `sdmSlotMatching` 同源 | `sdmSlotMatching.test.ts` |
| 假完成 | passed + verified=0 | 高 | completionGate + validate | `test:goal-loop:acceptance` |
| blocked 空转 | 缺 Key 仍 retry | 中 | `shouldTriggerDeliverableRepair` + UAR | `task-continuation-policy.test.ts` |
| 空 Plan 卡 | 对话内空「实施方案」 | 低 | `planApprovedCardHasContent` | `ToolRenderer.plan-card.test.tsx` |
| 汇总表缺失 | 部分完成无表 | 高 | `forceShow` + SDM mount | MOD-07/08 单测 |

权威韧性：[`conversation-resilience-spec.md`](./conversation-resilience-spec.md)
