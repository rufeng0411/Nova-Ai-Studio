# Open Design 设计能力目录（静态帮助）

> **维护说明（必守）**
> - 本文档随 PilotDeck 接入 Open Design 的变更而更新。
> - 新增/调整 `skills/od-*` 或设计系统后：运行 `node scripts/sync-open-design-systems.mjs`，再运行 `node scripts/generate-open-design-catalog.mjs`。
> - 用户面向复制例句也可同步改 `docs/open-design-prompt-examples.md`。
> - 记录在 `AGENTS.md` 与 `docs/open-design-admin-guide.md`。

**文档版本日期：** 2026-06-01
**设计系统数量：** 150 套
**表面技能数量：** 27 个 od-* + frontend-slides

---

## 一、当前可设计的类别

在 PilotDeck 对话中用下表「提问示例」即可；不必记内部文件名。

### 网站与产品

| 可设计内容 | 对应文件 | 提问示例 | 说明 |
|------------|----------|----------|------|
| 产品官网 / 落地页 | `skills/od-saas-landing/SKILL.md` | 帮我做一个【产品名】的介绍网页，要有醒目标题、三个核心功能、价格或试用按钮、页脚联系方式。风格简洁专业，直接开始做。 | 企业或产品介绍单页 |
| 定价与套餐 | `skills/od-pricing-page/SKILL.md` | 帮我做【产品】定价页，三个套餐并对比能做什么，企业档写「联系销售」，直接开始做。 | 多档价格对比 |
| 升级会员 / 付费 | `skills/od-pricing-upgrade/SKILL.md` | 帮我做【App】升级会员页，说清楚免费和付费差在哪，一个主按钮「立即升级」，直接开始做。 | 转化向付费页 |
| 后台 / 数据看板 | `skills/od-dashboard/SKILL.md` | 帮我做【业务】后台首页，左边菜单、关键数字、下面趋势图（示例数据即可），直接开始做。 | 管理端首页 |
| 数据汇报 | `skills/od-data-report/SKILL.md` | 帮我做【季度】数据汇报页，先四条结论、两个图表、三条建议，直接开始做。 | 分析摘要页 |
| 帮助中心 | `skills/od-faq-page/SKILL.md` | 帮我做【产品】帮助中心，能搜索、分三类常见问题，直接开始做。 | FAQ 折叠页 |
| 线框结构草图 | `skills/od-wireframe-sketch/SKILL.md` | 先用灰框搭【官网】结构：首页、关于、产品、联系，先不要精美配色，直接开始做。 | 先确认结构再美化 |
| 页面精修 | `skills/od-web-artifacts-builder/SKILL.md` | 我有一份初稿页面，请统一间距、按钮和配色，做成能交给客户看的成品，直接开始做。 | 在已有稿上打磨 |

### 手机端

| 可设计内容 | 对应文件 | 提问示例 | 说明 |
|------------|----------|----------|------|
| 手机 App 界面 | `skills/od-mobile-app/SKILL.md` | 帮我画【App】三屏界面并排，像真手机一样，直接开始做。 | 可配合设备外框 |
| 新用户引导 | `skills/od-mobile-onboarding/SKILL.md` | 帮我做【App】新人引导三屏：欢迎、好处、注册或开始，直接开始做。 | 首次打开流程 |
| 登录 / 注册 | `skills/od-login-flow/SKILL.md` | 帮我设计登录、注册和收验证码三个页面，风格干净，直接开始做。 | 账号流程 |

### 营销与内容

| 可设计内容 | 对应文件 | 提问示例 | 说明 |
|------------|----------|----------|------|
| 营销邮件版面 | `skills/od-email-marketing/SKILL.md` | 帮我做【活动】邮件版面，有标题、主图位、说明和购买按钮，直接开始做。 | 邮件客户端友好 |
| 社媒多图轮播 | `skills/od-social-carousel/SKILL.md` | 帮我做【主题】5 张可左右滑动的配图，每张一个要点，直接开始做。 | 小红书风系列图 |
| 社媒矩阵（一创意全平台） | `skills/social-creative-matrix/SKILL.md` | 我有一条【活动】创意，帮我按抖音小红书微博等国内平台各写文案，并生成竖版方图横版笔记四种配图，先不要发布，直接开始做。 | 文案矩阵+四套比例图；发布走蚁小二 |
| 竖版海报 | `skills/od-poster-hero/SKILL.md` | 帮我做【活动】竖版海报，时间地点和三条亮点，底部留二维码位，直接开始做。 | 分享长图版式 |
| 杂志风长文 | `skills/od-article-magazine/SKILL.md` | 帮我把下面提纲做成阅读页：【粘贴内容】。杂志排版，直接开始做。 | 博客 / 专题 |

