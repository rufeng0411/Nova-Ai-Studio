# ROG 批测重跑报告（代码修复后）

> 日期：2026-07-05

## 批测 HTML 基线（修复前）

- 来源：`C:/Users/rufen/Downloads` 9 条导出
- KPI JSON：`docs/rog-batch-kpi-20260705.json`
- 零干预率：**44.4%**（4/9）；中位用户发言：**2**；phantom 会话：**1**（Campaign）

## 单元验收（本次已跑）

| 命令 | 结果 |
|------|------|
| vitest（continuation + clarification + validateEngine） | **48 passed** |
| `npm run test:sdm:unit` | **22 passed** |
| `npm run check:saas-fork` | **432 entries ok** |

## 实机 9 场景重跑

需 `dev:saas` 就绪后逐条重跑，并执行 `npm run analyze:task-completion -- --gate`。

| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| 零干预率 | 44% | 待重跑 |
| phantom 会话 | 1 | 目标 0 |
