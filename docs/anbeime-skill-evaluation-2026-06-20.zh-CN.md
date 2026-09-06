# anbeime/skill 技能商店 — Nova 集成评测（2026-06-20）

来源：[anbeime/skill](https://github.com/anbeime/skill)（~1.9k★）  
说明：该仓库**不是单一 Skill**，而是「技能商店 + 爬虫」：  
- **本地打包 Skill**：`skills/` 下 **56** 个可安装包（含子技能嵌套）  
- **财务 MCP 元数据**：`finance-skills/finance-mcp.json`（非 SKILL.md）  
- **官方索引**：`data/skills.json` **182** 条（来自 awesome-agent-skills，**仅元数据/链接**，无完整 vendor 包）

Nova 当前 catalog **1224** 项；下列「已装」指 **同名或功能等价** 已在 `skills/` + `capabilities.catalog.json`。

---

## 一、本地打包 Skill（56 项）逐条评测

| # | Skill ID | 分类 | anbeime★ | Nova★ | 已装？ | Nova 对应/缺口 | 难度 | API Key / 依赖 | 冲突与风险 | 建议 |
|---|----------|------|---------|-------|--------|----------------|------|----------------|------------|------|
| 1 | content-creation-publisher | 内容发布 | 5 | 4 | **部分** | 采集≈Firecrawl/`web_fetch`；发布≈`yixiaoer`/`social-creative-matrix`；无一体化总控 Skill | L2 | Chrome CDP、Node、微信 Cookie、可选 LLM | 与蚁小二/矩阵重复；微信自动化 fragile | **暂缓**（用现有飞轮+矩阵组合） |
| 2 | intelligent-content-system | 内容系统 | 5 | 3 | 否 | 无等价；偏 prompt 编排 | L1 | LLM | 与 mkt-brand-* 重叠 | 低优 |
| 3 | article-illustrator | 配图 | 4 | 3 | 否 | `generate_image`/通义 Seedream 可替代 | L2 | 生图 API | 与 Nova 媒体栈重复 | 可选 |
| 4 | baoyu-url-to-markdown | 采集 | 4 | 4 | **部分** | `fc-firecrawl-*`/`web-just-scrape`/`web_fetch` | L1 | 可选 FIRECRAWL | 已覆盖 | **不装** |
| 5 | baoyu-format-markdown | 排版 | 4 | 3 | **部分** | `anth-docx`/Markdown 导出链 | L1 | 无 | 低价值增量 | 不装 |
| 6 | baoyu-post-to-wechat | 微信 | 4 | 3 | **部分** | `yixiaoer` 草稿/发布 | L2 | 微信 Cookie/扫码 | 运维成本高 | 不装（用 yixiaoer） |
| 7 | baoyu-post-to-x | X 发布 | 3 | 3 | **部分** | `mkt-x-article-publisher` | L2 | X Cookie/API | 已有 | 不装 |
| 8 | baoyu-xhs-images | 小红书 | 4 | 3 | **部分** | `social-creative-matrix` | L2 | 生图 API | 已有 | 不装 |
| 9 | wechat-hotspot-publisher | 微信热点 | 3 | 2 | 否 | `web_search`+文案 skill 可组合 | L2 | 微信+LLM | 热点质量难控 | 不装 |
| 10 | wechatsync-publisher | 微信同步 | — | 2 | 否 | 同 baoyu 微信 | L3 | 微信 Cookie | fragile | 不装 |
| 11 | qiaomu-x-article-publisher | X 发布 | — | 2 | **部分** | `mkt-x-article-publisher` | L2 | X API | 重复 | 不装 |
| 12 | content-research-writer | 内容调研 | — | 3 | **部分** | GEO/mkt-research/deep-research | L1 | LLM | 已有 | 不装 |
| 13 | video-creation-suite | 视频套件 | 5 | 4 | **部分** | `hf-*`+`render_html_video`+Seedance | L2 | 火山/Google 视频 Key | 与 HyperFrames 重叠 | **择优 vendor 子模块** |
| 14 | video-creation-collaborator | 视频协同 | 4 | 3 | 否 | 多 Agent 编排≈流程模板 | L2 | LLM+媒体 Key | 流程模板可吸收 | 低优 |
| 15 | video-creation-pro | 商品视频 | 3 | 3 | **部分** | Nova 视频+电商模板 | L2 | 媒体 Key | 已有能力 | 不装 |
| 16 | video-recreation | 视频二创 | 4 | 3 | 否 | `hf-*`/剪映类无直接等价 | L2 | ffmpeg+LLM |  niche | 可选调研 |
| 17 | video-frame-extractor | 反推 | 3 | 3 | **部分** | 内置 bash/ffmpeg | L2 | ffmpeg | 低 | 不装 |
| 18 | video-transcript-downloader | 字幕下载 | — | 3 | **部分** | 文档导入/MinerU 链 | L2 | yt-dlp | 已有 | 不装 |
| 19 | viral-video-copywriting | 爆款文案 | 4 | 4 | **部分** | 飞轮创意 Pill + 社媒矩阵 | L1 | LLM | 可补流程模板 | **可选 L1** |
| 20 | historical-science-video-prod | 历史科普 | 2 | 1 | 否 | 无 | L1 | LLM | 太垂直 | 不装 |
| 21 | historical-interview-scripts | 历史访谈 | 2 | 1 | 否 | 无 | L1 | LLM | 太垂直 | 不装 |
| 22 | three-body-video-creator | 三体视频 | 2 | 1 | 否 | 无 | L1 | LLM | 太垂直 | 不装 |
| 23 | pet-commerce-creator | 萌宠带货 | 3 | 2 | 否 | 社媒矩阵+视频 | L2 | 媒体 Key | niche | 不装 |
| 24 | ecommerce-copywriter | 电商文案 | 3 | 3 | **部分** | `office-ecom`/mkt-copy | L1 | LLM | 已有 | 不装 |
| 25 | ecommerce-video-marketing | 电商视频 | 3 | 3 | **部分** | 视频飞轮 | L2 | 媒体 Key | 已有 | 不装 |
| 26 | product-marketing-copywriter | 产品文案 | 3 | 3 | **部分** | mkt-brand-* | L1 | LLM | 已有 | 不装 |
| 27 | product-video-creator | 商品视频 | 4 | 3 | **部分** | Seedance/Veo | L2 | 视频 Key | 已有 | 不装 |
| 28 | xiaohongshu-makeup | 小红书美妆 | 3 | 2 | 否 | `social-creative-matrix` | L2 | 生图 | **明确不装** xhs-mcp 类 | 不装 |
| 29 | NanoBanana-PPT-Skills | PPT 生图 | 5 | 4 | **是** | `create-nanobanana-ppt` | L2 | 生图 API | 与 ppt-master/html-ppt 互补 | **已装** |
| 30 | nanobanana-ppt-visualizer | PPT 视觉 | 3 | 3 | **部分** | 同上 | L2 | 生图 | 重复 | 不装 |
| 31 | ppt-generator | PPT 生成 | 4 | 3 | **部分** | **`ppt-master`**（刚装）+ html-ppt | L2 | Python+LLM | 三轨 PPT 并存 | **不重复装** |
| 32 | pptx-generator | JSON→PPTX | 3 | 3 | **部分** | `export_document`/IR→python-pptx | L2 | Python | 已有 | 不装 |
| 33 | ppt-roadshow-generator | 路演视频 | 2 | 2 | 否 | Remotion/hf | L3 | 视频栈 | niche | 不装 |
| 34 | remotion-video-enhancer | Remotion | 2 | 3 | **部分** | `remotion-best-practices`+hf-* | L2 | Node | 已有 | 不装 |
| 35 | tts-voice-synthesis | TTS | 5 | 3 | **部分** | 模型池 CosyVoice/Gemini TTS | L2 | TTS API | 无 skill 壳 | 可选 L2 |
| 36 | qwen3-tts-local | 本地 TTS | 4 | 3 | 否 | Edge-TTS 本地 | L2 | 无/Edge | Windows 可用 | **可选 L2** |
| 37 | qwen3-asr-assistant | ASR | 4 | 3 | **部分** | 文档导入 MinerU/Qwen-VL | L2 | 可选云 ASR | 已有 OCR 链 | 低优 |
| 38 | infinitetalk | 数字人 | 5 | 2 | 否 | 无等价 | **L3** | **DashScope**+GPU+数 GB 权重 | SaaS 不适用 | **不装**（私有化专项） |
| 39 | infinitetalk-shopping-avatar | 导购数字人 | 2 | 1 | 否 | 同 infinitetalk | L3 | 同上 | 同上 | 不装 |
| 40 | digital-avatar-shopping-video | 口播带货 | 2 | 1 | 否 | 视频+人设 persona-* | L3 | GPU+API | 与人设 skill 重叠 | 不装 |
| 41 | dream-video-prompt-generator | 即梦提示词 | 2 | 2 | **部分** | 火山 Seedance 模板 | L1 | LLM | 低 | 不装 |
| 42 | agentkit-multimedia-shopping | 带货视频 | 2 | 1 | 否 | 流程模板 | L2 | 多 Key | 杂 | 不装 |
| 43 | paper-analysis-assistant | 论文 | 4 | 3 | **部分** | edu-sci-* / anth-pdf / open-notebook | L2 | LLM+arXiv | 科研包已厚 | 不装 |
| 44 | contract-review | 合同 | 3 | 4 | **部分** | `legal-lav-contract-review-*`+`legal-risk-assessment` | L1 | LLM | 法务 Pill 已有 | **不装** |
| 45 | law-to-markdown | 法律 MD | 2 | 2 | **部分** | 文档导入 | L1 | 无 | 低 | 不装 |
| 46 | legal-assistant-skills-main | 法律包 | — | 3 | **部分** | legal-lav-* 整包 | L1 | LLM | 已 vendor | 不装 |
| 47 | stock-analysis | 个股分析 | 3 | 3 | 否 | 无专用 skill | L2 | 免费行情脚本 | 非核心 | 可选 L2 |
| 48 | agent-team | 多 Agent | 3 | 2 | 否 | PilotDeck 原生 AgentLoop | L1 | LLM | 架构重复 | 不装 |
| 49 | multi-agent-meeting | 会议 | 2 | 1 | 否 | 无 | L1 | LLM | 低 | 不装 |
| 50 | product-manager-toolkit | PM | 3 | 4 | **部分** | `pms-*` 整包（pm-skills vendor） | L1 | LLM | 已覆盖 | **已装** |
| 51 | frontend-design | 前端设计 | 3 | 4 | **是** | `df-frontend-design`+`create-frontend-design` | L1 | LLM | 已有 | **已装** |
| 52 | web-design-analyzer | 网站分析 | 3 | 3 | **部分** | `fetch_page_images`/Open Design | L2 | 无 | 已有 | 不装 |
| 53 | web-to-app | Web→App | 2 | 2 | **误匹配** | anbeime 指壳应用；Nova 仅有 ASO funnel 同名片段 | L3 | 移动构建链 | 概念不同 | 不装 |
| 54 | chrome-automation | Chrome CDP | — | 3 | **部分** | `mcp-playwright`+Firecrawl interact | L2 | 本地 Chrome | **SaaS 云端不可用** | 本地可选 |
| 55 | obsidian-skills-integrated | Obsidian | — | 3 | **是** | `obsidian` skill | L2 | Obsidian CLI | 已有 | **已装** |
| 56 | pdf-processing-pro | PDF | — | 3 | **是** | `anth-pdf`+文档导入 | L1 | 无 | 已有 | **已装** |
| 57 | icon-generator | 图标 | — | 2 | **部分** | `generate_image`/Open Design | L2 | 生图 | 低 | 不装 |
| 58 | data-storytelling | 数据叙事 | — | 3 | **部分** | mkt-campaign-report/BI 模板 | L1 | LLM | 低 | 不装 |
| 59 | media-processor | 媒体处理 | — | 3 | **部分** | ffmpeg 内置工具 | L2 | ffmpeg | 低 | 不装 |
| 60 | tailored-resume-generator | 简历 | — | 2 | 否 | 办公文档类 | L1 | LLM | niche | 不装 |
| 61 | bedtime-story | 儿童故事 | — | 1 | 否 | Hermes 趣味 | L1 | LLM | 低 | 不装 |
| 62 | poetry-music-visual | 诗乐视觉 | 2 | 1 | 否 | 无 | L1 | LLM | 太垂直 | 不装 |
| 63 | pop-up-book-illustration | 立体书 | 2 | 1 | 否 | 无 | L2 | 生图 | niche | 不装 |
| 64 | moltbook | 未知 | — | 1 | 否 | — | ? | ? | 来源不明 | **不装** |
| 65 | finance-mcp（元数据） | 财务 MCP | 5 | 4 | 否 | 需 `mcp.json` 接 finance-mcp npm | **L2** | **TUSHARE_TOKEN** | 与 stock-analysis 重叠 | **可选 MCP** |

> 注：`content-creation-publisher` 目录内还嵌套 baoyu-* / article-illustrator 子 Skill，上表已按子技能单独列出，避免重复计数。

---

## 二、官方爬取索引（182 条）— 汇总而非逐条

| 来源团队 | 条数 | Nova 已覆盖（粗估） | 说明 |
|----------|------|---------------------|------|
| Anthropic 文档/设计 | 5+ | **anth-*** 已 vendor | docx/pptx/xlsx/pdf 等 |
| Vercel 前端 | 8 | **部分** dev-react/next（第四期未装） | 与 dev-ecosystem 规划重叠 |
| Cloudflare | 8 | 未系统 vendor | 需 L2 |
| Trail of Bits 安全 | 22 | **明确不装**（AGENTS 决策） | 安全审计 niche |
| Hugging Face | 8 | edu-sci/transformers 部分 | 科研包已厚 |
| Sentry / Better Auth / Stripe / Expo | 各 2–7 | **部分** dev-sentry 等 | 按需 cherry-pick |
| Marketing / n8n / Productivity | 30+ | **mkt-*** / 办公包大部分已有 | 勿从 anbeime 二次引入 |
| 其他 | 余 | 低 | 优先走 Nova `vendor:skills-ecosystem` 直采上游 |

**结论**：182 条是**商店索引**，Nova 已通过 `vendor:skills-ecosystem`（742 项）等**更完整直采**；**不建议**从 anbeime 整包镜像，只需按需补 **本地 56 包中未覆盖且高★项**。

---

## 三、推荐安装优先级（若你后续要装）

| 优先级 | Skill | 理由 |
|--------|-------|------|
| P1 可选 | viral-video-copywriting | 飞轮创意短文案，L1，无新 Key |
| P1 可选 | qwen3-tts-local | 本地 TTS 降级，L2，无云 Key |
| P2 可选 | stock-analysis | 办公/金融 niche，L2，脚本+免费源 |
| P2 MCP | finance-mcp | Tushare MCP，L2，需 TUSHARE_TOKEN |
| **不建议** | infinitetalk / chrome-automation / 微信发布类 | GPU/Chrome/Cookie，SaaS 难运维 |
| **已覆盖** | ppt 系、anth 文档、frontend-design、nanobanana、legal、obsidian | 勿重复 vendor |

---

## 四、与 Nova 原则对照

| 原则 | anbeime 商店符合度 |
|------|-------------------|
| L1 read_skill 即用 | 约 40% 本地包符合 |
| L2 需 Key/环境 | 微信/视频/财务/Chrome 多数 |
| L3 服务化 | infinitetalk、finance-mcp、chrome-automation |
| 能力中心 taxonomy | 需逐条 `capabilityHubTaxonomy` + overrides |
| 不与 yixiaoer/矩阵重复 | 微信/小红书类 **不建议** |
| SaaS 云端 | Chrome CDP、大模型本地下载 **不适合** 默认租户 |

---

*生成：`scripts/audit-anbeime-skills.mjs` + 人工评测；原始交叉引用：`artifacts/capabilities-smoke/anbeime-skill-audit.json`*
