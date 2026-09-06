# 韩国项目交付汇总全链路验收（2026-06-28）

> 自动化：`npm run test:korea-deliverable:live`（Gateway）+ `npm run test:korea-deliverable:ui`（Playwright DOM 探针）  
> 矩阵 JSON：`artifacts/korea-deliverable-matrix/live-matrix.json`

## 前置

- `npm run dev:saas`（Bridge **7990**，Vite **8081**，Gateway **18789**）
- 登录 `admin/admin123`
- 项目名：`测试韩国项目`（脚本自动 create-workspace）

## 必过案例

| ID | 说明 | 通过标准 |
|----|------|----------|
| K1 | df-image-generation 单图 | ≥1 PNG 写入 + acceptance 非 failed |
| K2 | mkt-ab-testing | ≥1 md；正文无重复「文档已创建」 |
| K3 | mkt-last30days 三 md | ≥3 md；汇总无 JSON 假完成 |
| K4 | frontend-slides HTML | ≥1 index.html |
| K6 | nova-ppt 【6】页 | ≥6 slide png；0 次页数循环 |

## 条件允许

- **K5**：发布 Key 缺失可 `BLOCKED`，须有本地 md/html
- **K7**：无 video Key 可 `BLOCKED`，禁止假 completed；有 Key 须 mp4

## 单案重跑

```bash
KOREA_CASE=K3 npm run test:korea-deliverable:live
KOREA_DRY=1 npm run test:korea-deliverable:live
```

## 单元/回归门禁（§五-A）

```bash
npx vitest run ui/src/shared/collectFinalDeliverables.test.ts ui/src/components/chat/deliverables/DeliverableSummaryTable.acceptance.test.tsx tests/saas/clarification-gate.test.ts tests/agent/auto-continue-policy.test.ts
npm run test:display-engine-alignment
npm run test:four-line-audit
```
