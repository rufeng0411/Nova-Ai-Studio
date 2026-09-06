# ROG Phase 6 验收报告（2026-07-05）

## 执行摘要

Phase 6 在判定层完成 **PR-F1～F7** 落地：Tier-0 Profile 优先级、missing 消歧与半链清洗、PPT 澄清/路由硬门禁、Campaign PNG HTML 降级与 broken 幽灵过滤、汇总表 needs_repair 态 mount、Task Lifecycle UI 跨 turn 间隙「制作中」态，以及 L1–L3 自动化门禁。

## 自动化门禁

| 级别 | 命令 | 结果 |
|------|------|------|
| L1 单测 | `npm run test:rog-phase6:unit` | 17 vitest + 4 repairEligible |
| L2 集成 | `npm run test:rog-phase6:integration` | 7 fixture replay |
| L3 四线 meta | `rog-four-line-acceptance-meta.test.ts` | 通过 |
| T01–T23 KPI | `npm run test:rog-phase6:kpi` | 见 `artifacts/0705验收测试/kpi-0705.jsonl` |
| T22/T23 UI | `ui/e2e/saas/task-lifecycle-dock.spec.ts` | 离线 3/3；live 需 `TASK_LIFECYCLE_E2E=1` |
| Fork | `npm run check:saas-fork` | 441 条 manifest |

## PR 对照

- **F1**：`PILOTDECK_PROFILE_TIER0_PRIORITY` — GEO/Campaign 全案先于 social_matrix/visual_canvas；SDM profileId 锁定；`sessionGoalAnchor` 不可被 follow-up 覆盖。
- **F2**：`reconcileMissingPaths` + 半链 `pptx](artifacts/` 清洗。
- **F3**：ppt-master 无条件跳过页数澄清；禁止 df-ppt 路由；verified pptx 时 strip slide PNG missing。
- **F4**：`filterGhostBrokenPaths` + `stripCampaignPngMissingWhenHtmlVerified`（主视觉 + social）。
- **F5**：`forceShow` 改为 `verifiedPaths.length > 0`；research/design 单文件 mount。
- **F6**：`analyze-rog-batch-exports.mjs` KPI 字段；`test:rog-phase6:*`；0705 归档目录。
- **F7**：`sessionTaskLifecycle.ts`；composer/dock/stale watchdog 统一 lifecycle；`engineRepairOwned` 仅 active turn 让路；300ms auto-continue。

## 实机 L4 说明

`npm run test:rog-phase6:live -- --gate --jsonl=<session.jsonl>` 需在 **dev:saas** 运行后导出 JSONL。T16–T19 零干预 KPI 须 Gateway 实跑；判定层 fixture 已绿，预期 Post-F6 repair 风暴显著收敛。

## 回滚

逐项关闭：`PILOTDECK_PROFILE_TIER0_PRIORITY` / `PILOTDECK_MISSING_REANCHOR` / `PILOTDECK_PPT_MASTER_STRICT` / `PILOTDECK_BROKEN_GHOST_FILTER` / `VITE_PILOTDECK_TASK_LIFECYCLE_UI`。

还原点建议：`restore-point/pre-rog-phase6-20260705`
