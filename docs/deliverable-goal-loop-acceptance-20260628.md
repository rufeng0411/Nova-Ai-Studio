# Goal-Loop 交付闭环验收摘要

日期：2026-06-28

## 实现范围

- **§0** `continuationOwner` 全链路：JsonlWriter → readSessionMessages → messages.js → `turnAcceptanceMeta` / `ChatMessage`
- **阶段一** Nova `minCount` + `nova-slide-deck` profile（GEO 全案不变）
- **阶段二** `acceptance_repair` reserved 子预算；`deliverableValidation` 时禁用启发式 incompleteDeliverable 双轨；Bridge 跳过引擎已有 meta
- **阶段三** `isDeliverableRepairActive`（含 `auto_continue_engine`/streaming）；底部 `DeliverableSummaryTable` 强制挂载与正文 strip；`statusRepairing` i18n
- **阶段四** 五入口 Playwright 门禁（fixture + resolver 探针）
- **阶段五/六** `test:goal-loop:acceptance` / `test:goal-loop:final` 编排

## 验收命令

```bash
npm run test:goal-loop:acceptance
npm run test:deliverable-partial:unit
npx vitest run ui/src/shared/turnAcceptanceMeta.test.ts src/saas/taskState/taskGoalContract.test.ts
npx tsx --test tests/saas/resilience/recoveryBudget.test.ts
```

全链路终验（含 Playwright + 可选 prelaunch:quick）：

```bash
npm run test:goal-loop:final
npm run test:goal-loop:final -- --skip-live
```

## 核心断言

1. repair-active 时**汇总表仍可见**（部分交付 2/5 等）；missing 槽位显示「补齐中…」，非「需继续/未完成」；仅最新助手 `isStreaming` 未结束时暂不 mount
2. 交付类回合底部有且仅有 `[data-testid=deliverable-summary-footer]` 内 `[data-testid=deliverable-summary-table]`；同会话多表时**仅最新表** active validate，上文表 frozen 快照
3. `continuationOwner=deliverable_repair` 时 UI 不叠加重试（`engineRepairOwned`）
4. Nova 6 页契约 `minCount=6` + `slide-manifest.json` required
5. 历史 JSONL four-line audit 零 diff（legacy 轨）
