# 成果四线生产验收报告（2026-07-17 七案）

> 权威 fixture：`tests/fixtures/four-line-0717-cases.ts`  
> 实机编排：`scripts/run-0717-four-line-live.mjs` → `artifacts/0717-four-line-acceptance/`

## 验收维度

四线须分别取证，不可混用：

1. 实时对话成果链接
2. 右侧成果清单（Dock）
3. 文件夹 Tab 真磁盘
4. HTML 导出（用户归档 / 诊断）

硬门禁 KPI：`false_complete=0`、`false_incomplete=0`、`invalid_link=0`、`process_file_in_results=0`、`duplicate_user_message=0`、`message_order_inversion=0`。

## 七案预期

| 案例 | 必交槽 | 禁止项 |
|------|--------|--------|
| Campaign 雷蛇 6 项 | 6 | `stage_website` / `stage_plan_html`；`passed + 5/8` |
| 单图 image-generation | 1 PNG | `visual_canvas` / canvas-manifest |
| GEO ADD HTML+PDF | 4 唯一槽 | 空格别名重复行 |
| Nova 市场 MD | 1 MD | DOCX 升为必交 |
| 赛前预测 | 1 | `geo_keyword` / `www.go` |
| 西班牙阵容 HTML | 1 HTML | 跨根路径 |
| 阿根廷阵容 HTML | 1 HTML | 思考伪 `.md` |

## 证书链路

- 引擎：`deliverableAcceptanceCertificate.ts` + `validateDeliverablesEngine.ts`
- 落盘：`turn_acceptance_meta.acceptanceCertificate`
- UI：`VITE_PILOTDECK_DELIVERABLE_CERTIFICATE_UI`
- 导出：`exportSnapshotEnvelope` + `VITE_EXPORT_SNAPSHOT_V2`

## Feature flags 回滚

1. 关 `VITE_PILOTDECK_DELIVERABLE_CERTIFICATE_UI`
2. `PILOTDECK_DELIVERABLE_CERTIFICATE_V2=shadow|off`
3. `PILOTDECK_CONTRACT_AUTHORITY_V2=0`

## 验收命令

```bash
npx vitest run tests/fixtures/four-line-0717-invariants.test.ts src/saas/deliverables/deliverableAcceptanceCertificate.test.ts
npm run test:four-line-audit
npm run test:export-four-line-parity
node scripts/run-0717-four-line-live.mjs
```
