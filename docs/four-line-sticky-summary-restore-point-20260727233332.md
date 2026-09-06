# 四线 Sticky 成果汇总条 — 代码还原点

> 对话内 Sticky 成果汇总条、Turn 指针与 Dock/导出四线同源；presentation lock 防切换闪烁；侧栏执行态与 checklist authority 加固。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-four-line-sticky-summary-20260727233332` |
| **提交** | `bafe064e` |
| **时间** | 2026-07-27 23:33:32 +0800 |
| **说明** | 四线 Sticky 成果汇总条与对话内成果指针同源加固 |

```bash
git show restore-point/post-four-line-sticky-summary-20260727233332 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

### 对话内四线 Sticky UI

- `SessionDeliverableSummaryBar.tsx` 会话级 sticky 成果汇总条
- `DeliverableTurnPointer.tsx` / `DeliverableHistoricalFootnote.tsx` 本回合/历史 turn 指针
- `DeliverableCompletionPulse.tsx` 完成态轻量反馈
- `deliverableRowPresentationLock.ts` 侧栏切换防行状态闪烁
- `MessageRowV2.tsx` / `ChatInterfaceV2.tsx` 接入 `unifiedRowsOverride` 同源行

### 四线/导出同源

- `buildUnifiedDeliverableView.ts`、`exportSessionHtml.ts`、`exportSessionInlineDeliverables.ts` 对齐 sticky 行
- `conversationDeliverableFeatureFlags.ts` 功能门控
- E2E：`ui/e2e/saas/sticky-deliverable-parity.spec.ts`

### 引擎与 SDM

- `deliverableChecklistAuthority.ts` 编号清单/须交付解析加固
- `reconcileDeliverableFacts.ts`、`sdmSlotMatching.ts`、`detectGoalMutation.ts`

### 侧栏与执行态

- `SidebarV2.tsx`、`sidebarSessionExecutionStatus.ts` 排队/进行中/已完成语义
- `useSessionStore.ts` envelope 字段扩展

### 文档与门禁

- `docs/four-line-alignment-audit-2026-07-27.md`
- `docs/razer-proclick-four-line-gate-20260727.zh-CN.md`
- `run-razer-proclick-batch-gate.mjs` 四线门禁扩展

### AGENTS.md

- continual-learning 增量：四线计划不含 UI 美学专项、SuperPreview mp4 鉴权、最新还原点

## 排除项（未纳入提交）

- `general/artifacts/**`（本地交付物）
- `dev-saas-deeptest.out.txt`
- `.superpowers/`

## 如何还原

```bash
git reset --hard restore-point/post-four-line-sticky-summary-20260727233332
```

## 关联文档

- [`four-line-alignment-audit-2026-07-27.md`](./four-line-alignment-audit-2026-07-27.md)
- [`razer-proclick-four-line-gate-20260727.zh-CN.md`](./razer-proclick-four-line-gate-20260727.zh-CN.md)
- [`rail-sync-model-pool-restore-point-20260727205149.md`](./rail-sync-model-pool-restore-point-20260727205149.md)（上一还原点）
