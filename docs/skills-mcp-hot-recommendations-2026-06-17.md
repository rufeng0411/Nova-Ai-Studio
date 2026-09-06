# Skills / MCP 全球热榜推荐表（2026-06-17）

> **前置基线**：[skills-system-inventory-2026-06-17.md](./skills-system-inventory-2026-06-17.md)（877 catalog · 413 Hub 可见）  
> **权威门禁**：每项 ≥2 独立来源 + SKILL/README 核验 + 对照本仓 inventory  
> **用法**：在「选」列将 `[ ]` 改为 `[x]`；勾选后发回维护者或进入 [skills-mcp-selected-batch-2026-06-17.md](./skills-mcp-selected-batch-2026-06-17.md) 批次落地

---

## 权威门禁（入表标准）

| 维度 | 要求 |
|------|------|
| 交叉验证 | skills.sh 安装量 + GitHub 官方 repo / OpenAI curated / Skillselion 等 **≥2 源** |
| 可核验 | 已读 SKILL.md 或官方 README 摘要 |
| 与本仓 | 必须写清「无 / 部分重叠 slug / 已装·可升级」 |
| 星级 | ★3 以上入表；★2 以下见 [附录 F](#附录-f候选池未入表项) |

---

## 表 A — 热门 Skills 推荐（全局热榜 + 缺口）

| 选 | 名称 | 地址 | 简介 | 权威依据 | 安装量/★ | 星级 | 系统已有对照 | 建议 Hub 落位 | 额外 API | L级 | 相对提升 | 评价与优势 |
|----|------|------|------|----------|----------|------|--------------|---------------|----------|-----|----------|------------|
| [ ] | find-skills | https://skills.sh/vercel-labs/skills/find-skills | 帮用户发现并安装社区 Skills 的 meta 能力 | skills.sh **#1 · 2.1M** + Vercel 官方 skills 生态 | 2.1M | ★★★★★ | **无**（2026-06 已删） | 开发·`dev_tools` 或办公 | 无 | L1 | 补能力发现入口，替代手动搜 catalog | 跨 Agent 通用；中文 prompt 可用 |
| [ ] | vercel-react-best-practices | https://skills.sh/vercel-labs/agent-skills/react-best-practices | React 性能/架构最佳实践 | skills.sh **#3 · 485K** + Vercel agent-skills repo | 485K | ★★★★★ | 部分：`dev-next-best-practices`（Next 专精） | 开发·`dev_frontend` | 无 | L1 | 补 React 专项，与 Next 技能并存 | 官方维护，适合前端对话审查 |
| [ ] | agent-browser | https://skills.sh/vercel-labs/agent-browser/agent-browser | Agent 驱动浏览器自动化 | skills.sh **#4 · 461K** + vercel-labs 独立 repo | 461K | ★★★★★ | **无** Skill（仅有 `dev-playwright` 不同栈） | 开发·`dev_testing` | 无 | L1 | 补 Vercel 系浏览器 Agent 工作流 | 与 Playwright MCP 可互补 |
| [ ] | frontend-design | https://skills.sh/anthropics/skills/frontend-design | Anthropic 官方前端设计审美与实现规范 | skills.sh **#2 · 561K** + anthropics/skills 官方 | 561K | ★★★★★ | **无**（曾删，与 od-* 不同层） | 创作·`create_ui` | 无 | L1 | 补「设计规范」层，不替代 od 物料 | 官方；可中文 brief |
| [ ] | firecrawl（CLI 总控） | https://skills.sh/firecrawl/cli/firecrawl | Firecrawl 集成：搜索/抓取/提取 | skills.sh **76K** + Firecrawl 官方 CLI repo | 76K | ★★★★☆ | 部分：仅 `mcp-firecrawl` 虚拟卡 | 营销·调研·`web_fetch` | `FIRECRAWL_API_KEY` | L2 | Skill 层工作流，补 MCP 单工具缺口 | 与现有 web_fetch 软失败策略对齐 |
| [ ] | firecrawl-scrape | https://skills.sh/firecrawl/cli/firecrawl-scrape | 单页 scrape 集成 | skills.sh 60K + 同官方包 | 60K | ★★★★☆ | 无 Skill | 营销·`web_fetch` | 同上 | L2 | 结构化单页提取 playbook | 适合竞品页/定价页采集 |
| [ ] | firecrawl-search | https://skills.sh/firecrawl/cli/firecrawl-search | 查询优先 discovery | skills.sh 60K + 官方 | 60K | ★★★★☆ | 无 | 营销·`web_fetch` | 同上 | L2 | 补「搜索→抓取」链，优于纯 web_search | 与 bocha 联网互补 |
| [ ] | just-scrape | https://skills.sh/scrapegraphai/just-scrape/just-scrape | ScrapeGraphAI 轻量抓取 Skill | skills.sh **196K** + scrapegraphai 官方 | 196K | ★★★★☆ | **无** | 营销·`web_fetch` | 可能需 ScrapeGraph Key | L2 | 多一种爬虫栈，降级备选 | 热榜高；接入前读 LICENSE |
| [ ] | obra brainstorming | https://skills.sh/obra/superpowers/brainstorming | Superpowers 结构化脑暴工作流 | skills.sh **230K** + obra/superpowers 高星生态 | 230K | ★★★★☆ | 部分：`pmd-*`/`brainstorm-structured` | 脑爆·`methodology` | 无 | L1 | 补「对话式脑暴流程」，非 PM 模板 | 英文为主；与现有 Pill 重叠可控 |
| [ ] | obra writing-plans | https://skills.sh/obra/superpowers/writing-plans | 实施计划编写（TDD 前置） | skills.sh 149K + superpowers 套件 | 149K | ★★★★☆ | 无 | 脑爆·`methodology` | 无 | L1 | 补复杂任务计划链 | 适合开发/全案模板前置 |
| [ ] | supabase-postgres-best-practices | https://skills.sh/supabase/agent-skills/postgres-best-practices | Postgres/Supabase 最佳实践 | skills.sh 239K + supabase 官方 agent-skills | 239K | ★★★★☆ | **无** | 开发·`dev_backend` | Supabase 项目可选 | L2 | 补 SaaS PG 阶段数据库规范 | 与本仓 PG 控制面相关 |
| [ ] | shadcn/ui skill | https://skills.sh/shadcn/ui/shadcn | shadcn 组件接入与规范 | skills.sh 196K + shadcn 官方 ui repo | 196K | ★★★★☆ | **无** | 创作·`create_ui` | 无 | L1 | 加速 Nova UI 组件化对话 | 与 od 设计系统互补 |
| [ ] | ui-ux-pro-max | https://skills.sh/nextlevelbuilder/ui-ux-pro-max-skill/ui-ux-pro-max | UI/UX 专业审查与改进 | skills.sh 223K + 独立高安装技能 | 223K | ★★★☆☆ | **无** | 创作·`create_ui` | 无 | L1 | 补 UX 审查 checklist | 社区；接入前 smoke 中文输出 |
| [ ] | remotion-best-practices | https://skills.sh/remotion-dev/skills/remotion-best-practices | Remotion 视频代码最佳实践 | skills.sh 378K + remotion-dev 官方 | 378K | ★★★★☆ | 部分：`remotion` vendor 包已有 | 创作·`create_video` | 无 | L1 | **升级** remotion 包对齐 upstream | 与 hf 视频链互补 |
| [ ] | context7（Skill） | https://skills.sh/intellectronica/agent-skills/context7 | 最新库文档检索（Context7） | skills.sh 7.9K + Upstash Context7 生态 | 7.9K | ★★★★☆ | **无** Skill/MCP | 开发·`dev_tools` | Context7 API | L2 | 补「查最新 API 文档」能力 | 开发对话刚需；需 MCP 或 Key |
| [ ] | microsoft playwright-cli | https://skills.sh/microsoft/playwright-cli/playwright-cli | 微软官方 Playwright CLI Skill | skills.sh 60K + microsoft/playwright-cli | 60K | ★★★★☆ | 部分：`dev-playwright`（vendor 不同源） | 开发·`dev_testing` | 无 | L2 | 对齐微软官方 CLI 路径 | 与 Codex curated `playwright` 可二选一 |
| [ ] | legal-risk-assessment | https://skills.sh/anthropics/knowledge-work-plugins/legal-risk-assessment | Cowork 法务风险评估 | skills.sh 2.9K + Anthropic 官方插件 | 2.9K | ★★★★☆ | 弱：`pms-*` 含 NDA 非专法务 | 办公·`🆕legal_compliance` | 无 | L1 | 补 **法律垂直** 代表卡 | 中文 prompt；Hub 可 hidden 大包 |
| [ ] | legal-response | https://skills.sh/anthropics/knowledge-work-plugins/legal-response | 法律函件/回应草稿 | skills.sh 2K + 官方 | 2K | ★★★☆☆ | 无 | 办公·`legal_compliance` | 无 | L1 | 与 risk-assessment 成套 | 须标注「非律师意见」免责声明 |
| [ ] | codex-playwright | https://github.com/openai/skills/tree/main/skills/.curated/playwright | OpenAI Codex 官方 Playwright curated | openai/skills **22K★** + curated 目录 | curated | ★★★★★ | 部分：`dev-playwright` | 开发·`dev_testing` | 无 | L2 | 官方 Codex 路径，可 vendor 前缀 `codex-*` | 与微软 CLI 选型见批次表 |
| [ ] | codex-figma 套件 | https://github.com/openai/skills/tree/main/skills/.curated/figma | Figma 设计→代码（多子 skill） | OpenAI curated + Figma 官方合作语义 | curated | ★★★★★ | 部分：`mcp-figma` 文档卡 | 创作·`create_ui` | Figma Token | L2 | Skill 层补 Figma 工作流 | 7 个子 skill，可只 vendor 代表项 |
| [ ] | codex-notion-research-documentation | https://github.com/openai/skills/tree/main/skills/.curated/notion-research-documentation | Notion 研究文档工作流 | OpenAI curated + Notion 官方 skills 生态 | curated | ★★★★☆ | 部分：`mcp-notion-collab` 卡 | 办公·协作 | Notion OAuth | L2 | 补办公研究交付链 | 适合调研报告入库 |
| [ ] | codex-transcribe / speech | https://github.com/openai/skills/tree/main/skills/.curated/transcribe | 音视频转写与语音 | OpenAI curated 官方 | curated | ★★★★☆ | **无** | 办公·`office_media` | OpenAI API | L2 | 补会议录音→文字 | 与 meeting-recorder 可联动 |
| [ ] | hyperframes 上游对齐 | https://skills.sh/heygen-com/hyperframes/hyperframes | HeyGen HyperFrames 官方视频 HTML | skills.sh 103K + 已 vendor `hf-*` | 103K | ★★★★☆ | **已装** `hf-hyperframes*` | 创作·视频 | 无 | L1 | **升级 bump** vendor commit | 对照 heygen 上游 changelog |
| [ ] | html-ppt 上游 bump | https://github.com/lewislulu/html-ppt-skill | HTML 幻灯工作室 | 已 vendor + Launch Registry | vendor | ★★★★★ | **已装** `html-ppt` | 营销·`deck_report` | 无 | L1 | **升级** 主题/模板同步 upstream | 勿重复安装，仅 bump |
| [ ] | seo-audit（marketingskills） | https://skills.sh/coreyhaines31/marketingskills/seo-audit | 站内 SEO 审计 | skills.sh 140K + 已 vendor `mkt-seo-audit` | 140K | ★★★★★ | **已装** `mkt-seo-audit` | 营销·`ai_search` | 无 | — | **勿装**；可核对 upstream 更新 | 表 D 升级项 |
| [ ] | phuryn pm-skills 重拉 | https://skillsmp.com/skills/phuryn-pm-skills | 65 项 PM/调研框架 | SkillsMP + 上次升级 SSL 失败记录 | 聚合 | ★★★★☆ | 部分：`pms-*` 68 项在仓 | 脑爆·PM | 无 | L2 | **升级** 补齐失败 vendor | 重跑 `vendor:skills-ecosystem` |
| [ ] | lawvable agent-skills | https://github.com/lawvable/agent-skills | 法律 Agent 技能精选集 | 法律垂直社区 + awesome-legal-skills 交叉 | 社区 | ★★★☆☆ | **无** 法律包 | 办公·`legal_compliance` hidden | 视子 skill | L3 | 补 **法律垂直** 深度 | 须合规审查；默认 hidden |
| [ ] | lpm-skills | https://github.com/legalopsconsulting/lpm-skills | 法律项目管理 LPM | 法律 Ops 社区 + Codex legal 生态引用 | 社区 | ★★★☆☆ | **无** | 办公·`legal_compliance` | 无 | L2 | 补律所/法务 PM 场景 | 英文；Hub 代表卡 1–2 即可 |
| [ ] | edu-sci 代表卡外露 | （本仓）`edu-sci-*` | 145 项科研/行业技能 | 已 vendor，Skillselion 科研类 | 145 hidden | ★★★★☆ | **已装 hidden** | 教育·`academic` | 部分需 API | L1 | **策略**：Hub 增 3–5 代表卡，非全装 | 见 inventory §五 |
| [ ] | mkt-sales-enablement 强化 | （本仓）`mkt-sales-enablement` | 销售赋能与 battlecard | 已 vendor marketingskills | 已装 | ★★★★☆ | **已装** | 营销·触达·`copy` | 无 | — | 流程模板强化，非新 skill | 可新建 `sales_enablement` Pill |

---

## 表 B — 热门 MCP 推荐

| 选 | 名称 | 地址 | 简介 | 权威依据 | 安装量/★ | 星级 | 系统已有对照 | 建议 Hub 落位 | 额外 API | L级 | 相对提升 | mcp.json 片段 |
|----|------|------|------|----------|----------|------|--------------|---------------|----------|-----|----------|---------------|
| [ ] | Firecrawl MCP | https://github.com/mendableai/firecrawl-mcp-server | 官方 Firecrawl MCP | MCP 生态标准 + 本仓已有虚拟卡 | 官方 | ★★★★★ | 卡有 `mcp-firecrawl`，**MCP 未配** | 营销·`web_fetch` | `FIRECRAWL_API_KEY` | L2 | 虚拟卡→真实连通 | `"firecrawl": { "command": "npx", "args": ["-y","firecrawl-mcp"] }` |
| [ ] | Context7 MCP | https://github.com/upstash/context7 | 最新文档注入 MCP | Upstash 官方 + skills.sh Context7 skill 双源 | 官方 | ★★★★☆ | **无** | 开发·`dev_tools` | Context7 Key | L2 | 查库文档，减幻觉 | HTTP MCP 见 Upstash 文档 |
| [ ] | Playwright MCP | https://github.com/microsoft/playwright-mcp | 微软 Playwright MCP | Microsoft 官方 + Codex curated playwright | 官方 | ★★★★★ | **无** MCP（有 dev-playwright skill） | 开发·`dev_testing` | 无 | L2 | 浏览器自动化 MCP 层 | `@playwright/mcp` stdio |
| [ ] | Browserbase MCP | https://github.com/browserbase/mcp-server-browserbase | 云端浏览器 MCP | PulseMCP 热榜 + Browserbase 官方 | 商业 | ★★★★☆ | **无** | 开发·`dev_testing` | Browserbase Key | L2 | 云端爬取/测试 | 适合 SaaS 无本地浏览器 |
| [ ] | Apify MCP | https://github.com/apify/apify-mcp-server | 社媒/网页 Actor 抓取 | Apify 官方 + ad-pr 目录 P1 | 官方 | ★★★★☆ | **无** | 营销·`web_fetch` | Apify Token | L2 | 结构化社媒/电商数据 | 与 CreatorCrawl 互补 |
| [ ] | Figma MCP | https://github.com/GLips/Figma-Developer-MCP | 读改 Figma 设计稿 | 文档已有 + Claude Partners Figma | 高星 | ★★★★★ | 卡有 `mcp-figma` | 创作·设计 | `FIGMA_TOKEN` | L2 | 设计交付闭环 | 见 admin-guide |
| [ ] | skills.sh MCP（skillsh-mcp） | https://github.com/brandonqr/skillsh-mcp | 搜索/安装 skills.sh 生态 | GitHub 官方 README + MCP.Directory | 社区 | ★★★☆☆ | **无** | 开发·`dev_tools` | 无 | L2 | Agent 内发现新 Skill | 元能力；SaaS 需评估 |
| [ ] | Exa MCP | https://github.com/exa-labs/exa-mcp-server | 语义搜索 MCP | best-of-mcp 榜 + 本仓 `mcp-exa` 卡 | 官方 | ★★★★☆ | 卡有 `mcp-exa` | 营销·`web_fetch` | `EXA_API_KEY` | L2 | 卡→连通 | 已有 catalog 条目 |
| [ ] | CreatorCrawl MCP | https://github.com/CreatorCrawl/creatorcrawl-mcp | 社媒公开数据 | ad-pr 目录 + 本仓 `mcp-creatorcrawl` | 商业 | ★★★☆☆ | 卡有，**未配** | 营销·监测 | API Key | L2 | 小红书/抖音监测补强 | 见 ad-pr §6 |
| [ ] | DataForSEO / seo-mcp | https://github.com/dataforseo/mcp-server-typescript | SEO 关键词/排名数据 | MCP 生态 SEO 类热榜 | 商业 | ★★★☆☆ | 卡有 `mcp-seo-data` | 营销·`ai_search` | DataForSEO 凭据 | L2 | GEO 监测数据层 | L2 凭据放 SkillServices |
| [ ] | Notion MCP（官方） | https://github.com/makenotion/notion-mcp-server | Notion 官方 MCP | Notion 官方 + Codex notion curated | 官方 | ★★★★☆ | 卡有 `mcp-notion-collab` | 办公·协作 | Notion OAuth | L2 | 调研交付入库 | 与 codex-notion skill 成套 |
| [ ] | Linear MCP | https://github.com/linear/linear-mcp-server | Issue/路线图 | Claude Partners Linear + Codex curated | 官方 | ★★★☆☆ | **无** | 办公·协作 | Linear OAuth | L2 | 研发/运营任务链 | 可选 |
| [ ] | Sentry MCP | https://github.com/getsentry/sentry-mcp | 错误追踪 MCP | Sentry 官方 + dev-sentry stub | 官方 | ★★★☆☆ | stub `dev-sentry-sdk-setup` | 开发·`dev_ops` | `SENTRY_DSN` | L2 | 补 stub 为真实 MCP | 已有 needs_config 条目 |
| [ ] | DeepWiki / 文档类 MCP | https://github.com/devin/deepwiki-mcp（示例） | 仓库文档问答 | MCP 社区热榜类 | 社区 | ★★★☆☆ | **无** | 开发·`dev_tools` | 视提供商 | L2 | 开源库文档问答 | 接入前安全审计 |
| [ ] | Smithery 聚合安装 | https://smithery.ai | MCP 一键安装/registry | PulseMCP + Smithery 官方 | 聚合 | ★★★☆☆ | **无** | — | — | L2 | 运维发现 MCP，非单卡 | 管理员用，不进 Hub |

---

## 表 C — 垂直补遗（按你的方向）

| 选 | 名称 | 地址 | 简介 | 权威依据 | 星级 | 系统已有对照 | 建议 Hub 落位 | L级 | 相对提升 |
|----|------|------|------|----------|------|--------------|---------------|-----|----------|
| [ ] | AI 搜索 · metawhisp best-aeo | https://github.com/metawhisp/best-aeo-skill | Princeton GEO 四维审计 | GitHub + ai-search-matrix 已列 | ★★★★☆ | **已装** `geo-aeo-audit` | 营销·`ai_search` | — | 核对 upstream，表 D |
| [ ] | 爬虫 · firecrawl 全包 vendor | https://github.com/firecrawl/cli | 6+ build/scrape/search skills | skills.sh 58–76K 各项 + 官方 | ★★★★★ | 仅 MCP 卡 | 营销·`web_fetch` | L2 | **整包 vendor** 优于单条 L1 |
| [ ] | 爬虫 · just-scrape | 见表 A | 见表 A | 见表 A | ★★★★☆ | 无 | 营销·`web_fetch` | L2 | Firecrawl 备选栈 |
| [ ] | 销售 · battlecard 强化 | 本仓 `mkt-competitive-intel` 等 | 已有 battlecard 类 | marketingskills 140K seo 同包 | ★★★★☆ | 已装多项 | 营销·策略 | L1 | 新建 **sales_enablement** Pill + 模板 |
| [ ] | HR · 无专包 | — | 缺口 | inventory 确认 | — | **空白** | 办公·`🆕hr_ops` | L3 | 候选：`phuryn` HR 子集或 Greenhouse 类 MCP |
| [ ] | 法律 · lawvable 包 | https://github.com/lawvable/agent-skills | 法律 skill 精选 | 法律社区双源 | ★★★☆☆ | 无 | 办公·legal hidden | L3 | 代表卡 2 + 流程模板 |
| [ ] | 儿童趣味 · caveman/grill | https://skills.sh/juliusbrussee/caveman | 趣味 CLI/学习向 | skills.sh 261K 热榜 | ★★★☆☆ | 无 | 教育·`🆕edu_fun` | L1 | 非 K12 课纲，偏趣味 |
| [ ] | 行业 · edu-sci 外露 | 本仓 vendor | 科研/医疗/生信 | 145 项已装 hidden | ★★★★☆ | hidden | 教育·`academic` | L1 | 挑 5 代表进 Hub |
| [ ] | 创意 · ai-video-generation | https://skills.sh/qu-skills/skills/ai-video-generation | 热榜视频生成 skill | skills.sh 306K + qu-skills | ★★★☆☆ | 部分 hf/seedance | 创作·`create_video` | L2 | 与模型池 Seedance 对齐 Key |
| [ ] | 企管 · OKR（飞书 Lark） | https://skills.sh/open.feishu.cn/lark-okr | 飞书 OKR Skill | skills.sh 231K + 飞书官方 | ★★★★☆ | 无 | 办公·`🆕enterprise_mgmt` | L2 | 国内企管；需飞书 OAuth |
| [ ] | 办公 · anthropic pptx/pdf 升级 | 本仓 `anth-*` | 官方办公包 | skills.sh pptx 150K | ★★★★★ | 已装 | 办公 | L1 | bump anthropics-skills vendor |

---

## 表 D — 已装·建议升级（非新装）

| 选 | 名称 | 系统 slug | 权威依据 | 相对提升 | 建议动作 |
|----|------|-----------|----------|----------|----------|
| [ ] | html-ppt | `html-ppt` | lewislulu upstream · Launch 已接 | 主题/整稿 preview 已本地修复 | `npm run vendor:html-ppt` bump |
| [ ] | hyperframes | `hf-*` | skills.sh 103K vs 本地 vendor | CLI/registry 子 skill 可能落后 | `npm run vendor:video-coding` |
| [ ] | marketingskills | `mkt-*` | seo-audit 140K 仍在榜 | 核对 coreyhaines31 新 commit | vendor marketingskills |
| [ ] | seo-geo 包 | `geo-*` | aaron-he-zhu 仍在 skills.sh | 7 项完整性 | `npm run vendor:marketing` |
| [ ] | phuryn PM | `pms-*` | SkillsMP 65 项 | SSL 失败项补齐 | `npm run vendor:skills-ecosystem` |
| [ ] | anthropics-skills | `anth-*` | pptx 150K/pdf 137K 榜 | canvas/webapp-testing 等待 | vendor anthropics 子目录 |
| [ ] | remotion | `remotion` + vendor | remotion-best-practices 378K | 最佳实践 skill 未独立 slug | 合并 remotion-best-practices |
| [ ] | pd-geo / Nova 模板 | 流程模板 | 内部 | 对齐 geo-aeo 新 Pill | `npm run templates:gen` 核对 |

---

## 表 E — 明确不推荐

| 名称 | 地址 | 原因 |
|------|------|------|
| postiz-agent / xiaohongshu-mcp | 历史目录 | upgrade-report **明确排除** |
| n8n-skills / notebooklm-skill | 社区 | 维护/合规未过门禁 |
| find-skills 重复安装 | 若恢复 meta | 与表 A 二选一；勿双份 |
| 全量 azure-skills 6M 安装包 | microsoft/azure-skills | 与本仓 SaaS 场景无关，体量过大 |
| 全量 runcomfy 视频包 2.8M | agentspace-so | 与 hf/模型池重复；Key 成本高 |
| Trail of Bits 安全包 | — | 历史排除 |
| 低星 fork skills | 各类 | 附录 F；无双源 |

---

## 附录 F — 候选池未入表项（未过门禁）

| 名称 | 原因 |
|------|------|
| jackiexiao/just-scrape fork | 仅 106 安装，权威不足 |
| hr 关键词 skills find | 无直接结果；hr 搜到 frontend-design 噪声 |
| 单源 GitHub Trending 无 skills.sh | 缺交叉验证 |
| ★2 以下社区 empty SKILL | 未读 SKILL.md 或 6 个月未更新 |

完整候选 JSON：`docs/.skills-candidate-pool.json`

---

## 附录 — 新建分类提案（勾选表 C 后启用）

见 [skills-mcp-new-taxonomy-proposals-2026-06-17.md](./skills-mcp-new-taxonomy-proposals-2026-06-17.md)

---

## 勾选落地与 Smoke（阶段 5）

| 勾选项类型 | 建议命令 |
|------------|----------|
| L1 单 skill | `npx skills add owner/repo@skill` → `node scripts/bootstrap-pilotdeck-config.mjs` → `npm run capabilities:gen` |
| L2 vendor 包 | `npm run vendor:skills-ecosystem` / `vendor:marketing` / 扩 manifest |
| Hub 分类 | 改 `capabilityHubTaxonomy.mjs` + `capability-hub-zh.json` → `npm run capabilities:gen` |
| 验收 | `npm run smoke:capability-hub` · `npm run smoke:capability-try-prompts` |
| 营销 GEO | `npm run smoke:marketing-install` · `npm run verify:marketing-saas` |
| MCP 连通 | Settings MCP 绿点 + 对话 `mcp__*` 试调用 |

**批次表模板**：[skills-mcp-selected-batch-2026-06-17.md](./skills-mcp-selected-batch-2026-06-17.md)

---

*调研完成：2026-06-17 · 数据源 skills.sh / npx skills find / openai/skills curated / 本仓 inventory*
