# 交付文件汇总表 UI 契约

权威组件：[`ui/src/components/chat/deliverables/DeliverableSummaryTable.tsx`](../ui/src/components/chat/deliverables/DeliverableSummaryTable.tsx)

挂载位置：[`MessageRowV2`](../ui/src/components/chat-v2/MessageRowV2.tsx) 内 `[data-testid=deliverable-summary-footer]`。

## 容器与标题

| 项 | 规范 |
|----|------|
| testid | `deliverable-summary-table` |
| 标题 i18n | `deliverables.summaryTitle` → **交付文件汇总** |

## 列（固定 4 列）

| 列 | i18n key | 默认中文 |
|----|----------|----------|
| 1 | `deliverables.summaryColName` | 交付物名称 |
| 2 | `deliverables.summaryColType` | 文件类型 |
| 3 | `deliverables.summaryColStatus` | 状态 |
| 4 | `deliverables.summaryColLink` | 文件链接 |

## 状态文案

| 状态 | i18n / 文案 |
|------|-------------|
| 已交付 | `deliverables.statusDelivered` |
| 未完成 | `deliverables.statusMissing` |
| 校验中 | `deliverables.statusChecking` |
| 补齐中 | `deliverables.statusRepairing`（引擎 repair 进行中） |
| 需继续 | `deliverables.statusNeedContinue`（Nova 幻灯缺页等） |

## 必显规则

- 任务**全部完成**或**部分完成**（含 SDM 多槽仅完成 1 项）均须 mount 汇总表。
- `forceShow` 在存在 SDM slots、`expectedManifest` 或 `acceptanceRows` 时为 true。
- 脑爆纯聊天（`major_category=brainstorming` 且无交付信号）**不** mount。

## 文件夹按钮

- 文案：`deliverables.openTaskFolder` → **前往任务所在文件夹**
- 行为：展开文件树并选中任务目录（不改现有交互）。

## 正文去重

挂载汇总表时 [`deliverableSummaryBodyStrip`](../ui/src/shared/deliverableSummaryBodyStrip.ts) 剥离正文内重复四列表与路径清单；全产品仅保留 footer 一处正式汇总表。

## 样式 token

`rounded-lg border border-border/50 bg-muted/20 p-2.5 text-[13px]`；表头 `text-[11px] text-muted-foreground`。

## 验收

```bash
npm --workspace ui run test -- \
  ui/src/components/chat/deliverables/DeliverableSummaryTable.acceptance.test.tsx \
  ui/src/shared/deliverableSummaryBodyStrip.test.ts \
  ui/src/shared/deliverableSummaryMountPolicy.sdm-live.test.ts
```
