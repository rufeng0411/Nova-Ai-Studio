# Goal Loop Phase 4 基线报告

日期：2026-07-05

## 范围

- 交付 UI 强化：空「实施方案」卡片隐藏、SDM 部分/全部完成必显汇总表、四列契约
- 引擎：`sdmSlotMatching` 同源、`shouldTriggerDeliverableRepair`、Verifier `needs_repair` → repair
- 打包：`PILOTDECK_COMPLETION_GATE` / `PILOTDECK_VERIFICATION_PASS` 生产默认

## Golden Fixtures

| ID | 文件 | 说明 |
|----|------|------|
| MOD-07 | `tests/fixtures/deliverable-summary/modric-partial-1-of-5.json` | 5 槽 1 完成 |
| MOD-08 | `tests/fixtures/deliverable-summary/modric-zero-verified-turn-end.json` | 5 槽 0 完成仍 mount |

## 验收命令

```bash
npm --workspace ui run test -- ui/src/components/chat/tools/ToolRenderer.plan-card.test.tsx ui/src/components/chat/deliverables/DeliverableSummaryTable.acceptance.test.tsx ui/src/components/chat/deliverables/DeliverableSummaryTable.contract.test.tsx ui/src/shared/deliverableSummaryMountPolicy.sdm-live.test.ts ui/src/shared/buildDeliverableSummaryRows.test.ts
npx tsx --test src/saas/deliverables/sdmSlotMatching.test.ts src/saas/taskState/sessionDeliverableManifest.test.ts
npx tsx --test tests/saas/task-continuation-policy.test.ts
```

KPI 对比：[`goal-loop-phase4-kpi-baseline.json`](./goal-loop-phase4-kpi-baseline.json)
