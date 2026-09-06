# P0-9：研究来源证据与低误报内容断言

## 必须实现

- subjectGroundingPolicy.ts（canonical subject, query 带完整主体）
- validateDeliverablesEngine Nova 页数精确匹配（6页=6，非至少6）
- 产品用研显式文件优先（单 HTML 单槽）
- quick|standard|deep tier 章节/字数阈值
- researchSourceLedger.ts（≤32/8KiB, sourceId, web_fetch publicOnly）
- nova-research-product-user exact canary 绑定
- CONTENT_QUALITY_V2 enforce 仅 exact canary

## 测试

- subjectGroundingPolicy.test.ts
- researchSourceLedger.test.ts
- validateDeliverablesEngine content quality tests
- adversarial fixtures from plan

报告：`F:\Ai-pilotdeck\.superpowers\sdd\task-p0-9-assertions-report.md`
