# P0-9 研究来源与内容断言 — 验收报告

**状态：DONE**

## 实现摘要

- `subjectGroundingPolicy.ts`：完整主体冻结、官方搜索 query 不得裸 `G700`、shadow 差异评估。
- `researchSourceLedger.ts`：≤32 条 / 8KiB、sourceId、URL+contentHash 去重、章节引用校验。
- `productResearchQualityPolicy.ts`：quick/standard/deep 章节与字数阈值、显式文件优先。
- `contentQualityCanaryPolicy.ts`：`CONTENT_QUALITY_V2` enforce 仅 exact canary。
- `capabilityGoalQualityPolicy.ts` + `TurnRunner` 注入 exact capability 质量合同。
- `validateDeliverablesEngine.ts`：Nova 精确页数 + slide-NN 文件名；pipeline 读取 research ledger。

## 验收

| 命令 | 结果 |
|------|------|
| `npx vitest run src/saas/research/subjectGroundingPolicy.test.ts src/saas/research/researchSourceLedger.test.ts src/saas/constraints/contentQualityCanaryPolicy.test.ts` | 8/8 |
| `npx vitest run tests/agent/validate-deliverables-content-quality.test.ts` | 2/2 |

## 灰度

- 主体语义分类保持 shadow；产品用研 / Nova 页数 / 显式文件合同在 canary slug + tenant 命中时可 enforce。
