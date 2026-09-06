# AI 搜索优化 Skills 选型表

> 门禁文档：vendor 与能力中心归位以本表为准。本轮「AI 搜索优化」= GEO / AEO / AI 可见度 / 大模型引用优化，**不绑定** AIGEOTOOLS 单一项目。

## 0.1 主包与锚点（P0）

| 中文名 | 建议 slug | 来源项目 | 链接 | 层级 | 飞轮阶段 | 策划/执行/监测 | 选型理由 |
|--------|-----------|----------|------|------|----------|----------------|----------|
| AI 搜索全案 | `pd-geo`（已有） | PilotDeck L2 | [skills/pd-geo](../skills/pd-geo) | L2 | 策略、监测 | 策划+执行+监测 | 国内平台成稿、`geo_api` 评分验证、已接 smoke:aigeo |
| AI 搜索技能包（精选 7 项） | `geo-*`（vendor） | aaron-he-zhu/seo-geo-claude-skills | https://github.com/aaron-he-zhu/seo-geo-claude-skills | L1 | 全阶段 | 三层全覆盖 | ~2k stars；CORE-EEAT + CITE；含中文触发词；零依赖 Markdown |
| AI 可见度审计 | `geo-aeo-audit` | metawhisp/best-aeo-skill | https://github.com/metawhisp/best-aeo-skill | L1 | 监测 | 监测 | Princeton KDD 四维 GEO 分；33 项采集；可修 llms.txt/schema |
| AI 引用评分 | `geo-citability` | zubair-trabzada/geo-seo-claude | https://github.com/zubair-trabzada/geo-seo-claude | L1 | 创意、监测 | 执行+监测 | citability 评分、AI 爬虫、PDF 客户报告 |
| AI 搜索可见度 | `mkt-ai-seo`（已有） | marketingskills | skills/vendor/marketingskills/mkt-ai-seo | L1 | 调研、监测 | 策划+监测 | 已 vendor；pd-geo 审计框架依赖 |
| 站内 SEO 审计 | `mkt-seo-audit`（已有） | marketingskills | 同包 | L1 | 监测 | 监测 | 与 AI 可见度互补 |
| 结构化数据 | `mkt-schema`（已有） | marketingskills | 同包 | L1 | 发布 | 执行 | pd-geo 工作流第 4 步 |
| 规模化 SEO 页 | `mkt-programmatic-seo`（已有） | marketingskills | 同包 | L1 | 发布 | 执行 | AI 搜索时代程序化落地页 |

## 0.2 seo-geo-claude-skills 精选 vendor（前缀 `geo-`）

| 上游 skill 目录 | 建议 slug | 中文名 | 飞轮 stage | task_group | 层级 |
|-----------------|-----------|--------|------------|------------|------|
| research/keyword-research | `geo-keyword-research` | AI 关键词调研 | research | ai_search | 策划 |
| research/competitor-analysis | `geo-competitor-analysis` | AI 竞品可见度 | research | ai_search | 策划 |
| optimize/geo-content-optimizer | `geo-content-optimizer` | AI 可引用内容优化 | create | ai_search | 执行 |
| build/seo-content-writer | `geo-seo-content-writer` | AI 搜索友好成稿 | create | ai_search | 执行 |
| optimize/technical-seo-checker | `geo-technical-seo` | AI 爬虫与技术可达 | distribute | ai_search | 执行 |
| optimize/on-page-seo-auditor | `geo-on-page-audit` | 页面 AI 可见度审计 | measure | ai_search | 监测 |
| monitor/rank-tracker | `geo-rank-track` | AI 可见度跟踪 | measure | ai_search | 监测 |

触达阶段补充：`mkt-email-sequence`（knowledge-work-plugins）→ activate / ai_search。

## 0.3 knowledge-work-plugins marketing（6 项）

| 上游路径 | slug | 中文名 | 飞轮 stage |
|----------|------|--------|------------|
| marketing/competitive-brief | `mkt-competitive-brief` | 竞品简报 | research |
| marketing/competitive-intelligence | `mkt-competitive-intel` | 竞争情报摘要 | research |
| marketing/content-creation | `mkt-content-creation` | 营销内容创作 | create |
| marketing/draft-content | `mkt-draft-content` | 渠道草稿 | activate |
| marketing/email-sequence | `mkt-email-sequence` | 邮件序列 | activate |
| marketing/performance-report | `mkt-performance-report` | 投放效果报告 | measure |

## 0.4 本仓手写 SaaS 包装

| slug | 中文名 | 飞轮 stage | task_group |
|------|--------|------------|------------|
| `mkt-brand-mention` | 品牌提及监测 | measure | brand_sentiment |
| `mkt-review-mining` | 评论舆情挖掘 | research | brand_sentiment |

## 0.5 不纳入本轮主路径

| 项目 | 链接 | 说明 |
|------|------|------|
| AIGEOTOOLS | https://github.com/chnjames/AIGEOTOOLS | Python 平台；**本轮不部署** |
| SEO-AEO-GEO-Assistant | https://github.com/kxwu222/SEO-AEO-GEO-Assistant | 维护弱于 aaron-he-zhu 包 |
| xSeek Skills | 商业 API | 可选 MCP 后续项 |
