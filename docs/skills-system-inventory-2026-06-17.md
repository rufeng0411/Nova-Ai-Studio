# Nova Ai-Studio 已有 Skills / MCP 系统审阅（2026-06-17）

> **用途**：全球热榜调研的权威基线。推荐表中「系统已有对照」「相对提升」均以此为准。  
> **生成**：`node --input-type=module` 统计 + `npm run audit:skill-duplicates` + `generate-global-skills-discovery.mjs`

---

## 一、总览

| 指标 | 数量 | 说明 |
|------|------|------|
| 能力目录 catalog | **877** | `config/capabilities.catalog.json` |
| 磁盘 SKILL.md 目录 | **864** | `skills/**/SKILL.md` |
| Hub **可见** | **413** | `hidden_in_hub` 未设 |
| Hub **隐藏** | **464** | 含 edu-sci-* 145、mkt-brand-* 橱窗策略等 |
| MCP 虚拟卡 | **10** | `mcp-*` 前缀，需配置 Key |
| Launch Registry | **1** | `html-ppt`（visual） |
| Vendor 生态包 | **21** | 见 §三 |
| 中文 Hub 元数据 | **130** 条显式 | `capability-hub-zh.json`（其余走 auto） |

---

## 二、按 Tab 覆盖（major_category）

| Tab | catalog 数 | Hub 可见约 | 代表 slug / 包 |
|-----|------------|------------|----------------|
| **营销飞轮** | 306 | ~180 | `pd-geo`、`geo-*`、`mkt-*`、`df-*`、`yixiaoer`、`nova-research-*`、`mcp-firecrawl` |
| **办公** | 16 | ~14 | `anth-docx/pptx/xlsx/pdf`、`office-*`、`compose_images_to_document` |
| **创作** | 55 | ~45 | `od-*`（30）、`open-design`、`html-ppt`、`create-*`、`humanizer/unslop`、`hf-*`、`persona-*` |
| **开发** | 24 | ~18 | `dev-playwright`、`dev-next-*`、`anth-mcp-builder`、`mcp-builder` |
| **脑爆** | 131 | ~90 | `pmd-*`（49）、`pms-*`（68）、`brainstorm-structured`、`persona-*` |
| **教育学习** | 345 | ~66 可见 | `hermes-edu-*`、`junior/senior/teacher-*`、`edu-sci-*`（145 **hidden**）、`edu-recursive-research` |

### 营销飞轮子类 Pill（task_group，Top 计数）

| Pill | 约计 | 代表 |
|------|------|------|
| `ai_search` | 高 | `geo-*`、`pd-geo`、`mkt-ai-seo` |
| `web_fetch` | 中 | `mcp-firecrawl`、`mcp-exa`、`tool-web-search` |
| `competitive_intel` | 中 | `mkt-competitive-intel`、`nova-research-competitor` |
| `brand_sentiment` | 中 | `mkt-brand-mention`、`mkt-review-mining` |
| `market_landscape` | 中 | `df-deep-research`、`df-consulting-analysis` |
| `copy` / `campaign_full` | 高 | `mkt-content-*`、`mkt-adv-*` |
| `deck_report` | 低 | `html-ppt`、`anth-pptx` |

---

## 三、Vendor 包清单

| 包目录 | 典型前缀 | 备注 |
|--------|----------|------|
| `marketing-ecosystem` | `mkt-brand-*`、`mkt-adv-*`、`mkt-aso-*` | 118+ brand；多数 hidden，16 橱窗 |
| `marketingskills` | `mkt-*` | coreyhaines31 精选 |
| `seo-geo` | `geo-*` | aaron-he-zhu 7 项 |
| `marketing-hub` | `hub-*` | 场景打包 |
| `anthropics-skills` | `anth-*` | pptx/xlsx/pdf/canvas/mcp-builder |
| `creation-ecosystem` | `create-*`、`video-db-*` | 含 fal 子技能 |
| `dev-ecosystem` | `dev-*` | playwright、next-best-practices |
| `office-ecosystem` | `office-*` | ecom、nutrient |
| `education-ecosystem` | `edu-sci-*` | **145 项，默认 hidden** |
| `hermes-edu-skills` | 学段前缀 | K12 + 教师 |
| `deer-flow` | `df-*` | 深度调研/图表/文献 |
| `awesome-llm-apps` | `ala-*` | 多数 hidden |
| `academic-research` | `ora-*`、`anth-pdf` | 学术包 |
| `pm-skills` | `pms-*`、`pmd-*` | phuryn + deanpeters |
| `html-ppt` | `html-ppt` | Launch visual |
| `nova-1` | `nova-*` | 8 项 L2 |
| `hyperframes` | `hf-*` | 视频 |
| `persona-skills` | `persona-*` | 人设 |
| `writing-polish` | `humanizer`、`unslop` | 润色 Pill |
| `remotion` | remotion | 视频代码 |
| `aigeotools` | — | **未部署平台**，参考 only |

