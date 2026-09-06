# P0-7：单一终验收证书与质量仲裁

## 目标

重排终验收为单一证书管线，接入质量状态、来源证据与 repair 仲裁。

## 必须实现

- `src/saas/final-acceptance/deliverableQualityChecks.ts` + `deliverableQualityPipeline.ts`
- 重构 `validateDeliverablesEngine.ts`：只返回 draft，不提前构证
- `src/agent/deliverables/finalizeDeliverableAcceptance.ts`
- `src/saas/deliverables/deliverableCompletionState.ts`（isAcceptanceSatisfied, shouldStopAutomaticContinuation）
- 扩展 `deliverableAcceptanceCertificate.ts` v2 可选字段：qualityContractHash, qualityEvidenceHash, qualityCompletion, partialReason, blockedReasonType, qualityFailures, assetProvenanceSummary
- AgentLoop 在 verification/circuit/budget 后调用 finalizer；删除二次重建证书
- `PILOTDECK_CONTENT_QUALITY_V2=off|shadow|enforce`（非媒体断言）
- enforce 映射遵循状态表（complete/accepted_partial/blocked/incomplete）

## 测试

- finalizeDeliverableAcceptance tests
- validateDeliverablesEngine order tests
- taskContinuationPolicy accepted_partial short-circuit
- 0717 shadow fixtures unchanged

报告：`F:\Ai-pilotdeck\.superpowers\sdd\task-p0-7-quality-engine-report.md`