### 演示与脚本页

| 可设计内容 | 对应文件 | 提问示例 | 说明 |
|------------|----------|----------|------|
| 杂志风汇报幻灯片 | `skills/od-deck-magazine/SKILL.md` | 帮我做【10 页】汇报，杂志风、横着翻页、每页一屏，直接开始做。 | HTML 横滑演示 |
| 简洁风幻灯片 | `skills/frontend-slides/SKILL.md` | 帮我做【8 页】产品介绍，简洁商务风，横屏翻页，每页一屏，直接开始做。 | PilotDeck 自带演示技能 |
| 年度回顾脚本页 | `skills/od-weread-year-in-review-video/SKILL.md` | 帮我做【年度回顾】叙事页，分章节旁白和画面说明，直接开始做。 | 网页分镜，非 mp4 |
| 用户研究脚本页 | `skills/od-swiss-user-research-video/SKILL.md` | 帮我做【研究主题】视频分镜页，每镜旁白+画面，直接开始做。 | 网页分镜，非 mp4 |
| 复古像素故事板 | `skills/od-8bit-orbit-video/SKILL.md` | 帮我做【主题】8 位机风格故事板页面，直接开始做。 | 网页分镜，非 mp4 |

### 品牌与编辑风

| 可设计内容 | 对应文件 | 提问示例 | 说明 |
|------------|----------|----------|------|
| 品牌故事长页 | `skills/od-after-hours-editorial/SKILL.md` | 帮我做【品牌】故事长页，像深夜杂志专栏，直接开始做。 | 叙事型 |
| 调研观察笔记 | `skills/od-field-notes-editorial/SKILL.md` | 帮我把【访谈】整理成观察笔记风页面，有时间线和引用，直接开始做。 | 研究记录 |
| 原则宣言页 | `skills/od-editorial-burgundy/SKILL.md` | 帮我做【团队】五条原则单页，酒红编辑风，直接开始做。 | 宣言式 |
| 金融可信风 | `skills/od-digits-fintech/SKILL.md` | 帮我做【理财工具】介绍页，冷静网格、强调数据可信，直接开始做。 | 金融科技气质 |
| 研究决策看板 | `skills/od-research-decision-room/SKILL.md` | 帮我把【结论】做成决策看板：证据、建议、优先级，直接开始做。 | 研究落地 |
| 作品集 | `skills/od-swiss-creative/SKILL.md` | 帮我做【设计师】作品集，网格展示项目，直接开始做。 | 创意展示 |

### 办公与个人

| 可设计内容 | 对应文件 | 提问示例 | 说明 |
|------------|----------|----------|------|
| 版本发布说明 | `skills/od-release-notes-one-pager/SKILL.md` | 帮我做【版本号】更新说明一页：新功能、修复、升级注意，直接开始做。 | 发给用户的更新页 |
| 求职简历 | `skills/od-resume/SKILL.md` | 根据我提供的信息做一页简历网页：【粘贴经历】，直接开始做。 | 仅使用真实信息 |

### 总控与规范（自动参与）

| 可设计内容 | 对应文件 | 提问示例 | 说明 |
|------------|----------|----------|------|
| 设计总控 | `skills/open-design/SKILL.md` | （无需单独说）描述目标即可；系统会先澄清风格与结构。 | 路由到具体类别 |
| 五种视觉方向 | `skills/open-design/references/directions.md` | 风格想要【简洁现代 / 杂志编辑 / 温暖亲切 / 数据工具 / 实验粗犷】之一。 | 无品牌时的默认选项 |
| 设备外框 | `skills/open-design/assets/frames/` | 请把手机界面放在 iPhone 外框里展示 / 多屏并排。 | iphone-15-pro、android-pixel 等 |

---

## 二、视觉方向（5 选 1）

| 方向 | 文件 | 提问时可说 |
|------|------|------------|
| 现代极简 | `skills/open-design/references/directions.md` | 简洁、冷静、像科技公司官网 |
| 杂志编辑 | `同上` | 像杂志专栏、叙事感、排版讲究 |
| 温暖亲切 | `同上` | 柔和、适合消费级或教育产品 |
| 数据工具 | `同上` | 信息密度高、偏后台与数据产品 |
| 实验粗犷 | `同上` | 大胆、活动或独立品牌感 |

---

## 三、设计系统（完整版）

生成页面时可指定品牌气质；Agent 会读取 `skills/open-design/references/design-systems/<slug>.md`。