**仅 html-ppt 有 `VENDOR.md` commit 钉死**；其余包升级需逐包对照 upstream。

---

## 四、MCP 虚拟卡（已 catalog，需 Key）

| slug | 用途 | 状态 |
|------|------|------|
| `mcp-firecrawl` | 网页抓取/搜索 | 文档已有，Skill 层 firecrawl-build **未 vendor** |
| `mcp-exa` | 语义搜索 | 需 EXA_KEY |
| `mcp-figma` | 设计稿 | 文档已有 |
| `mcp-creatorcrawl` | 社媒数据 | 需 Key |
| `mcp-ads` / `mcp-seo-data` | 投放/SEO 数据 | L2 |
| `mcp-postiz` | 社媒发布 | **列入历史排除，未装 MCP** |
| `mcp-similarweb` | 流量竞品 | 需 Key |
| `mcp-google-workspace` / `mcp-notion-collab` | 协作 | L2 |

---

## 五、垂直能力缺口（对照用户方向）

| 垂直 | 本仓状态 | 说明 |
|------|----------|------|
| **AI 搜索 / GEO** | **饱和** | `pd-geo` + `geo-*` 9 项 + mkt-ai-seo；缺 upstream 增量审计 |
| **爬虫 / 采集** | **部分** | MCP 卡有；**Firecrawl Skills 包（build/scrape/search）未 vendor** |
| **销售赋能** | **有** | `mkt-sales-enablement`、battlecard 类 mkt/pms；缺独立「话术/培训」子 Pill |
| **企业管理 / OKR** | **弱** | 分散在 pms/pmd；无 `enterprise_mgmt` Pill |
| **人力资源** | **弱** | pms 含 stakeholder，**无 recruiting/HR 专包** |
| **法律** | **弱** | pms 含 NDA/privacy/PESTLE 法务向；**无 lawvable/lpm 级法律包** |
| **儿童 / 趣味** | **有 K12** | hermes 学段丰富；**缺「趣味应用/游戏化」创作向** |
| **行业专业（医疗/金融）** | **hidden 为主** | edu-sci-* 145 hidden；Hub 不展示 |
| **Codex 官方 curated** | **未系统 vendor** | openai/skills `.curated` 未整包接入 |
| **find-skills** | **已删除** | 2026-06 升级时物理删除；热榜 meta 能力缺口 |
| **vercel react/next best practices** | **部分** | `dev-next-best-practices` 有；**react-best-practices 无** |

---

## 六、重叠簇（保留策略）

| 簇 | slug 前缀 | 建议 |
|----|-----------|------|
| 深度调研 | `df-*` / `ala-*` / `nova-research-*` | 保留 df + nova 可见；ala hidden |
| 竞品 | `geo-competitor-*` / `mkt-competitive-*` / `pms-competitor-*` | 保留，中文 display 已区分 |
| GEO 成稿 | `geo-*` / `mkt-seo-*` / `pd-geo` | 保留；模板对齐 geo-aeo |
| 办公文档 | `anth-*` / `edu-sci-*`（pptx/pdf） | anth Hub 可见；edu-sci hidden |
| 幻灯 | `html-ppt` / `anth-pptx` / `frontend-slides` | 并存：HTML 放映 vs Office vs Web |

详见 [skills-duplicates-report-2026-06.zh-CN.md](./skills-duplicates-report-2026-06.zh-CN.md)。

---

## 七、明确不重复推荐为「新发现」（已装·最新或已排除）

**已装·核心（勿当新项推荐）：**

- Open Design + od-*（30）、pd-geo、geo-*、marketing-ecosystem 500+、html-ppt、anthropics-skills 6 项、humanizer/unslop、nova-1、hf-*、persona-*、deer-flow、hermes-edu、yixiaoer、social-creative-matrix

**历史排除（upgrade-report）：**

- postiz-agent、xiaohongshu-mcp、n8n-skills、notebooklm-skill、sora、paper-publisher、Trail of Bits、translate-book

**已删除勿装回（除非用户明确要求）：**

- find-skills、skill-creator、frontend-design、web-design-guidelines、spike、trello 等 16 项（见 upgrade-report §三）

---

## 八、建议优先升级（vendor bump 候选）

| 项 | 理由 |
|----|------|
| `html-ppt` | 对照 lewislulu/html-ppt-skill 上游新 commit |
| `openai/skills` curated 增量 | Codex 官方新 curated 技能 |
| `firecrawl/skills` | 与 mcp-firecrawl 互补，skills.sh 高安装 |
| `phuryn pm-skills` | 上次 vendor SSL 失败，可重拉 |
| `vercel-labs/skills` | react-best-practices 等热榜项 |

---

*下一文档：[skills-mcp-hot-recommendations-2026-06-17.md](./skills-mcp-hot-recommendations-2026-06-17.md)*
