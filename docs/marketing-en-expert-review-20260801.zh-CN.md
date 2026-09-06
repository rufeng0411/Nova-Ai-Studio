# 营销站英文专家审阅报告（2026-08-01）

**总判：GO**

前置门禁：`npm run test:marketing-en:copy:gate` **PASS**（报告 `artifacts/showcase-design-qa/en-copy-audit-20260801.md`）。  
对照基线：ZH FAQ / Docs 磁盘正文（FAQ 18 题；Docs `#s1`–`#s12`、表格 37/38、字节比 ≈0.72）。  
L4 telemetry：`PILOTDECK_MARKETING_ANALYTICS` 本批未做 about/copyright `page_view` 实机回填 → **telemetry=n/a**（按计划以专家 GO + copy gate + pages unit 三联绿计 L4）。

---

## 角色量表（必填）

| 维 | 结论 |
|----|------|
| 术语一致 | PASS：Nova Ai-Studio / Goal-Loop / Agent Harness / deliverables / Showcase / 400+ capabilities / up to ~70% token savings (scenario-dependent)；明确与 Amazon Nova 无关 |
| 语气 | PASS：B2B 企业级，克制可验收；首页/Claims/FAQ 无空洞 AI-hype 堆砌 |
| 自然度 | PASS：母语可读；偶有偏正式长句，可接受 |
| 完整度 | PASS：首页下翻、FAQ 18、Compare、Contact、Claims、Docs 12 章壳+表、Showcase 壳+卡面 EN；about/copyright 种子 EN |
| SEO/无障碍 | PASS：`lang="en"`、hreflang、aria-label 与正文语言一致（语言切换「中文」除外） |
| 风险表述 | PASS：Claims 与首页 Token 口径同源，保留 up to / scenario-dependent |

---

## 审阅矩阵

| 路径 | 专家读 | 产品术语 | 版式 | 判定 |
|------|--------|----------|------|------|
| `/en/` | 首页下翻全屏已英译；Token/Harness/企业叙事齐 | 一致 | 与 ZH 同源 | PASS |
| `/en/docs/` | 对照最新 ZH：hero--openai、sidebar、s1–s12、表≈齐 | 一致 | 侧栏布局保留 | PASS |
| `/en/faq/` | 18 Q&A 对表最新 ZH；JSON-LD 同步 | 一致 | FAQ 双栏 | PASS |
| `/en/compare/` | 表头+单元格企业向 | 一致 | 表可读 | PASS |
| `/en/contact/` | 表单/校验/感谢英文化 | 一致 | 同壳 | PASS |
| `/en/claims/` | 口径句与首页互链 | 一致 | 同壳 | PASS |
| `/en/showcase/` | 壳+八栏卡面 EN；pills 标题可见（P0-A） | catalog EN 企业级 | pills sticky | PASS |
| catalog.js | name/annotation/lead EN 无 CJK；企业场景向 | 一致 | n/a | PASS |
| `/en/about/` `/en/copyright/` | CMS 种子英译；壳+hreflang | 一致 | legal-page | PASS |

---

## P1 债（不阻塞 GO）

1. `showcase/media/**` 演示 HTML 正文本批不强制全英（计划范围外；标注 Sample deliverable）。
2. `prompt_en` 若日后再扩写，须再跑 copy gate（当前无 CJK WARN）。
3. about/copyright 前台依赖 Bridge `GET /api/marketing/pages/:slug`；失败时回退 `/pages/{slug}.json` 轻量渲染。

---

## 验收命令（本批）

```bash
npm run test:marketing-en:copy:gate
npm run test:marketing-pages:unit
npm run smoke:showcase:i18n
npm run check:marketing-site
npm run check:marketing-seo
```

**宣称「英文生产可用」：本报告 GO + 上述门禁绿。**