| 分类 | 标识（slug） | 文件 | 提问时可说 |
|------|-------------|------|------------|
| AI & LLM | claude | `skills/open-design/references/design-systems/claude.md` | 风格请参考【Claude (Anthropic)】那种感觉（设计系统：claude），直接开始做。 |
| AI & LLM | cohere | `skills/open-design/references/design-systems/cohere.md` | 风格请参考【Cohere】那种感觉（设计系统：cohere），直接开始做。 |
| AI & LLM | elevenlabs | `skills/open-design/references/design-systems/elevenlabs.md` | 风格请参考【ElevenLabs】那种感觉（设计系统：elevenlabs），直接开始做。 |
| AI & LLM | huggingface | `skills/open-design/references/design-systems/huggingface.md` | 风格请参考【Hugging Face】那种感觉（设计系统：huggingface），直接开始做。 |
| AI & LLM | minimax | `skills/open-design/references/design-systems/minimax.md` | 风格请参考【MiniMax】那种感觉（设计系统：minimax），直接开始做。 |
| AI & LLM | mistral-ai | `skills/open-design/references/design-systems/mistral-ai.md` | 风格请参考【Mistral AI】那种感觉（设计系统：mistral-ai），直接开始做。 |
| AI & LLM | ollama | `skills/open-design/references/design-systems/ollama.md` | 风格请参考【Ollama】那种感觉（设计系统：ollama），直接开始做。 |
| AI & LLM | openai | `skills/open-design/references/design-systems/openai.md` | 风格请参考【OpenAI】那种感觉（设计系统：openai），直接开始做。 |
| AI & LLM | opencode-ai | `skills/open-design/references/design-systems/opencode-ai.md` | 风格请参考【OpenCode】那种感觉（设计系统：opencode-ai），直接开始做。 |
| AI & LLM | perplexity | `skills/open-design/references/design-systems/perplexity.md` | 风格请参考【Perplexity AI】那种感觉（设计系统：perplexity），直接开始做。 |
| AI & LLM | replicate | `skills/open-design/references/design-systems/replicate.md` | 风格请参考【Replicate】那种感觉（设计系统：replicate），直接开始做。 |
| AI & LLM | runwayml | `skills/open-design/references/design-systems/runwayml.md` | 风格请参考【Runway】那种感觉（设计系统：runwayml），直接开始做。 |
| AI & LLM | together-ai | `skills/open-design/references/design-systems/together-ai.md` | 风格请参考【Together AI】那种感觉（设计系统：together-ai），直接开始做。 |
| AI & LLM | voltagent | `skills/open-design/references/design-systems/voltagent.md` | 风格请参考【VoltAgent】那种感觉（设计系统：voltagent），直接开始做。 |
| AI & LLM | x-ai | `skills/open-design/references/design-systems/x-ai.md` | 风格请参考【xAI】那种感觉（设计系统：x-ai），直接开始做。 |
| Automotive | bmw | `skills/open-design/references/design-systems/bmw.md` | 风格请参考【BMW】那种感觉（设计系统：bmw），直接开始做。 |
| Automotive | bmw-m | `skills/open-design/references/design-systems/bmw-m.md` | 风格请参考【BMW M】那种感觉（设计系统：bmw-m），直接开始做。 |
| Automotive | bugatti | `skills/open-design/references/design-systems/bugatti.md` | 风格请参考【Bugatti】那种感觉（设计系统：bugatti），直接开始做。 |
| Automotive | ferrari | `skills/open-design/references/design-systems/ferrari.md` | 风格请参考【Ferrari】那种感觉（设计系统：ferrari），直接开始做。 |
| Automotive | lamborghini | `skills/open-design/references/design-systems/lamborghini.md` | 风格请参考【Lamborghini】那种感觉（设计系统：lamborghini），直接开始做。 |
| Automotive | renault | `skills/open-design/references/design-systems/renault.md` | 风格请参考【Renault】那种感觉（设计系统：renault），直接开始做。 |
| Automotive | tesla | `skills/open-design/references/design-systems/tesla.md` | 风格请参考【Tesla】那种感觉（设计系统：tesla），直接开始做。 |
| Backend & Data | cisco | `skills/open-design/references/design-systems/cisco.md` | 风格请参考【Cisco】那种感觉（设计系统：cisco），直接开始做。 |
| Backend & Data | clickhouse | `skills/open-design/references/design-systems/clickhouse.md` | 风格请参考【ClickHouse】那种感觉（设计系统：clickhouse），直接开始做。 |
| Backend & Data | composio | `skills/open-design/references/design-systems/composio.md` | 风格请参考【Composio】那种感觉（设计系统：composio），直接开始做。 |
| Backend & Data | hashicorp | `skills/open-design/references/design-systems/hashicorp.md` | 风格请参考【HashiCorp】那种感觉（设计系统：hashicorp），直接开始做。 |
| Backend & Data | mongodb | `skills/open-design/references/design-systems/mongodb.md` | 风格请参考【MongoDB】那种感觉（设计系统：mongodb），直接开始做。 |
| Backend & Data | posthog | `skills/open-design/references/design-systems/posthog.md` | 风格请参考【PostHog】那种感觉（设计系统：posthog），直接开始做。 |
| Backend & Data | sanity | `skills/open-design/references/design-systems/sanity.md` | 风格请参考【Sanity】那种感觉（设计系统：sanity），直接开始做。 |
| Backend & Data | sentry | `skills/open-design/references/design-systems/sentry.md` | 风格请参考【Sentry】那种感觉（设计系统：sentry），直接开始做。 |
| Backend & Data | supabase | `skills/open-design/references/design-systems/supabase.md` | 风格请参考【Supabase】那种感觉（设计系统：supabase），直接开始做。 |
| Bold & Expressive | bold | `skills/open-design/references/design-systems/bold.md` | 风格请参考【Bold】那种感觉（设计系统：bold），直接开始做。 |
| Bold & Expressive | brutalism | `skills/open-design/references/design-systems/brutalism.md` | 风格请参考【Brutalism】那种感觉（设计系统：brutalism），直接开始做。 |
| Bold & Expressive | colorful | `skills/open-design/references/design-systems/colorful.md` | 风格请参考【Colorful】那种感觉（设计系统：colorful），直接开始做。 |
| Bold & Expressive | dramatic | `skills/open-design/references/design-systems/dramatic.md` | 风格请参考【Dramatic】那种感觉（设计系统：dramatic），直接开始做。 |
| Bold & Expressive | energetic | `skills/open-design/references/design-systems/energetic.md` | 风格请参考【Energetic】那种感觉（设计系统：energetic），直接开始做。 |
| Bold & Expressive | expressive | `skills/open-design/references/design-systems/expressive.md` | 风格请参考【Expressive】那种感觉（设计系统：expressive），直接开始做。 |
| Bold & Expressive | neobrutalism | `skills/open-design/references/design-systems/neobrutalism.md` | 风格请参考【Neobrutalism】那种感觉（设计系统：neobrutalism），直接开始做。 |
| Bold & Expressive | vibrant | `skills/open-design/references/design-systems/vibrant.md` | 风格请参考【Vibrant】那种感觉（设计系统：vibrant），直接开始做。 |
| Creative & Artistic | artistic | `skills/open-design/references/design-systems/artistic.md` | 风格请参考【Artistic】那种感觉（设计系统：artistic），直接开始做。 |
| Creative & Artistic | cafe | `skills/open-design/references/design-systems/cafe.md` | 风格请参考【Cafe】那种感觉（设计系统：cafe），直接开始做。 |
| Creative & Artistic | cosmic | `skills/open-design/references/design-systems/cosmic.md` | 风格请参考【Cosmic】那种感觉（设计系统：cosmic），直接开始做。 |
| Creative & Artistic | creative | `skills/open-design/references/design-systems/creative.md` | 风格请参考【Creative】那种感觉（设计系统：creative），直接开始做。 |
| Creative & Artistic | doodle | `skills/open-design/references/design-systems/doodle.md` | 风格请参考【Doodle】那种感觉（设计系统：doodle），直接开始做。 |
| Creative & Artistic | editorial | `skills/open-design/references/design-systems/editorial.md` | 风格请参考【Editorial】那种感觉（设计系统：editorial），直接开始做。 |
| Creative & Artistic | fantasy | `skills/open-design/references/design-systems/fantasy.md` | 风格请参考【Fantasy】那种感觉（设计系统：fantasy），直接开始做。 |
| Creative & Artistic | friendly | `skills/open-design/references/design-systems/friendly.md` | 风格请参考【Friendly】那种感觉（设计系统：friendly），直接开始做。 |
| Creative & Artistic | lingo | `skills/open-design/references/design-systems/lingo.md` | 风格请参考【Lingo】那种感觉（设计系统：lingo），直接开始做。 |
| Creative & Artistic | publication | `skills/open-design/references/design-systems/publication.md` | 风格请参考【Publication】那种感觉（设计系统：publication），直接开始做。 |
| Creative & Artistic | storytelling | `skills/open-design/references/design-systems/storytelling.md` | 风格请参考【Storytelling】那种感觉（设计系统：storytelling），直接开始做。 |
| Design & Creative | airtable | `skills/open-design/references/design-systems/airtable.md` | 风格请参考【Airtable】那种感觉（设计系统：airtable），直接开始做。 |
| Design & Creative | canva | `skills/open-design/references/design-systems/canva.md` | 风格请参考【Canva】那种感觉（设计系统：canva），直接开始做。 |
| Design & Creative | clay | `skills/open-design/references/design-systems/clay.md` | 风格请参考【Clay】那种感觉（设计系统：clay），直接开始做。 |
| Design & Creative | figma | `skills/open-design/references/design-systems/figma.md` | 风格请参考【Figma】那种感觉（设计系统：figma），直接开始做。 |
| Design & Creative | framer | `skills/open-design/references/design-systems/framer.md` | 风格请参考【Framer】那种感觉（设计系统：framer），直接开始做。 |
| Design & Creative | miro | `skills/open-design/references/design-systems/miro.md` | 风格请参考【Miro】那种感觉（设计系统：miro），直接开始做。 |
| Design & Creative | webflow | `skills/open-design/references/design-systems/webflow.md` | 风格请参考【Webflow】那种感觉（设计系统：webflow），直接开始做。 |
| Developer Tools | cursor | `skills/open-design/references/design-systems/cursor.md` | 风格请参考【Cursor】那种感觉（设计系统：cursor），直接开始做。 |
| Developer Tools | expo | `skills/open-design/references/design-systems/expo.md` | 风格请参考【Expo】那种感觉（设计系统：expo），直接开始做。 |
| Developer Tools | github | `skills/open-design/references/design-systems/github.md` | 风格请参考【GitHub】那种感觉（设计系统：github），直接开始做。 |
| Developer Tools | lovable | `skills/open-design/references/design-systems/lovable.md` | 风格请参考【Lovable】那种感觉（设计系统：lovable），直接开始做。 |
| Developer Tools | mission-control | `skills/open-design/references/design-systems/mission-control.md` | 风格请参考【Mission Control Design System】那种感觉（设计系统：mission-control），直接开始做。 |
| Developer Tools | raycast | `skills/open-design/references/design-systems/raycast.md` | 风格请参考【Raycast】那种感觉（设计系统：raycast），直接开始做。 |
| Developer Tools | superhuman | `skills/open-design/references/design-systems/superhuman.md` | 风格请参考【Superhuman】那种感觉（设计系统：superhuman），直接开始做。 |
| Developer Tools | vercel | `skills/open-design/references/design-systems/vercel.md` | 风格请参考【Vercel】那种感觉（设计系统：vercel），直接开始做。 |
| Developer Tools | warp | `skills/open-design/references/design-systems/warp.md` | 风格请参考【Warp】那种感觉（设计系统：warp），直接开始做。 |
| E-Commerce & Retail | airbnb | `skills/open-design/references/design-systems/airbnb.md` | 风格请参考【Airbnb】那种感觉（设计系统：airbnb），直接开始做。 |
| E-Commerce & Retail | meta | `skills/open-design/references/design-systems/meta.md` | 风格请参考【Meta (Store)】那种感觉（设计系统：meta），直接开始做。 |
| E-Commerce & Retail | nike | `skills/open-design/references/design-systems/nike.md` | 风格请参考【Nike】那种感觉（设计系统：nike），直接开始做。 |
| E-Commerce & Retail | shopify | `skills/open-design/references/design-systems/shopify.md` | 风格请参考【Shopify】那种感觉（设计系统：shopify），直接开始做。 |
| E-Commerce & Retail | starbucks | `skills/open-design/references/design-systems/starbucks.md` | 风格请参考【Starbucks】那种感觉（设计系统：starbucks），直接开始做。 |
| Editorial & Print | kami | `skills/open-design/references/design-systems/kami.md` | 风格请参考【kami (紙 / 纸)】那种感觉（设计系统：kami），直接开始做。 |
| Editorial / Personal / Publication | urdu | `skills/open-design/references/design-systems/urdu.md` | 风格请参考【Urdu Modern (Indus Script System)】那种感觉（设计系统：urdu），直接开始做。 |
| Editorial · Studio | atelier-zero | `skills/open-design/references/design-systems/atelier-zero.md` | 风格请参考【Atelier Zero】那种感觉（设计系统：atelier-zero），直接开始做。 |
| Fintech & Crypto | binance | `skills/open-design/references/design-systems/binance.md` | 风格请参考【Binance.US】那种感觉（设计系统：binance），直接开始做。 |
| Fintech & Crypto | coinbase | `skills/open-design/references/design-systems/coinbase.md` | 风格请参考【Coinbase】那种感觉（设计系统：coinbase），直接开始做。 |
| Fintech & Crypto | kraken | `skills/open-design/references/design-systems/kraken.md` | 风格请参考【Kraken】那种感觉（设计系统：kraken），直接开始做。 |
| Fintech & Crypto | mastercard | `skills/open-design/references/design-systems/mastercard.md` | 风格请参考【Mastercard】那种感觉（设计系统：mastercard），直接开始做。 |
| Fintech & Crypto | revolut | `skills/open-design/references/design-systems/revolut.md` | 风格请参考【Revolut】那种感觉（设计系统：revolut），直接开始做。 |
| Fintech & Crypto | stripe | `skills/open-design/references/design-systems/stripe.md` | 风格请参考【Stripe】那种感觉（设计系统：stripe），直接开始做。 |
| Fintech & Crypto | wise | `skills/open-design/references/design-systems/wise.md` | 风格请参考【Wise】那种感觉（设计系统：wise），直接开始做。 |
| Layout & Structure | bento | `skills/open-design/references/design-systems/bento.md` | 风格请参考【Bento】那种感觉（设计系统：bento），直接开始做。 |
| Layout & Structure | levels | `skills/open-design/references/design-systems/levels.md` | 风格请参考【Levels】那种感觉（设计系统：levels），直接开始做。 |
| Layout & Structure | perspective | `skills/open-design/references/design-systems/perspective.md` | 风格请参考【Perspective】那种感觉（设计系统：perspective），直接开始做。 |
| Layout & Structure | spacious | `skills/open-design/references/design-systems/spacious.md` | 风格请参考【Spacious】那种感觉（设计系统：spacious），直接开始做。 |
| Media & Consumer | apple | `skills/open-design/references/design-systems/apple.md` | 风格请参考【Apple】那种感觉（设计系统：apple），直接开始做。 |
| Media & Consumer | ibm | `skills/open-design/references/design-systems/ibm.md` | 风格请参考【IBM】那种感觉（设计系统：ibm），直接开始做。 |
| Media & Consumer | nvidia | `skills/open-design/references/design-systems/nvidia.md` | 风格请参考【NVIDIA】那种感觉（设计系统：nvidia），直接开始做。 |
| Media & Consumer | pinterest | `skills/open-design/references/design-systems/pinterest.md` | 风格请参考【Pinterest】那种感觉（设计系统：pinterest），直接开始做。 |
| Media & Consumer | playstation | `skills/open-design/references/design-systems/playstation.md` | 风格请参考【PlayStation】那种感觉（设计系统：playstation），直接开始做。 |
| Media & Consumer | spacex | `skills/open-design/references/design-systems/spacex.md` | 风格请参考【SpaceX】那种感觉（设计系统：spacex），直接开始做。 |
| Media & Consumer | spotify | `skills/open-design/references/design-systems/spotify.md` | 风格请参考【Spotify】那种感觉（设计系统：spotify），直接开始做。 |
| Media & Consumer | theverge | `skills/open-design/references/design-systems/theverge.md` | 风格请参考【The Verge】那种感觉（设计系统：theverge），直接开始做。 |
| Media & Consumer | uber | `skills/open-design/references/design-systems/uber.md` | 风格请参考【Uber】那种感觉（设计系统：uber），直接开始做。 |
| Media & Consumer | vodafone | `skills/open-design/references/design-systems/vodafone.md` | 风格请参考【Vodafone】那种感觉（设计系统：vodafone），直接开始做。 |
| Media & Consumer | wired | `skills/open-design/references/design-systems/wired.md` | 风格请参考【WIRED】那种感觉（设计系统：wired），直接开始做。 |
| Media & Consumer | xiaohongshu | `skills/open-design/references/design-systems/xiaohongshu.md` | 风格请参考【Xiaohongshu】那种感觉（设计系统：xiaohongshu），直接开始做。 |
| Modern & Minimal | clean | `skills/open-design/references/design-systems/clean.md` | 风格请参考【Clean】那种感觉（设计系统：clean），直接开始做。 |
| Modern & Minimal | contemporary | `skills/open-design/references/design-systems/contemporary.md` | 风格请参考【Contemporary】那种感觉（设计系统：contemporary），直接开始做。 |
| Modern & Minimal | flat | `skills/open-design/references/design-systems/flat.md` | 风格请参考【Flat】那种感觉（设计系统：flat），直接开始做。 |
| Modern & Minimal | minimal | `skills/open-design/references/design-systems/minimal.md` | 风格请参考【Minimal】那种感觉（设计系统：minimal），直接开始做。 |
| Modern & Minimal | modern | `skills/open-design/references/design-systems/modern.md` | 风格请参考【Modern】那种感觉（设计系统：modern），直接开始做。 |
| Modern & Minimal | mono | `skills/open-design/references/design-systems/mono.md` | 风格请参考【Mono】那种感觉（设计系统：mono），直接开始做。 |
| Modern & Minimal | refined | `skills/open-design/references/design-systems/refined.md` | 风格请参考【Refined】那种感觉（设计系统：refined），直接开始做。 |
| Modern & Minimal | shadcn | `skills/open-design/references/design-systems/shadcn.md` | 风格请参考【Shadcn】那种感觉（设计系统：shadcn），直接开始做。 |
| Modern & Minimal | simple | `skills/open-design/references/design-systems/simple.md` | 风格请参考【Simple】那种感觉（设计系统：simple），直接开始做。 |
| Modern & Minimal | sleek | `skills/open-design/references/design-systems/sleek.md` | 风格请参考【Sleek】那种感觉（设计系统：sleek），直接开始做。 |
| Morphism & Effects | claymorphism | `skills/open-design/references/design-systems/claymorphism.md` | 风格请参考【Claymorphism】那种感觉（设计系统：claymorphism），直接开始做。 |
| Morphism & Effects | glassmorphism | `skills/open-design/references/design-systems/glassmorphism.md` | 风格请参考【Glassmorphism】那种感觉（设计系统：glassmorphism），直接开始做。 |
| Morphism & Effects | gradient | `skills/open-design/references/design-systems/gradient.md` | 风格请参考【Gradient】那种感觉（设计系统：gradient），直接开始做。 |
| Morphism & Effects | neon | `skills/open-design/references/design-systems/neon.md` | 风格请参考【Neon】那种感觉（设计系统：neon），直接开始做。 |
| Morphism & Effects | neumorphism | `skills/open-design/references/design-systems/neumorphism.md` | 风格请参考【Neumorphism】那种感觉（设计系统：neumorphism），直接开始做。 |
| Morphism & Effects | skeumorphism | `skills/open-design/references/design-systems/skeumorphism.md` | 风格请参考【Skeumorphism】那种感觉（设计系统：skeumorphism），直接开始做。 |
| Productivity & SaaS | arc | `skills/open-design/references/design-systems/arc.md` | 风格请参考【Arc Browser】那种感觉（设计系统：arc），直接开始做。 |
| Productivity & SaaS | cal | `skills/open-design/references/design-systems/cal.md` | 风格请参考【Cal.com】那种感觉（设计系统：cal），直接开始做。 |
| Productivity & SaaS | discord | `skills/open-design/references/design-systems/discord.md` | 风格请参考【Discord】那种感觉（设计系统：discord），直接开始做。 |
| Productivity & SaaS | duolingo | `skills/open-design/references/design-systems/duolingo.md` | 风格请参考【Duolingo】那种感觉（设计系统：duolingo），直接开始做。 |
| Productivity & SaaS | intercom | `skills/open-design/references/design-systems/intercom.md` | 风格请参考【Intercom】那种感觉（设计系统：intercom），直接开始做。 |
| Productivity & SaaS | linear-app | `skills/open-design/references/design-systems/linear-app.md` | 风格请参考【Linear】那种感觉（设计系统：linear-app），直接开始做。 |
| Productivity & SaaS | mintlify | `skills/open-design/references/design-systems/mintlify.md` | 风格请参考【Mintlify】那种感觉（设计系统：mintlify），直接开始做。 |
| Productivity & SaaS | notion | `skills/open-design/references/design-systems/notion.md` | 风格请参考【Notion】那种感觉（设计系统：notion），直接开始做。 |
| Productivity & SaaS | resend | `skills/open-design/references/design-systems/resend.md` | 风格请参考【Resend】那种感觉（设计系统：resend），直接开始做。 |
| Productivity & SaaS | slack | `skills/open-design/references/design-systems/slack.md` | 风格请参考【Slack】那种感觉（设计系统：slack），直接开始做。 |
| Productivity & SaaS | webex | `skills/open-design/references/design-systems/webex.md` | 风格请参考【Webex】那种感觉（设计系统：webex），直接开始做。 |
| Productivity & SaaS | zapier | `skills/open-design/references/design-systems/zapier.md` | 风格请参考【Zapier】那种感觉（设计系统：zapier），直接开始做。 |
| Professional & Corporate | ant | `skills/open-design/references/design-systems/ant.md` | 风格请参考【Ant】那种感觉（设计系统：ant），直接开始做。 |
| Professional & Corporate | application | `skills/open-design/references/design-systems/application.md` | 风格请参考【Application】那种感觉（设计系统：application），直接开始做。 |
| Professional & Corporate | corporate | `skills/open-design/references/design-systems/corporate.md` | 风格请参考【Corporate】那种感觉（设计系统：corporate），直接开始做。 |
| Professional & Corporate | dashboard | `skills/open-design/references/design-systems/dashboard.md` | 风格请参考【Dashboard】那种感觉（设计系统：dashboard），直接开始做。 |
| Professional & Corporate | elegant | `skills/open-design/references/design-systems/elegant.md` | 风格请参考【Elegant】那种感觉（设计系统：elegant），直接开始做。 |
| Professional & Corporate | enterprise | `skills/open-design/references/design-systems/enterprise.md` | 风格请参考【Enterprise】那种感觉（设计系统：enterprise），直接开始做。 |
| Professional & Corporate | luxury | `skills/open-design/references/design-systems/luxury.md` | 风格请参考【Luxury】那种感觉（设计系统：luxury），直接开始做。 |
| Professional & Corporate | material | `skills/open-design/references/design-systems/material.md` | 风格请参考【Material】那种感觉（设计系统：material），直接开始做。 |
| Professional & Corporate | premium | `skills/open-design/references/design-systems/premium.md` | 风格请参考【Premium】那种感觉（设计系统：premium），直接开始做。 |
| Professional & Corporate | professional | `skills/open-design/references/design-systems/professional.md` | 风格请参考【Professional】那种感觉（设计系统：professional），直接开始做。 |
| Retro & Nostalgic | dithered | `skills/open-design/references/design-systems/dithered.md` | 风格请参考【Dithered】那种感觉（设计系统：dithered），直接开始做。 |
| Retro & Nostalgic | paper | `skills/open-design/references/design-systems/paper.md` | 风格请参考【Paper】那种感觉（设计系统：paper），直接开始做。 |
| Retro & Nostalgic | retro | `skills/open-design/references/design-systems/retro.md` | 风格请参考【Retro】那种感觉（设计系统：retro），直接开始做。 |
| Retro & Nostalgic | vintage | `skills/open-design/references/design-systems/vintage.md` | 风格请参考【Vintage】那种感觉（设计系统：vintage），直接开始做。 |
| Social & Messaging | wechat | `skills/open-design/references/design-systems/wechat.md` | 风格请参考【WeChat Design System】那种感觉（设计系统：wechat），直接开始做。 |
| Starter | default | `skills/open-design/references/design-systems/default.md` | 风格请参考【Neutral Modern】那种感觉（设计系统：default），直接开始做。 |
| Starter | warm-editorial | `skills/open-design/references/design-systems/warm-editorial.md` | 风格请参考【Warm Editorial】那种感觉（设计系统：warm-editorial），直接开始做。 |
| Themed & Unique | agentic | `skills/open-design/references/design-systems/agentic.md` | 风格请参考【Agentic】那种感觉（设计系统：agentic），直接开始做。 |
| Themed & Unique | futuristic | `skills/open-design/references/design-systems/futuristic.md` | 风格请参考【Futuristic】那种感觉（设计系统：futuristic），直接开始做。 |
| Themed & Unique | hud | `skills/open-design/references/design-systems/hud.md` | 风格请参考【HUD Design System】那种感觉（设计系统：hud），直接开始做。 |
| Themed & Unique | loom | `skills/open-design/references/design-systems/loom.md` | 风格请参考【Loom Design System】那种感觉（设计系统：loom），直接开始做。 |
| Themed & Unique | pacman | `skills/open-design/references/design-systems/pacman.md` | 风格请参考【Pacman】那种感觉（设计系统：pacman），直接开始做。 |
| Themed & Unique | tetris | `skills/open-design/references/design-systems/tetris.md` | 风格请参考【Tetris】那种感觉（设计系统：tetris），直接开始做。 |
| Themed & Unique | totality-festival | `skills/open-design/references/design-systems/totality-festival.md` | 风格请参考【Totality Festival】那种感觉（设计系统：totality-festival），直接开始做。 |
| Themed & Unique | trading-terminal | `skills/open-design/references/design-systems/trading-terminal.md` | 风格请参考【Trading Terminal Design System】那种感觉（设计系统：trading-terminal），直接开始做。 |

---

## 四、媒体与自动化能力（PilotDeck 内）

| 类型 | 说明 |
|------|------|
| 图片文件 png | 使用 `generate_image`，输出到工作区 |
| 视频文件 mp4 | 使用 `generate_video`，输出到工作区 |
| HTML 导出 MP4 | 使用 `render_html_video` 将本地 html 渲染为 mp4 |
| Figma 自动化 | 配置 MCP 后可用 `mcp__figma__*` 工具 |

详见 `docs/open-design-prompt-examples.md` 第七节与 `docs/open-design-admin-guide.md`。

---

## 五、相关文档

| 文档 | 用途 |
|------|------|
| `docs/open-design-prompt-examples.md` | 非技术用户可复制提问 |
| `docs/open-design-user-agent-manual.md` | 使用说明 |
| `docs/open-design-admin-guide.md` | 迁移、同步、联调 |

