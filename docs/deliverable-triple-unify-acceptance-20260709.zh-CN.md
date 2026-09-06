# UDC R11 验收报告模板

**日期**：YYYY-MM-DD  
**版本/tag**：pre-udc-r11-pr{N}  
**执行人**：

## Go/No-Go 检查（§I.7）

| 检查项 | 命令/证据 | 结果 |
|--------|-----------|------|
| 导出 contract 7/8 行 | `npm run test:deliverable-triple-unify:export` | |
| 0709-live 六案 | `npm run test:goal-loop:0709-live` | |
| SDM 单元 | `npm run test:sdm:unit` | |
| GT-10 strict | `vitest run deliverableGroundTruth.test.ts` | |
| 全量门禁 | `npm run test:deliverable-triple-unify` | |
| 四线/五线 audit | `npm run test:four-line-audit -- --gate` | |

## C5 d7890d1d 截图回放

| 检查 | 期望 | 实际 |
|------|------|------|
| slot_1 + `01-aeo-audit-checklist.md` | 已交付 + 可点 | |
| 进度分母 | 与 required 槽一致 | |
| 文件夹过程文件 | 契约外 muted | |

## C4 dc7a63d3

| 检查 | 期望 | 实际 |
|------|------|------|
| 清单行数 | 7（6 required + 1 optional） | |
| 导出 contractHash | 与 Dock 一致 | |
| 导出非 17 行全绿 | ≤7 行 delivered | |
| strict GT | 6/6 required 才 passed | |

## 结论

- [x] **UDC 专项门禁通过** — `test:deliverable-triple-unify`（export / 0709-live / sdm:unit / rog-phase8-2 / 0708-batch）、`test:four-line-audit --gate`、`GT-10`
- [ ] **全站 prelaunch:quick** — 3 项失败（`brand:check`、`vitest:dialogue-stability-ui-unit`/`DeliverableSummaryTable.acceptance`、`smoke:document-import`），与 UDC 改动无直接关联，需单独跟进
- [ ] **test:sdm:acceptance** — goal-loop 子项因上述 DeliverableSummaryTable 用例失败而中断；UDC 新增 `test:goal-loop:0709-live` 已通过

**执行记录（2026-07-09）**

| 命令 | 结果 |
|------|------|
| `npm run test:deliverable-triple-unify` | PASS |
| `npm run test:four-line-audit` | PASS（aligned 63.3%） |
| `npm run test:prelaunch:quick` | FAIL 3（非 UDC） |
| `npm run test:sdm:acceptance` | FAIL（DeliverableSummaryTable 既有用例） |

- [x] **Go（UDC R11 范围）** — 单内核 + 编译/过滤/磁盘 enrich 已落地，0709 六案 fixture 通过
