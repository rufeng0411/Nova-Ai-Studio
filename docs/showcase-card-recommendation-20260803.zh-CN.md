# Showcase 卡片内容规格（Wave-A · 2026-08-03）

> **规格批全 A（L0+L1）**：`npm run test:showcase:cards:gate`  
> **机读源**：[`showcase-card-recommendation-20260803.json`](./showcase-card-recommendation-20260803.json)（54 卡）  
> **提示词等级**：`professional-showcase-v2`（代理提案 / 高管可投影级 brief，非短句模板）  
> **Wave-B 实机批量**：须你书面确认后才开跑（见文末确认清单）

## 1. 战略摘要

Nova Ai-Studio 演示案例定位为「**可打开验收的企业项目成果馆**」，不是模板商店或纯聊天截图墙。

生成提示词按 **专业 showcase** 编写：假名品牌/场景设定、受众与用途、结构清单、视觉/质量禁令、验收口径（可投影/可投董事会/可审阅），强制「须交付」+ 系统任务目录；合规栏含执业免责。

| 锚点 | 做法 |
|------|------|
| 相对 Gamma/扣子/纯聊天 | 徽章写交付格式；注解写可验收成果；提示词强制「须交付」+ 任务目录 |
| 中国中小 B2B 节奏 | 办公 PPT / 调研建信任 → 全案★ / GEO 建护城河 → 合规★ 建私有化信任 |
| 栏间去重 | GEO 全案只在 `fullcase`；真 pptx/Bento 只在 `office`；单点 GEO 只在 `geo` |

## 2. 九栏 × 6 卡 · 完整生成提示词

以下每卡含：**绑定**、**须交付**、**中文提示词**、**英文提示词**（可直接复制开跑；中文约 120–240 字专业 brief）。

权威源：`scripts/showcase/card-prompts-pro-20260803.mjs` → `build-card-recommendation-20260803.mjs`。改提示词请改 pro 源后重建。

### 设计 (`design`)

#### 侏罗纪岛潮玩电商站

| 字段 | 值 |
|------|-----|
| id | `sc-design-jurassic-shop` |
| 英文名 | Jurassic Island collectible shop |
| 徽章 | 电商 · HTML+图 / Shop · HTML+PNG |
| 注解 | 泡泡玛特风潮玩电商：Q 版侏罗纪动物人偶，强绑 AI 生图商品主图。 |
| 绑定 | `od-saas-landing` (skill) |
| 须交付 | `index.html`, `dino-01.png`, `dino-02.png`, `dino-03.png`, `dino-04.png` |
| 优先级 | P0 |
| 依赖 | image_api |

**生成提示词（中文）**

```
为潮玩品牌「侏罗纪岛」交付类似泡泡玛特的时尚人偶玩具电商官网，高度结合 AI 生图。使用能力「官网落地页」(od-saas-landing)。流程：①先用 generate_image 为 4 只可爱 Q 版侏罗纪动物人偶各生成一张商品主图（圆润潮玩比例、大眼睛、马卡龙×雨林色、影棚柔光、透明底座感）：三角龙「小角」、暴龙「豆豆」、翼龙「呼呼」、腕龙「长长」——分别落盘 dino-01.png～dino-04.png（可再做 1 张英雄主视觉 hero.png）；②再写 index.html，用 <img> 真实引用上述 PNG，禁止占位灰块/SVG 假商品图。页面须含：沉浸英雄区（品牌主张「开盒遇见史前萌物」+主 CTA「探索系列」）、系列 Pill（盲盒/限定/新品）、四格商品墙（名/系列价/稀有度标签）、会员/积分条、底部购买与门店 CTA。视觉：泡泡玛特式潮玩电商——奶白底、圆角大卡片、柔彩点缀、高级而不幼稚。禁廉价贴纸堆砌、禁版权临摹泡泡玛特 IP。须达到品牌上线前可投影验收。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Pop Mart–style collectible doll e-commerce for brand “Jurassic Island”, AI-image heavy. Use od-saas-landing. (1) generate_image four cute Q Jurassic animal dolls (chibi proportions, big eyes, macaron×jungle palette, soft studio light): Triceratops, T-rex, Pterosaur, Brachiosaurus → dino-01.png–dino-04.png (+ optional hero.png). (2) Write index.html binding those PNGs via <img>—no gray/SVG fakes. Include hero+CTA, series pills, 4-card product wall with rarity tags, membership strip, buy/store CTA. Premium toy-commerce look, not childish clutter. No Pop Mart IP cloning. Launch-projection quality. Write every file into the system-assigned task directory.
```

#### 澜析 LANXI 产品官网

| 字段 | 值 |
|------|-----|
| id | `sc-design-lanxi-site` |
| 英文名 | LANXI product website |
| 徽章 | 网站 · HTML / Site · HTML |
| 注解 | 协作分析 SaaS 杂志风官网：定价、产品叙事与分层信息架构。 |
| 绑定 | `od-saas-landing` (skill) |
| 须交付 | `index.html` |
| 优先级 | P0 |
| 依赖 | 无 |

**生成提示词（中文）**

```
为协作分析 SaaS「澜析 LANXI」交付可投影的产品/定价官网（网站，不是手机 App UI）。使用能力「官网落地页」(od-saas-landing)。须交付：index.html。须含：杂志风信息架构（英雄主张、产品分层/能力叙事、定价或套餐层、客户证言或场景、主 CTA），视觉石墨高级灰×雾紫/雾蓝点缀，桌面与移动可读。禁手机外框多屏套件、禁线框草稿。须达到产品官网评审可投影标准。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Product/pricing website for analytics SaaS “LANXI” (website—not mobile App UI). Use od-saas-landing. Must deliver: index.html with magazine-style IA (hero, product layers, pricing, social proof, CTA). Graphite premium + mist accent. No phone-frame App suite. Projection-ready. Write every file into the system-assigned task directory.
```

#### 绿茵场足球分析App

| 字段 | 值 |
|------|-----|
| id | `sc-design-soccer-app-ui` |
| 英文名 | PitchLens football analysis App |
| 徽章 | App UI · HTML / App UI · HTML |
| 注解 | 对标 Sofascore/FotMob 的足球分析五屏：赛程、比赛中心、阵容评分、球员、积分榜。 |
| 绑定 | `od-mobile-app` (skill) |
| 须交付 | `index.html`, `screen-1.html`, `screen-2.html`, `screen-3.html` |
| 优先级 | P0 |
| 依赖 | 无 |

**生成提示词（中文）**

```
为足球数据分析 App「绿茵场」（对标 Sofascore / FotMob / WhoScored 的核心体验，非官网落地页）交付可投评审的高保真手机界面套件。先深度对齐行业惯例：即时比分与联赛分组、比赛中心（事件时间线/控球射门/xG 与 momentum）、球场阵型与球员评分（约 0–10）、球员赛季雷达与热区示意、联赛积分榜。使用能力「手机界面示意」(od-mobile-app)。须先 scaffold_mobile_mockup（slug=pitchlens-football，preset=blank），再精修各屏。须交付：index.html（手机外框多屏并排总览）以及 screen-1.html～至少 screen-3.html；目标五屏——①今日/进行中赛程（LIVE 角标、分钟、比分、联赛分区）②比赛中心（比分条+事件时间线+关键数据条：控球/射门/xG；可含 momentum 波形）③阵容球场图（4231 或 433）+ 球员评分气泡④球员详情（综合评分、关键数据条、简化热区/属性）⑤联赛积分榜（排名/场次/净胜球/积分，关注队高亮）。每屏约 390×844；视觉：深空体育数据风（近黑炭灰底×荧光绿/柠檬黄数据强调×白字层级），状态栏与底部 Tab（赛程/比赛/发现/关注/我的）一致；数据密度高但可扫读。禁假球衣侵权队徽写实临摹、禁桌面网页硬塞、禁线框草稿。成果须达到体育产品评审可投影的分析 App UI 标准。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
High-fidelity mobile UI suite for football analytics app “PitchLens” (Sofascore/FotMob/WhoScored-class core UX—not a marketing landing). Align with industry patterns: live fixtures by league, match center (events/possession/shots/xG/momentum), formation + 0–10 player ratings, player season radar/heatmap cues, league table. Use od-mobile-app. scaffold_mobile_mockup (slug=pitchlens-football, preset=blank) then refine. Must deliver: index.html (phone-frame gallery) and screen-1.html through ≥screen-3.html; target five screens—(1) today’s/live fixtures (2) match center with timeline + key stats/xG/momentum (3) pitch formation + rating bubbles (4) player detail (5) league table with favorite highlight. ~390×844; dark sports-data UI (charcoal + neon lime accents); consistent tab bar. No real crest copyright clones, no desktop cram, no wireframe drafts. Sports-product review projection quality. Write every file into the system-assigned task directory.
```

#### 衡造 Lumen One 工业设计

| 字段 | 值 |
|------|-----|
| id | `sc-design-industrial-set` |
| 英文名 | Hengzao Lumen One industrial design |
| 徽章 | 工设 · PNG组 / ID · PNG set |
| 注解 | 纯 AI 生图工业设计组图：英雄/三向/材质/正交，展示产品 ID。 |
| 绑定 | `od-image-gen` (skill) |
| 须交付 | `01-hero.png`, `02-three-quarter.png`, `03-material.png`, `04-ortho.png` |
| 优先级 | P0 |
| 依赖 | image_api |

**生成提示词（中文）**

```
为台式氛围灯「衡造 Lumen One」交付一套专业工业设计渲染组图（纯生图，展示产品 ID 能力）。使用能力「图片生成」(od-image-gen)，必须多次调用 generate_image 落盘真实 PNG，禁止线框截图/CSS 假渲染冒充。须交付：01-hero.png（影棚英雄视角：哑光铝+磨砂玻璃灯罩、戏剧性柔光、深灰无缝背景）②02-three-quarter.png（¾ 侧视：比例与 CMF 清晰可读）③03-material.png（材质微距：阳极氧化金属晶粒、玻璃边缘折射、按键/接口细节）④04-ortho.png（正交/三视图或半爆炸结构示意，仍保持照片级真实感而非廉价示意图）。统一产品语言与比例，禁品牌假 Logo 侵权、禁塑料玩具感。可另附 index.html 预览墙。须达到工设评审/提案可投影标准。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Professional industrial-design render set for desk lamp “Hengzao Lumen One” (pure AI images). Use od-image-gen; must generate_image real PNGs—no wireframe/CSS fakes. Must deliver: 01-hero.png (studio hero, matte aluminum + frosted glass), 02-three-quarter.png (¾ view CMF-clear), 03-material.png (macro metal/glass/interface), 04-ortho.png (ortho/three-view or soft explode, still photoreal). Coherent proportions; no toy plastic look. Optional index.html gallery. ID review/projection quality. Write every file into the system-assigned task directory.
```

#### 澄野 CHENGYE 主KV社媒套

| 字段 | 值 |
|------|-----|
| id | `sc-design-kv-social` |
| 英文名 | CHENGYE brand KV social set |
| 徽章 | 平面 · PNG包 / Visuals · PNG pack |
| 注解 | 一套主视觉拆多画幅，适合多端投放验收。 |
| 绑定 | `od-social-carousel` (skill) |
| 须交付 | `kv-portrait.png`, `card-1x1.png`, `card-16x9.png`, `card-9x16.png` |
| 优先级 | P0 |
| 依赖 | image_api |

**生成提示词（中文）**

```
为生活方式品牌「澄野」春季系列交付主 KV + 四画幅社媒套装。使用 od-social-carousel。须交付：kv-portrait.png、card-1x1.png、card-16x9.png、card-9x16.png。同一视觉体系（自然光、亚麻质感、低饱和高级色），四画幅信息层级一致且适配平台裁切安全区。禁四张风格割裂、禁水印乱入。须达到品牌季度发布物料包水准。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Deliver spring KV + four-ratio social set for fictional lifestyle brand “Chengye”. Use od-social-carousel. Must deliver: kv-portrait.png, card-1x1.png, card-16x9.png, card-9x16.png. One visual system (natural light, linen texture, muted premium palette) with safe crops. No style drift. Seasonal brand-kit quality. Write every file into the system-assigned task directory.
```

#### 织野.ZHÌYĚ 增长复盘

| 字段 | 值 |
|------|-----|
| id | `sc-design-zhiye-dash` |
| 英文名 | ZHÌYĚ growth dashboard |
| 徽章 | Dashboard · HTML / Dashboard · HTML |
| 注解 | DTC 户外服饰「织野」增长复盘 Dashboard：KPI、渠道、异常与下周动作一页纸。 |
| 绑定 | `od-data-report` (skill) |
| 须交付 | `index.html` |
| 优先级 | P0 |
| 依赖 | 无 |

**生成提示词（中文）**

```
为 DTC 户外服饰品牌「织野.ZHÌYĚ」交付可投影的增长复盘 Dashboard 一页纸（不是电商商品站）。使用能力「数据报告页」(od-data-report)。须交付：index.html。须含：品牌页头、4 个 KPI 卡、主趋势图+渠道贡献、异常点摘要、结论与下周动作。视觉：石墨深色×青绿强调，数据密度高但可扫读。禁空壳假图、禁无解读的裸表。须达到增长周会可投影标准。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Growth-review dashboard one-pager for DTC outdoor brand “ZHÌYĚ” (not a product e-commerce site). Use od-data-report. Must deliver: index.html with brand header, 4 KPIs, trend+channel charts, alerts, conclusions and next actions. Dark graphite + teal accent. No empty charts. Growth-standup projection quality. Write every file into the system-assigned task directory.
```

### 视频 (`video`)

#### 新品15秒种草短片

| 字段 | 值 |
|------|-----|
| id | `sc-video-seedance-15s` |
| 英文名 | 15s new-product seed clip |
| 徽章 | 广告 · MP4 / Ad · MP4 |
| 注解 | 可播真 mp4 种草片，非分镜文案冒充。 |
| 绑定 | `tool-generate-video` (skill) |
| 须交付 | `promo.mp4` |
| 优先级 | P1 |
| 依赖 | video_api |

**生成提示词（中文）**

```
为护肤新品「澄光瓶」产出 15 秒种草成片。使用 tool-generate-video。须交付：可播放 promo.mp4。叙事：0–3s 钩子质感特写→4–10s 使用场景与成分信任→11–15s 利益点字幕+行动号召。画面高级、节奏利落；真视频 API 成片。禁分镜文案冒充、禁 HTML 录屏假视频。须达到信息流完播测试可用素材级。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Produce a 15s seed film for fictional skincare “Chengguang”. Use tool-generate-video. Must deliver: playable promo.mp4. Hook→ritual/trust→CTA. Premium pacing via real video API. No storyboard-only or HTML screen-capture fakes. Feed-test ready. Write every file into the system-assigned task directory.
```

#### 官网产品发布宣传片

| 字段 | 值 |
|------|-----|
| id | `sc-video-hf-launch` |
| 英文名 | Site product-launch promo |
| 徽章 | 宣传片 · MP4 / Promo · MP4 |
| 注解 | HyperFrames 工程渲染的官网向宣传片成片。 |
| 绑定 | `hf-product-launch-video` (skill) |
| 须交付 | `promo.mp4` |
| 优先级 | P1 |
| 依赖 | hf_key |

**生成提示词（中文）**

```
为智能硬件「衡视」官网首屏发布宣传片。使用 hf-product-launch-video。须交付：promo.mp4。须在任务目录 HyperFrames 工程经 render_hyperframes 渲染成片；镜头含产品揭示、关键卖点字幕、品牌落版。禁用 generate_video 冒充 HF、禁 HTML 录屏。成片须达到官网 Hero 可嵌播的专业质感。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Website launch promo for fictional device “Hengshi”. Use hf-product-launch-video. Must deliver: promo.mp4 via render_hyperframes from task hf-project. Product reveal + benefit titles + endcard. No generate_video substitute or HTML capture. Hero-embed quality. Write every file into the system-assigned task directory.
```

#### SaaS功能演示动效片

| 字段 | 值 |
|------|-----|
| id | `sc-video-saas-remotion` |
| 英文名 | SaaS feature demo motion film |
| 徽章 | 演示 · MP4 / Demo · MP4 |
| 注解 | 脚本到 Remotion/演示动效的产品功能片。 |
| 绑定 | `saas-demo-remotion-full` (template) |
| 须交付 | `promo.mp4` |
| 优先级 | P2 |
| 依赖 | 无 |

**生成提示词（中文）**

```
为 SaaS「澜析」制作 30–45 秒功能演示动效片。使用流程模板 saas-demo-remotion-full。须交付：promo.mp4。展示：登录后仪表盘→一次分析操作→洞察卡片生成→导出分享；UI 动效干净、字幕专业、无口播亦可懂。禁只交分镜稿。须达到产品发布会 Demo 备用片水准。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
30–45s feature demo for fictional SaaS “Lanxi”. Use template saas-demo-remotion-full. Must deliver: promo.mp4 showing dashboard→action→insight→export. Clean UI motion, clear captions. No storyboard-only. Launch-demo backup quality. Write every file into the system-assigned task directory.
```

#### 品牌无脸科普解说

| 字段 | 值 |
|------|-----|
| id | `sc-video-hf-explainer` |
| 英文名 | Faceless brand explainer |
| 徽章 | 科普 · MP4 / Explainer · MP4 |
| 注解 | 无出镜口播的科普成片，适合品牌教育。 |
| 绑定 | `hf-faceless-explainer` (skill) |
| 须交付 | `promo.mp4` |
| 优先级 | P2 |
| 依赖 | hf_key |

**生成提示词（中文）**

```
为保险科技「安澄」制作 45–60 秒无脸科普解说片：理赔三步怎么走。使用 hf-faceless-explainer。须交付：promo.mp4（render_hyperframes）。信息准确、字幕清晰、视觉克制可信；禁夸张恐吓营销、禁 HTML 录屏。须达到官网帮助中心可上架的专业解说级。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
45–60s faceless explainer for fictional insurtech “Ancheng”: 3 claim steps. Use hf-faceless-explainer. Must deliver: promo.mp4 via render_hyperframes. Accurate, calm, clear captions. No scare tactics or HTML capture. Help-center publishable. Write every file into the system-assigned task directory.
```

#### 数据故事动态片

| 字段 | 值 |
|------|-----|
| id | `sc-video-data-story` |
| 英文名 | Data-story motion film |
| 徽章 | 数据视频 · MP4 / Data video · MP4 |
| 注解 | 数据叙事页到动态视频的一条龙样例。 |
| 绑定 | `data-story-video` (template) |
| 须交付 | `promo.mp4` |
| 优先级 | P2 |
| 依赖 | 无 |

**生成提示词（中文）**

```
将「城行指数」城市出行数据故事做成动态短片。使用流程模板 data-story-video。须交付：promo.mp4。要求数据图形运动可读、结论字幕有力、片尾品牌落版；禁止无数据装饰动画。须达到媒体数据专题片开场级质感。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Turn “City Mobility Index” into a data-story film. Use data-story-video. Must deliver: promo.mp4 with readable animated charts and strong takeaway titles. No decorative motion without data. Editorial data-open quality. Write every file into the system-assigned task directory.
```

#### 门店本地生活竖版广告

| 字段 | 值 |
|------|-----|
| id | `sc-video-local-9x16` |
| 英文名 | Local-store 9:16 ad |
| 徽章 | 竖版广告 · MP4 / Vertical ad · MP4 |
| 注解 | 9:16 本地生活信息流广告成片。 |
| 绑定 | `tool-generate-video` (skill) |
| 须交付 | `promo.mp4` |
| 优先级 | P2 |
| 依赖 | video_api |

**生成提示词（中文）**

```
为社区烘焙「麦香巷」制作周末满减 9:16 本地生活广告成片。使用 tool-generate-video。须交付：promo.mp4。竖版构图安全区合规，前 2 秒强钩子，价格利益清晰，门店信任元素自然；真 API 成片。禁 HTML 假视频。须达到本地推投放素材审核级。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
9:16 local-life ad for fictional bakery “Maixiang Lane” weekend deal. Use tool-generate-video. Must deliver: promo.mp4. Safe vertical crop, 2s hook, clear offer, natural trust cues. Real API film—no HTML fake. Local-ads review ready. Write every file into the system-assigned task directory.
```

### 文案 (`copy`)

#### 产品PR特稿

| 字段 | 值 |
|------|-----|
| id | `sc-copy-product-pr` |
| 英文名 | Product PR feature |
| 徽章 | PR特稿 · MD / PR feature · MD |
| 注解 | 品牌向产品特稿：故事抓手强，供媒体/合作方转载改写。 |
| 绑定 | `viral-article-generator` (skill) |
| 须交付 | `product-pr.md` |
| 优先级 | P0 |
| 依赖 | 无 |

**生成提示词（中文）**

```
写一篇真正出彩的产品 PR 特稿（不是新闻通稿、不是 UP 口播）。对象：科技/商业媒体编辑与生态合作方。目标：被转载改写、建立「澜析」专业心智。使用 viral-article-generator。须交付：product-pr.md（建议 1800–2800 字）。开篇须有具体场景钩子，中段用产品能力解决真实协作痛点，穿插可核事实与克制金句，收束到可行动的价值判断。调性：杂志特稿×品牌叙事，冷静有文采。严禁倒金字塔通稿体、严禁「家人们/绝绝子」、严禁空洞排比。文首用 3 行标注：体裁/读者/目标。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Standout product PR feature (not wire, not creator script) on SaaS “LANXI” for editors/partners. Use viral-article-generator. Deliver product-pr.md (~1800–2800 words). Scene hook, pain→capability, sourced facts, restrained lines. Magazine×brand narrative. No inverted-pyramid, no slang hype. Prefatory 3 lines: genre/audience/goal. Write every file into the system-assigned task directory.
```

#### UP主深度评测

| 字段 | 值 |
|------|-----|
| id | `sc-copy-up-review` |
| 英文名 | Creator deep review |
| 徽章 | 评测 · MD / Review · MD |
| 注解 | 创作者评测体：实测细节与态度鲜明，服务种草转化。 |
| 绑定 | `viral-article-generator` (skill) |
| 须交付 | `up-review.md` |
| 优先级 | P0 |
| 依赖 | 无 |

**生成提示词（中文）**

```
写一篇真正好看的科技区 UP 主深度评测成稿（可改口播）。对象：B 站/视频号数码观众（18–35）。目标：完播种草+评论讨论，促成「想试试」。使用 viral-article-generator。须交付：up-review.md。第一人称、有态度；含开箱/佩戴/续航或延迟等可感知实测、明确优缺点与「适合/不适合谁」、结尾购买建议。网感但不油腻，细节扎实。严禁公文通稿腔、严禁全盘吹捧、严禁与 PR 特稿同腔。文首 3 行标注：体裁/读者/目标。产品：「衡视 Pro」智能眼镜。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Sharp tech-UP deep review (script-ready) of “Hengshi Pro” for 18–35 video viewers. Use viral-article-generator. Deliver up-review.md. First-person; unbox/fit/battery or latency tests; pros/cons; who it’s for; buy advice. Online-native not greasy. No press-wire tone, no full hype. Prefatory 3 lines: genre/audience/goal. Write every file into the system-assigned task directory.
```

#### 新闻通稿

| 字段 | 值 |
|------|-----|
| id | `sc-copy-press-wire` |
| 英文名 | News press wire |
| 徽章 | 通稿 · MD / Wire · MD |
| 注解 | 媒体倒金字塔通稿：事实先行，供编辑台直接改写。 |
| 绑定 | `press-release-pack` (template) |
| 须交付 | `press-release.md` |
| 优先级 | P0 |
| 依赖 | 无 |

**生成提示词（中文）**

```
写一篇可供编辑台直接改写的新闻通稿（不是产品特稿、不是 UP 评测）。对象：科技媒体记者与通讯社编辑。目标：被采用发稿、信息零歧义。使用 press-release-pack。须交付：press-release.md。严格倒金字塔：导语含何人/何事/何时/何地/为何；随后规格与上市信息、可核引语（职务+姓名）、关于公司 boilerplate、媒体联系人。事实密度高、形容词克制。严禁故事开篇、严禁口语弹幕腔。文首 3 行标注：体裁/读者/目标。产品：「衡视 Pro」智能眼镜发布。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Desk-ready news wire (not feature, not creator review) for “Hengshi Pro” launch. Use press-release-pack. Deliver press-release.md. Inverted pyramid: 5W lede, specs/availability, attributed quotes, boilerplate, media contact. Dense facts. No story openers, no slang. Prefatory 3 lines: genre/audience/goal. Write every file into the system-assigned task directory.
```

#### 一稿五平台去AI味矩阵

| 字段 | 值 |
|------|-----|
| id | `sc-copy-one-article-matrix` |
| 英文名 | One-article five-platform matrix |
| 徽章 | 矩阵 · MD包 / Matrix · MD pack |
| 注解 | 选题→长文→多平台切片清单锁定，含去 AI 味。 |
| 绑定 | `one-article-matrix` (template) |
| 须交付 | `01-topics.md`, `02-longform.md`, `03-social-slices.md` |
| 优先级 | P1 |
| 依赖 | 无 |

**生成提示词（中文）**

```
为新消费「青盏」跑「一稿五平台」矩阵：选题→支柱长文→多平台切片，并去 AI 味。使用流程模板 one-article-matrix。须交付：01-topics.md、02-longform.md、03-social-slices.md。切片须覆盖公众号/小红书/知乎等差异化语气；清单 basename 锁定，禁飞轮幻影槽扩写。成果须达到内容团队周会可直接认领。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Run one-article five-platform matrix for fictional CPG “Qingzhan” with humanize. Use one-article-matrix. Must deliver: 01-topics.md, 02-longform.md, 03-social-slices.md. Platform-native slices; locked basenames—no flywheel phantom slots. Team-standup assignable. Write every file into the system-assigned task directory.
```

#### 社媒创意矩阵文图包

| 字段 | 值 |
|------|-----|
| id | `sc-copy-social-matrix` |
| 英文名 | Social creative matrix pack |
| 徽章 | 矩阵 · MD+图 / Matrix · MD+art |
| 注解 | 文案加四画幅图与清单，一次验收多平台物料。 |
| 绑定 | `social-creative-matrix` (skill) |
| 须交付 | `copy.md`, `slide-manifest.json` |
| 优先级 | P1 |
| 依赖 | image_api |

**生成提示词（中文）**

```
为运动品牌「跃澄」春季战役交付社媒创意矩阵（文案+多画幅视觉清单）。使用 social-creative-matrix。须交付：copy.md、slide-manifest.json。文案分平台差异化；manifest 标明画幅与文件对应，视觉风格统一燃感且高级。禁文图脱节。须达到代理比稿物料包水准。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Spring social creative matrix for fictional sports brand “Yuecheng”. Use social-creative-matrix. Must deliver: copy.md, slide-manifest.json. Platform-native copy; manifest maps ratios/files; unified premium energy. Agency pitch-pack quality. Write every file into the system-assigned task directory.
```

#### 邮件培育三封序列

| 字段 | 值 |
|------|-----|
| id | `sc-copy-email-seq` |
| 英文名 | Three-email nurture sequence |
| 徽章 | 邮件 · MD / Email · MD |
| 注解 | 欢迎→培育→转化三封，可直接进邮件工具。 |
| 绑定 | `mkt-email-sequence` (skill) |
| 须交付 | `email-sequence.md` |
| 优先级 | P2 |
| 依赖 | 无 |

**生成提示词（中文）**

```
为 SaaS「澜析」试用用户设计三封培育邮件（欢迎→价值深化→转化）。使用 mkt-email-sequence。须交付：email-sequence.md。每封含主题行 A/B、预览文案、正文结构与 CTA；语气专业不骚扰。须达到可导入 ESP 的运营级序列。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Three-email nurture for fictional SaaS “Lanxi” trials. Use mkt-email-sequence. Must deliver: email-sequence.md. Each: subject A/B, preview, body, CTA. Professional, non-spammy. ESP-import ready. Write every file into the system-assigned task directory.
```

### 营销 (`marketing`)

#### 季度增长策略HTML提案

| 字段 | 值 |
|------|-----|
| id | `sc-mkt-campaign-html` |
| 英文名 | Quarterly growth HTML proposal |
| 徽章 | 提案 · HTML / Proposal · HTML |
| 注解 | 可立项的增长策略提案页，适合管理层汇报。 |
| 绑定 | `mkt-campaign-plan` (skill) |
| 须交付 | `campaign-plan.html` |
| 优先级 | P1 |
| 依赖 | 无 |

**生成提示词（中文）**

```
为「青盏茶语」Q3 城市增长战役输出可立项的 HTML 策略提案。使用 mkt-campaign-plan。须交付：campaign-plan.html。须含：战役目标与 KPI、人群洞察、核心主张、渠道组合与预算逻辑、内容节奏、里程碑风险。版式专业可投影，结论先行。禁空洞口号页。须达到品牌总监周会决策包水准。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Q3 city growth HTML proposal for fictional “Qingzhan Tea”. Use mkt-campaign-plan. Must deliver: campaign-plan.html. Goals/KPIs, audience, message, channels/budget logic, content cadence, milestones/risks. Projection-ready, insight-first. Brand-director decision pack. Write every file into the system-assigned task directory.
```

#### 政府光伏项目投标书

| 字段 | 值 |
|------|-----|
| id | `sc-mkt-pv-gov-bid` |
| 英文名 | Gov PV project bid proposal |
| 徽章 | 投标 · MD包 / Bid · MD pack |
| 注解 | 县级分布式光伏招标：长篇正式商务/技术标草案整包。 |
| 绑定 | `cn-bid-response-pack` (template) |
| 须交付 | `bid-analysis.md`, `commercial-bid.md`, `technical-bid.md` |
| 优先级 | P0 |
| 依赖 | 无 |

**生成提示词（中文）**

```
为县级「屋顶分布式光伏发电」公开招标编制正式投标文件草案（示范）。使用流程模板 cn-bid-response-pack。须交付：bid-analysis.md、commercial-bid.md、technical-bid.md。技术标须长篇正式：工程概况与响应、系统设计与组件/逆变器选型、施工组织与进度、质量安全与并网、运维与质保、业绩与人员配置等分章编号；商务标含报价说明、资格与承诺要点。语气公文体、禁口号短页与营销软文腔。本成果为示范草案，不构成执业意见。须达到可进评标对照的专业篇幅。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Formal bid drafts for a county rooftop distributed-PV public tender (demo). Use cn-bid-response-pack. Must deliver: bid-analysis.md, commercial-bid.md, technical-bid.md. Tech bid must be long-form: overview, system design, construction/schedule, HSE & grid, O&M/warranty, track record/staffing—numbered chapters. Commercial: pricing notes, quals, commitments. Official tone—no slogan pages. Demo draft only, not professional advice. Evaluation-ready length. Write every file into the system-assigned task directory.
```

#### 活动预算与里程碑表

| 字段 | 值 |
|------|-----|
| id | `sc-mkt-budget-xlsx` |
| 英文名 | Campaign budget and milestones |
| 徽章 | 预算 · XLSX / Budget · XLSX |
| 注解 | 可进审批的预算与里程碑表。 |
| 绑定 | `mkt-campaign-budget` (skill) |
| 须交付 | `campaign-budget.xlsx` |
| 优先级 | P2 |
| 依赖 | 无 |

**生成提示词（中文）**

```
为「青盏」夏季快闪输出可审批的预算与里程碑表。使用 mkt-campaign-budget。须交付：campaign-budget.xlsx。分项含媒介/场地/物料/人力/应急；含时间节点与负责人列；数字自洽。须达到财务/市场双审可读的专业表。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Approval-ready budget workbook for fictional “Qingzhan” summer pop-up. Use mkt-campaign-budget. Must deliver: campaign-budget.xlsx. Media/venue/assets/labor/contingency, dates, owners; coherent numbers. Finance+marketing reviewable. Write every file into the system-assigned task directory.
```

#### 销售作战卡Battlecard

| 字段 | 值 |
|------|-----|
| id | `sc-mkt-battlecard` |
| 英文名 | Sales battlecard |
| 徽章 | 销售赋能 · HTML / Enablement · HTML |
| 注解 | 一线销售可打开的竞品对照作战卡。 |
| 绑定 | `sales-battlecard-full` (template) |
| 须交付 | `battlecard.html` |
| 优先级 | P1 |
| 依赖 | 无 |

**生成提示词（中文）**

```
为 SaaS「澜析」制作对两类竞品的销售作战卡 HTML。使用 sales-battlecard-full。须交付：battlecard.html。须含：一句话赢法、对比表、常见异议与话术、落地场景、禁止过度承诺提示。信息密度高但可读，销售外勤可打开。须达到销培可印发水准。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Sales battlecard HTML for fictional SaaS “Lanxi” vs two rivals. Use sales-battlecard-full. Must deliver: battlecard.html. Win theme, matrix, objections/scripts, use cases, overpromise guards. Field-sales openable; enablement printable. Write every file into the system-assigned task directory.
```

#### 竞品对标

| 字段 | 值 |
|------|-----|
| id | `sc-mkt-competitor` |
| 英文名 | Competitor benchmarking |
| 徽章 | 竞品 · MD / Compete · MD |
| 注解 | 营销视角竞品对照矩阵，服务定位与战役主张。 |
| 绑定 | `nova-research-competitor` (skill) |
| 须交付 | `competitor-matrix.md`, `data-sources.md` |
| 优先级 | P1 |
| 依赖 | bocha |

**生成提示词（中文）**

```
为新茶饮「青盏」输出营销视角竞品对标决策包。使用能力「Nova-竞品对标」(nova-research-competitor)。须交付：competitor-matrix.md、data-sources.md。对照两家头部竞品：品牌定位、价格带、渠道组合、内容/社媒打法、会员与联名、优劣势与可攻击点；给出本季「赢/避」建议。表格专业、结论锋利、来源可追溯。禁无出处断言。须达到品牌营销周会选型附件级。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Marketing competitor benchmarking pack for “Qingzhan” tea. Use nova-research-competitor. Must deliver: competitor-matrix.md, data-sources.md. Vs two rivals: positioning, price band, channels, content/social, membership/collabs, attack/defend calls. Sourced, sharp. Brand marketing weekly attachment quality. Write every file into the system-assigned task directory.
```

#### 投放周复盘效果报告

| 字段 | 值 |
|------|-----|
| id | `sc-mkt-perf-report` |
| 英文名 | Weekly ads performance report |
| 徽章 | 复盘 · HTML / Review · HTML |
| 注解 | 投放周复盘 HTML，含结论与下周动作。 |
| 绑定 | `mkt-performance-report` (skill) |
| 须交付 | `performance-report.html` |
| 优先级 | P2 |
| 依赖 | 无 |

**生成提示词（中文）**

```
为「曜极」耳机信息流投放输出上周复盘 HTML。使用 mkt-performance-report。须交付：performance-report.html。含花费/效果漏斗、素材与人群洞察、失败归因、下周实验计划。图表清晰、结论可执行。须达到投放周会主文档水准。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Weekly paid-media review HTML for fictional “Yaoji” earbuds. Use mkt-performance-report. Must deliver: performance-report.html. Funnel, creative/audience insights, failure attribution, next experiments. Ops meeting primary doc. Write every file into the system-assigned task directory.
```

### 办公 (`office`)

#### 危机应对指挥舱

| 字段 | 值 |
|------|-----|
| id | `sc-pr-crisis-html` |
| 英文名 | Crisis command HTML |
| 徽章 | 危机 · HTML / Crisis · HTML |
| 注解 | 分级研判、Holding、24h 时间线合并为一页 HTML 指挥舱。 |
| 绑定 | `comp-pr-crisis-response` (skill) |
| 须交付 | `crisis-command.html` |
| 优先级 | P0 |
| 依赖 | 无 |

**生成提示词（中文）**

```
为「澄办」突发声誉事件输出危机应对指挥舱（单文件）。使用 comp-pr-crisis-response。须交付：crisis-command.html。合并：严重级别、Holding 草案、干系人口径、24h 时间线（可视化）、升级阈值与复盘清单。专业克制，不代发声明。产出为公关工作底稿，不构成法律意见，对外前须法务审定。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Crisis-command HTML for fictional “Chengban”. Use comp-pr-crisis-response. Deliver crisis-command.html merging severity, holding, stakeholder lines, 24h timeline viz, escalation, after-action. No send claims. PR draft only—not legal advice. Write every file into the system-assigned task directory.
```

#### 媒体日发布会PPT

| 字段 | 值 |
|------|-----|
| id | `sc-pr-media-day-pptx` |
| 英文名 | Media-day press PPT |
| 徽章 | 媒体日 · PPTX / Media day · PPTX |
| 注解 | 发布会主视觉叙事真 pptx，可直接上投影。 |
| 绑定 | `anth-pptx` (skill) |
| 须交付 | `presentation.pptx` |
| 优先级 | P0 |
| 依赖 | 无 |

**生成提示词（中文）**

```
为「衡视 Pro」媒体日制作发布会主 PPT（真文件）。使用 anth-pptx。须交付：presentation.pptx。建议 10–14 页：开场议程、产品故事、关键规格、使用场景、事实页、媒体 Q&A 提纲、联系人。商务发布级版式与图表，禁空壳/HTML 冒充。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Media-day press PPTX for “Hengshi Pro”. Use anth-pptx. Deliver presentation.pptx (~10–14): agenda, story, specs, scenes, facts, Q&A, contacts. Real file—no HTML/empty shell. Write every file into the system-assigned task directory.
```

#### 思想领导力署名稿

| 字段 | 值 |
|------|-----|
| id | `sc-pr-thought-md` |
| 英文名 | Thought-leadership byline |
| 徽章 | 观点稿 · MD / Byline · MD |
| 注解 | 可投行业媒体的观点署名稿，论据可核。 |
| 绑定 | `comp-pr-thought-leadership` (skill) |
| 须交付 | `thought-leadership.md` |
| 优先级 | P1 |
| 依赖 | 无 |

**生成提示词（中文）**

```
以「澜析」CEO 口吻撰写思想领导力署名稿（单篇 MD）。使用 comp-pr-thought-leadership。须交付：thought-leadership.md。主题：协作分析如何改变中小团队决策；有观点、案例与可核论据，禁空话排比。可投行业媒体的专业文笔。产出为公关底稿，不构成法律意见。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Thought-leadership MD as LANXI CEO. Use comp-pr-thought-leadership. Deliver thought-leadership.md on collaborative analytics for SME teams—thesis, cases, checkable claims. Trade-media quality. PR draft only. Write every file into the system-assigned task directory.
```

#### 数字公关战役页

| 字段 | 值 |
|------|-----|
| id | `sc-pr-digital-html` |
| 英文名 | Digital PR campaign HTML |
| 徽章 | 数字公关 · HTML / Digital PR · HTML |
| 注解 | 议题—资产—节奏—KPI 合并为可投影 HTML。 |
| 绑定 | `comp-pr-digital-campaign` (skill) |
| 须交付 | `pr-campaign.html` |
| 优先级 | P1 |
| 依赖 | 无 |

**生成提示词（中文）**

```
为「青盏茶语」输出一季 earned media 数字公关战役页（单文件）。使用 comp-pr-digital-campaign。须交付：pr-campaign.html。合并议题地图、内容资产、渠道节奏、KPI 与审批节点；可用简洁图表。不含付费投放排期。产出为公关底稿，不构成法律意见。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Seasonal earned-media PR campaign HTML for “Qingzhan Tea”. Use comp-pr-digital-campaign. Deliver pr-campaign.html: issue map, assets, cadence, KPIs, approvals—light charts; no paid schedule. PR draft only. Write every file into the system-assigned task directory.
```

#### 媒体Pitch作战页

| 字段 | 值 |
|------|-----|
| id | `sc-pr-pitch-html` |
| 英文名 | Media pitch ops HTML |
| 徽章 | Pitch · HTML / Pitch · HTML |
| 注解 | 角度表、媒体分层与 Pitch 信合并单页 HTML。 |
| 绑定 | `comp-pr-media-pitch` (skill) |
| 须交付 | `media-pitch.html` |
| 优先级 | P1 |
| 依赖 | 无 |

**生成提示词（中文）**

```
为「衡视 Pro」上市准备媒体 Pitch 作战页（单文件，不代发）。使用 comp-pr-media-pitch。须交付：media-pitch.html。合并选题角度表、分层媒体框架、Pitch 信模板与跟进节奏。语气专业克制。产出为公关底稿，不构成法律意见。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Media-pitch ops HTML for “Hengshi Pro” launch (no sending). Use comp-pr-media-pitch. Deliver media-pitch.html: angles, tiered media, pitch templates, follow-up cadence. PR draft only. Write every file into the system-assigned task directory.
```

#### 公关战略路演PPT

| 字段 | 值 |
|------|-----|
| id | `sc-pr-cyber-deck` |
| 英文名 | PR strategy cyber deck |
| 徽章 | 战略路演 · PPTX / Strategy · PPTX |
| 注解 | Cyber/咨询风公关战略路演真 pptx。 |
| 绑定 | `cyber-ppt` (skill) |
| 须交付 | `presentation.pptx` |
| 优先级 | P2 |
| 依赖 | 无 |

**生成提示词（中文）**

```
为「澄海」集团制作年度公关战略管理层路演（Cyber/咨询风真 PPT）。使用 cyber-ppt。须交付：presentation.pptx。含议题地图、风险与机会、关键战役、KPI、里程碑与资源请求。Dark Tech 严谨栅格，禁空壳。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Annual PR strategy Cyber deck for fictional Chenghai Group. Use cyber-ppt. Deliver presentation.pptx: issue map, risks/opportunities, campaigns, KPIs, milestones, asks. Dark-tech grid—no empty shells. Write every file into the system-assigned task directory.
```

### 研究分析 (`research`)

#### 细分赛道行业市场报告

| 字段 | 值 |
|------|-----|
| id | `sc-research-industry` |
| 英文名 | Niche industry market report |
| 徽章 | 行业 · MD / Industry · MD |
| 注解 | 带来源的行业市场报告，可进周会。 |
| 绑定 | `nova-research-industry-market` (skill) |
| 须交付 | `report.md`, `data-sources.md` |
| 优先级 | P0 |
| 依赖 | bocha |

**生成提示词（中文）**

```
撰写中国新茶饮下沉市场 2026 行业研究报告（公开信息综合，示范级深度）。使用 nova-research-industry-market。须交付：report.md、data-sources.md；可另交 report.html（先 md 后 html，Chart 可读）。须含市场规模逻辑、渠道变迁、竞争格局、机会与风险、可执行建议；来源可追溯。禁搜完偏好问卷停手、禁无出处断言。须达到咨询项目一期交付可读。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
2026 China new-tea lower-tier industry report from public sources. Use nova-research-industry-market. Must deliver: report.md, data-sources.md; optional report.html after md. Market logic, channels, competition, risks, actions; cited. No questionnaire stop / unsourced claims. Consulting phase-1 readable. Write every file into the system-assigned task directory.
```

#### 客户洞察调研

| 字段 | 值 |
|------|-----|
| id | `sc-research-customer` |
| 英文名 | Customer insight research |
| 徽章 | 客户 · MD / Customer · MD |
| 注解 | 客户/人群洞察报告，服务产品与增长决策。 |
| 绑定 | `mkt-customer-research` (skill) |
| 须交付 | `customer-research.md`, `data-sources.md` |
| 优先级 | P1 |
| 依赖 | bocha |

**生成提示词（中文）**

```
为 B2B「澜析」输出目标客户洞察调研。使用能力「客户调研」(mkt-customer-research)。须交付：customer-research.md、data-sources.md。含：ICP 分层、购买决策链、关键场景与痛点、异议与触发条件、内容触达建议。洞察可产品化，禁空泛「用户想要更好体验」。须达到产研/增长双周可读。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Customer insight research for B2B “Lanxi”. Use mkt-customer-research. Must deliver: customer-research.md, data-sources.md. ICP tiers, buying committee, jobs/pains, objections/triggers, content motions. Productizable insights—no vague “users want better UX”. Product/growth biweekly readable. Write every file into the system-assigned task directory.
```

#### 产品用户研究报告

| 字段 | 值 |
|------|-----|
| id | `sc-research-user` |
| 英文名 | Product user research report |
| 徽章 | 用研 · MD / UXR · MD |
| 注解 | 用户洞察报告，服务产品与增长。 |
| 绑定 | `nova-research-product-user` (skill) |
| 须交付 | `user-research.md`, `data-sources.md` |
| 优先级 | P1 |
| 依赖 | bocha |

**生成提示词（中文）**

```
为「澄办」中小团队项目管理工具输出用户研究报告。使用 nova-research-product-user。须交付：user-research.md、data-sources.md。含方法说明、人物画像、任务流痛点、机会点优先级。洞察可产品化，禁空泛「用户想要更好体验」。须达到产研双周可读。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
UXR report for fictional SMB PM tool “Chengban”. Use nova-research-product-user. Must deliver: user-research.md, data-sources.md. Method, personas, job pains, prioritized opportunities—no vague “better UX”. Dual-track squad readable. Write every file into the system-assigned task directory.
```

#### 综合议题调研简报

| 字段 | 值 |
|------|-----|
| id | `sc-research-general` |
| 英文名 | General topic research brief |
| 徽章 | 综研 · MD / Brief · MD |
| 注解 | 开放议题快速调研成稿，适合周会前置阅读。 |
| 绑定 | `nova-research-general` (skill) |
| 须交付 | `research-brief.md`, `data-sources.md` |
| 优先级 | P1 |
| 依赖 | bocha |

**生成提示词（中文）**

```
就「国内中小企业私有化 AI 部署」输出综合议题调研简报。使用能力「Nova-综合调研」(nova-research-general)。须交付：research-brief.md、data-sources.md。含背景、关键争议点、可行路径对照、风险与下一步建议；来源可追溯。须达到高管会前 15 分钟可读。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
General research brief on SME private AI deployment in China. Use nova-research-general. Must deliver: research-brief.md, data-sources.md. Context, contested points, path trade-offs, risks, next steps; sourced. 15-minute exec pre-read. Write every file into the system-assigned task directory.
```

#### 咨询结构问题树分析

| 字段 | 值 |
|------|-----|
| id | `sc-research-consulting` |
| 英文名 | Consulting issue-tree analysis |
| 徽章 | 咨询 · MD / Consulting · MD |
| 注解 | 咨询结构问题树与结论，适合立项讨论。 |
| 绑定 | `df-consulting-analysis` (skill) |
| 须交付 | `analysis.md` |
| 优先级 | P2 |
| 依赖 | 无 |

**生成提示词（中文）**

```
为零售「织野」增长放缓做咨询问题树分析。使用 df-consulting-analysis。须交付：analysis.md。MECE 问题树、关键假设、验证路径与 90 天动作。结构像麦肯锡一页纸扩展，结论可执行。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Consulting issue-tree for fictional retailer “Zhiye” growth slowdown. Use df-consulting-analysis. Must deliver: analysis.md. MECE tree, hypotheses, validation path, 90-day actions. MBB one-pager extended rigor. Write every file into the system-assigned task directory.
```

#### 调研结论一页纸仪表盘

| 字段 | 值 |
|------|-----|
| id | `sc-research-dash` |
| 英文名 | Research one-page dashboard |
| 徽章 | 决策 · HTML / Decision · HTML |
| 注解 | 调研结论一页纸 HTML，方便投影。 |
| 绑定 | `od-data-report` (skill) |
| 须交付 | `index.html` |
| 优先级 | P2 |
| 依赖 | 无 |

**生成提示词（中文）**

```
把「新茶饮下沉市场」调研结论收成一页纸决策仪表盘，供事业部周会投影。使用能力「数据报告」(od-data-report)。须交付：index.html。页面须含：①三大结论（机会/风险/窗口）②支撑图表（份额/渗透/竞品对标）③优先级动作清单（本季 3 项）④假设与数据来源脚注。视觉克制、数字可读、禁花哨仪表盘皮肤。须达到高管 3 分钟读完即可拍板。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Compress “new-tea lower-tier market” research into a one-page decision dashboard for weekly BU projection. Use od-data-report. Must deliver: index.html. Include: (1) three takeaways—opportunity/risk/window (2) supporting charts—share/penetration/competitor (3) prioritized Q-actions (top 3) (4) assumptions + source footnotes. Restrained visuals, readable numbers; no flashy dashboard skins. 3-minute exec decision page. Write every file into the system-assigned task directory.
```

### GEO (`geo`)

#### 品牌AI可见度快检

| 字段 | 值 |
|------|-----|
| id | `sc-geo-ai-seo` |
| 英文名 | Brand AI visibility quick audit |
| 徽章 | 快检 · HTML / Audit · HTML |
| 注解 | 可见度快检合并为带勾选表的单页 HTML。 |
| 绑定 | `mkt-ai-seo` (skill) |
| 须交付 | `audit-checklist.html` |
| 优先级 | P0 |
| 依赖 | bocha |

**生成提示词（中文）**

```
对「青盏茶语」做大模型可见度快检，合并为单页 HTML。使用 mkt-ai-seo。须交付：audit-checklist.html（唯一前台文件）。含提问集、可见度判断、缺口、本周 5 条动作；可用表格。轻量 profile，禁绑 GEO 七槽全案。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
AI-visibility quick audit as one HTML for “Qingzhan Tea”. Use mkt-ai-seo. Deliver audit-checklist.html only: queries, calls, gaps, 5 actions. No GEO 7-slot case. Write every file into the system-assigned task directory.
```

#### AI关键词意图库

| 字段 | 值 |
|------|-----|
| id | `sc-geo-keywords` |
| 英文名 | AI keywords intent library |
| 徽章 | 关键词 · HTML / Keywords · HTML |
| 注解 | 意图分层关键词库合并单页 HTML。 |
| 绑定 | `geo-keyword-research` (skill) |
| 须交付 | `keywords.html` |
| 优先级 | P1 |
| 依赖 | bocha |

**生成提示词（中文）**

```
为「衡视」构建 AI 关键词与提问意图库，合并单页 HTML。使用 geo-keyword-research。须交付：keywords.html。按认知/比较/决策分层，标注内容形态；禁无效长尾堆砌、禁多文件散落。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
AI keyword/intent library as one HTML for “Hengshi”. Use geo-keyword-research. Deliver keywords.html: awareness/compare/decision layers. No junk long-tails; no multi-file scatter. Write every file into the system-assigned task directory.
```

#### 竞品可见度对照

| 字段 | 值 |
|------|-----|
| id | `sc-geo-competitor` |
| 英文名 | Competitor visibility matrix |
| 徽章 | 竞品 · HTML / Compete · HTML |
| 注解 | 竞品对照矩阵+缺口建议单页 HTML。 |
| 绑定 | `geo-competitor-analysis` (skill) |
| 须交付 | `competitor-visibility.html` |
| 优先级 | P1 |
| 依赖 | bocha |

**生成提示词（中文）**

```
对照「青盏」与两家竞品大模型可见度，合并单页 HTML。使用 geo-competitor-analysis。须交付：competitor-visibility.html。含矩阵表/简图、缺口与可引用机会。禁绑全案七槽。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Competitor LLM visibility as one HTML for “Qingzhan”. Use geo-competitor-analysis. Deliver competitor-visibility.html with matrix + gaps. No full GEO case. Write every file into the system-assigned task directory.
```

#### 可引用内容成稿页

| 字段 | 值 |
|------|-----|
| id | `sc-geo-optimize` |
| 英文名 | Citable content HTML |
| 徽章 | 成稿 · HTML / Draft · HTML |
| 注解 | 可引用成稿排版为阅读级 HTML。 |
| 绑定 | `geo-content-optimizer` (skill) |
| 须交付 | `optimized.html` |
| 优先级 | P1 |
| 依赖 | 无 |

**生成提示词（中文）**

```
将「青盏」品牌百科式介绍优化为可被大模型稳定摘录的成稿，并排成阅读级单页 HTML。使用 geo-content-optimizer。须交付：optimized.html（唯一前台文件）。短段落、可核事实、清晰实体关系与小标题节奏；禁多文件散落。须达到「可引用内容」样板级。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Rewrite “Qingzhan” brand copy for LLM citation as one reading HTML. Use geo-content-optimizer. Deliver optimized.html only: short paras, checkable facts, clear entities. Citability exemplar. Write every file into the system-assigned task directory.
```

#### 十一模型探测矩阵

| 字段 | 值 |
|------|-----|
| id | `sc-geo-probe` |
| 英文名 | 11-model coverage matrix |
| 徽章 | 探测 · HTML / Probe · HTML |
| 注解 | 必测模型收录矩阵合并仪表盘 HTML。 |
| 绑定 | `geo-visibility-probe` (skill) |
| 须交付 | `coverage-matrix.html` |
| 优先级 | P2 |
| 依赖 | bocha |

**生成提示词（中文）**

```
探测「青盏茶语」在必测大模型集合中的提及/引用矩阵，合并为仪表盘 HTML。使用 geo-visibility-probe。须交付：coverage-matrix.html。行覆盖必测模型，缺 Key 标 skipped 占位，勿谎称全测。须达到监测基线表。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Required-LLM coverage as dashboard HTML for “Qingzhan Tea”. Use geo-visibility-probe. Deliver coverage-matrix.html; skipped rows without keys—no fake full coverage. Monitor baseline. Write every file into the system-assigned task directory.
```

#### GEO监测周报仪表盘

| 字段 | 值 |
|------|-----|
| id | `sc-geo-monitor` |
| 英文名 | GEO monitor weekly dashboard |
| 徽章 | 监测 · HTML / Monitor · HTML |
| 注解 | 监测周报 HTML 仪表盘，服务迭代。 |
| 绑定 | `geo-monitor-report` (skill) |
| 须交付 | `geo-monitor-report.html` |
| 优先级 | P2 |
| 依赖 | bocha |

**生成提示词（中文）**

```
输出「青盏」GEO 监测周报仪表盘（可投影）。使用 geo-monitor-report。须交付：geo-monitor-report.html。含趋势、异常、行动建议与简洁图表；示范数据须醒目标注。禁误绑全案七槽。须达到周报可转发管理层。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
GEO weekly monitor dashboard for “Qingzhan”. Use geo-monitor-report. Deliver geo-monitor-report.html with trends, anomalies, actions, light charts; label demo data. No full GEO case. Exec-forwardable. Write every file into the system-assigned task directory.
```

### 全案项目★ (`fullcase`)

#### 品牌传播Campaign全案 ★

| 字段 | 值 |
|------|-----|
| id | `sc-fullcase-campaign` |
| 英文名 | Brand campaign full case |
| 徽章 | 全案 · 流程 / Full · process |
| 注解 | 流程模板锁定清单，从洞察到渠道节奏整包验收。 |
| 绑定 | `brand-campaign-full` (template) |
| 须交付 | `plan.html` |
| 优先级 | P0 |
| 依赖 | 无 |

**生成提示词（中文）**

```
用 brand-campaign-full 为「青盏茶语」交付品牌传播 Campaign 全案（左右栏多文件验收）。须按模板清单逐项落盘：洞察/人群/主张/渠道/节奏等阶段件 + 主入口 plan.html。版式专业、图表可读、清单锁定。须达到代理比稿/品牌立项可用整包。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Run brand-campaign-full for “Qingzhan Tea” (multi-file left-rail case). Checklist stages + plan.html. Review-grade charts; locked checklist. Agency/brand dual-use pack. Write every file into the system-assigned task directory.
```

#### 内容营销飞轮一季样例 ★

| 字段 | 值 |
|------|-----|
| id | `sc-fullcase-flywheel` |
| 英文名 | Content flywheel season sample |
| 徽章 | 全案 · 流程 / Full · process |
| 注解 | 选题→长文→切片一季样例，清单锁定。 |
| 绑定 | `content-flywheel` (template) |
| 须交付 | `01-topics.md`, `02-longform.md`, `03-social-slices.md` |
| 优先级 | P1 |
| 依赖 | 无 |

**生成提示词（中文）**

```
用 content-flywheel 为「澄野」交付一季内容飞轮全案（左右栏多文件）。须交付：01-topics.md、02-longform.md、03-social-slices.md（STDA basename）。选题可执行、长文可发、切片可排期；禁幻影槽。须达到内容中台季度样板。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Run content-flywheel for “Chengye” (multi-file left-rail). Deliver 01-topics.md, 02-longform.md, 03-social-slices.md. No phantom slots. Content-ops quarterly exemplar. Write every file into the system-assigned task directory.
```

#### 品牌GEO可见性全案 ★

| 字段 | 值 |
|------|-----|
| id | `sc-fullcase-geo` |
| 英文名 | Brand GEO visibility full case |
| 徽章 | 全案 · 流程 / Full · process |
| 注解 | GEO 全案：体检、缺口与 HTML 报告。 |
| 绑定 | `geo-brand-full` (template) |
| 须交付 | `audit-checklist.md`, `report.html` |
| 优先级 | P1 |
| 依赖 | bocha |

**生成提示词（中文）**

```
用 geo-brand-full 为「衡视」交付品牌 GEO 可见性全案（左右栏多文件）。须交付：audit-checklist.md、report.html 及清单其余项。竞品对照、可引用缺口与优先动作齐全；仅全案栏用本模板。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Run geo-brand-full for “Hengshi” (multi-file left-rail). Deliver audit-checklist.md, report.html + checklist. Competitor deltas, citability gaps, actions. Write every file into the system-assigned task directory.
```

#### 新品上市0到1物料全案 ★

| 字段 | 值 |
|------|-----|
| id | `sc-fullcase-launch` |
| 英文名 | Product launch 0-to-1 pack |
| 徽章 | 全案 · 流程 / Full · process |
| 注解 | 上市物料整包，从定位到发布页。 |
| 绑定 | `product-launch-full` (template) |
| 须交付 | `launch-kit.html` |
| 优先级 | P1 |
| 依赖 | 无 |

**生成提示词（中文）**

```
用流程模板 product-launch-full，为消费电子新品「曜极 Air」交付 0→1 上市物料全案（作战室主入口）。须交付：launch-kit.html（及清单约定阶段件）。须覆盖：定位与一句话卖点、关键信息架构、渠道节奏、核心物料入口与责任人占位；叙事统一、阶段可勾选。禁空壳目录页。须达到上市作战室可投影主入口标准。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Run process template product-launch-full for consumer-electronics launch “Yaoji Air” (0→1 war-room homepage). Must deliver: launch-kit.html (+ staged checklist artifacts). Cover positioning & one-liner, key message architecture, channel cadence, core asset entry points with owner placeholders; unified narrative, checkable stages. No empty TOC shells. Launch war-room projection quality. Write every file into the system-assigned task directory.
```

#### SaaS增长全案 ★

| 字段 | 值 |
|------|-----|
| id | `sc-fullcase-saas-growth` |
| 英文名 | SaaS growth full case |
| 徽章 | 全案 · 流程 / Full · process |
| 注解 | 定位到官网、获客与复盘的 SaaS 增长整包。 |
| 绑定 | `saas-growth-full` (template) |
| 须交付 | `growth-plan.html` |
| 优先级 | P2 |
| 依赖 | 无 |

**生成提示词（中文）**

```
用流程模板 saas-growth-full，为 B2B SaaS「澜析」交付季度增长全案（定位→官网/获客→复盘闭环）。须交付：growth-plan.html（及清单约定件）。须含：ICP 与价值主张、获客漏斗与关键指标、官网/内容动作、复盘节奏；阶段闭环、数字可追踪。须达到增长负责人季度蓝图可对齐销售/产品标准。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Run process template saas-growth-full for B2B SaaS “Lanxi” (positioning→site/acquisition→review loop). Must deliver: growth-plan.html (+ checklist items). Include ICP & value prop, funnel + north-star metrics, site/content motions, review cadence; closed-loop stages with trackable numbers. Growth-lead quarterly blueprint alignable with sales/product. Write every file into the system-assigned task directory.
```

#### 大纲到PPT到宣传视频 ★

| 字段 | 值 |
|------|-----|
| id | `sc-fullcase-outline-video` |
| 英文名 | Outline to PPT to promo video |
| 徽章 | 全案 · 跨模态 / Full · multimodal |
| 注解 | 跨办公与视频的一条龙全案。 |
| 绑定 | `outline-ppt-video` (template) |
| 须交付 | `outline.md`, `presentation.pptx`, `promo.mp4` |
| 优先级 | P2 |
| 依赖 | video_api |

**生成提示词（中文）**

```
用 outline-ppt-video 为「衡知」产品发布跑通大纲→真 PPT→宣传视频。须交付：outline.md、presentation.pptx、promo.mp4。三件同源叙事；真 pptx 与可播 mp4，禁空壳。须达到发布会前夜可替换备用链。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Run outline-ppt-video for “Hengzhi” launch: outline→real PPTX→promo video. Must deliver: outline.md, presentation.pptx, promo.mp4. One storyline; no empty shells. Launch-eve backup chain. Write every file into the system-assigned task directory.
```

### 企业合规★ (`compliance`)

#### 经营主体合规自查清单 ★

| 字段 | 值 |
|------|-----|
| id | `sc-compliance-entity` |
| 英文名 | Entity compliance self-check |
| 徽章 | 合规 · MD / Compliance · MD |
| 注解 | 经营主体自查清单草稿，清单清晰可验收。 |
| 绑定 | `comp-entity-compliance` (skill) |
| 须交付 | `compliance-checklist.md` |
| 优先级 | P1 |
| 依赖 | 无 |

**生成提示词（中文）**

```
为小微「澄野商贸」输出经营主体合规自查清单草稿。使用 comp-entity-compliance。须交付：compliance-checklist.md。分执照/公示/经营范围/广告宣传等可勾选条目，指向公开规范要点，语气审慎。本成果为内部合规草稿，不构成执业意见，须持证专业人士审定后方可使用。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Entity compliance self-check draft for fictional SME “Chengye Trading”. Use comp-entity-compliance. Must deliver: compliance-checklist.md. Checkable items across license/publicity/scope/ads with public-rule themes. Internal compliance draft only—not professional advice; licensed review required before use. Write every file into the system-assigned task directory.
```

#### 数据与隐私差距评估草稿 ★

| 字段 | 值 |
|------|-----|
| id | `sc-compliance-privacy` |
| 英文名 | Data/privacy gap assessment draft |
| 徽章 | 隐私 · MD / Privacy · MD |
| 注解 | 隐私差距评估草稿，服务上线前自检。 |
| 绑定 | `comp-data-privacy` (skill) |
| 须交付 | `privacy-gap.md` |
| 优先级 | P1 |
| 依赖 | 无 |

**生成提示词（中文）**

```
为 App「澄办」输出数据与隐私差距评估草稿。使用 comp-data-privacy。须交付：privacy-gap.md。覆盖采集最小化、告知同意、存储与跨境提示、第三方 SDK 等差距与整改优先级。本成果为内部合规草稿，不构成执业意见，须持证专业人士审定后方可使用。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Privacy gap assessment draft for fictional app “Chengban”. Use comp-data-privacy. Must deliver: privacy-gap.md. Minimization, notice/consent, storage/cross-border notes, SDK gaps with priorities. Internal compliance draft only—not professional advice; licensed review required before use. Write every file into the system-assigned task directory.
```

#### 广告法违禁用语改写包 ★

| 字段 | 值 |
|------|-----|
| id | `sc-compliance-ad` |
| 英文名 | Ad-law forbidden-phrase rewrite pack |
| 徽章 | 广告合规 · MD / Ad compliance · MD |
| 注解 | 违禁用语识别与安全改写样例。 |
| 绑定 | `comp-ad-product` (skill) |
| 须交付 | `ad-compliance.md` |
| 优先级 | P1 |
| 依赖 | 无 |

**生成提示词（中文）**

```
审查美妆投放文案并输出广告法违禁用语改写包。使用 comp-ad-product。须交付：ad-compliance.md。风险表述与安全改写对照表，说明理由；禁鼓励虚假宣传。本成果为内部合规草稿，不构成执业意见，须持证专业人士审定后方可使用。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Ad-law rewrite pack for fictional beauty ad copy. Use comp-ad-product. Must deliver: ad-compliance.md. Risk→safe rewrite table with rationale; no false-ad coaching. Internal compliance draft only—not professional advice; licensed review required before use. Write every file into the system-assigned task directory.
```

#### 商事合同红线审查意见书 ★

| 字段 | 值 |
|------|-----|
| id | `sc-compliance-contract` |
| 英文名 | Commercial contract redline memo |
| 徽章 | 合同 · MD / Contract · MD |
| 注解 | 合同红线意见书草稿，便于法务预审。 |
| 绑定 | `comp-contract-review` (skill) |
| 须交付 | `contract-review.md` |
| 优先级 | P0 |
| 依赖 | 无 |

**生成提示词（中文）**

```
对「澄海」与供应商框架协议（示范条款）输出红线审查意见书草稿。使用 comp-contract-review。须交付：contract-review.md。分条款列出风险等级、问题与修改建议，结构像法务预审备忘。本成果为内部合规草稿，不构成执业意见，须持证专业人士审定后方可使用。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Redline memo draft on fictional “Chenghai” supplier framework (demo clauses). Use comp-contract-review. Must deliver: contract-review.md. Risk levels, issues, suggested edits—legal pre-review memo structure. Internal compliance draft only—not professional advice; licensed review required before use. Write every file into the system-assigned task directory.
```

#### 招标解析与标书草案包 ★

| 字段 | 值 |
|------|-----|
| id | `sc-compliance-bid` |
| 英文名 | Bid analysis and proposal draft pack |
| 徽章 | 招投标 · MD包 / Bidding · MD pack |
| 注解 | 招标解析与商务/技术标草案整包。 |
| 绑定 | `cn-bid-response-pack` (template) |
| 须交付 | `bid-analysis.md`, `tech-proposal.md`, `commercial-proposal.md` |
| 优先级 | P1 |
| 依赖 | 无 |

**生成提示词（中文）**

```
对政务信息化采购做招标解析与标书草案包。使用 cn-bid-response-pack。须交付：bid-analysis.md、tech-proposal.md、commercial-proposal.md。解析评分点与废标风险，草案结构完整并标注示范场景。本成果为内部合规草稿，不构成执业意见，须持证专业人士审定后方可使用。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
Bid analysis + proposal drafts for fictional gov-IT tender. Use cn-bid-response-pack. Must deliver: bid-analysis.md, tech-proposal.md, commercial-proposal.md. Scoring/risks; complete draft structure; label demo scenario. Internal compliance draft only—not professional advice; licensed review required before use. Write every file into the system-assigned task directory.
```

#### 小微惠企政策检索摘要 ★

| 字段 | 值 |
|------|-----|
| id | `sc-compliance-policy` |
| 英文名 | SME subsidy policy brief |
| 徽章 | 政策 · MD / Policy · MD |
| 注解 | 惠企政策检索摘要，附公开来源提示。 |
| 绑定 | `cn-policy-subsidy-pack` (template) |
| 须交付 | `policy-brief.md` |
| 优先级 | P2 |
| 依赖 | bocha |

**生成提示词（中文）**

```
为科技型小微「衡知」检索并摘要可关注的惠企政策（国家/地方公开信息）。使用 cn-policy-subsidy-pack。须交付：policy-brief.md。条目含适用提示与来源线索，禁编造文号。本成果为内部合规草稿，不构成执业意见，须持证专业人士审定后方可使用。全部写入系统分配任务目录。
```

**生成提示词（英文）**

```
SME subsidy policy brief for fictional tech SME “Hengzhi” from public sources. Use cn-policy-subsidy-pack. Must deliver: policy-brief.md. Eligibility hints + source clues; no fabricated document numbers. Internal compliance draft only—not professional advice; licensed review required before use. Write every file into the system-assigned task directory.
```

## 3. P0 首屏优先（实机批建议先跑）

| id | section | hub_binding | deps |
|----|---------|-------------|------|
| sc-design-tea-landing | design | od-saas-landing | [] |
| sc-office-board-pptx | office | anth-pptx | [] |
| sc-research-industry | research | nova-research-industry-market | bocha |
| sc-fullcase-campaign | fullcase | brand-campaign-full | [] |
| sc-geo-ai-seo | geo | mkt-ai-seo | bocha |
| sc-compliance-contract | compliance | comp-contract-review | [] |

另有 `sc-copy-one-article-matrix` 亦为 P0（矩阵清单样板），可并入首波。

## 4. 旧 seed 对照

| 动作 | id |
|------|-----|
| 缩略可参考复用 | site-south, video-hf, html-plan, deep, geo-report, full-campaign, full-flywheel, full-geo |
| 内容退役（不进新注册表） | site-modric、体育向 article-*、ppt-guofeng 等 |
| 新建 | 全部 `sc-*`（禁止撞旧 item id） |

## 5. L0–L4 与命令

| 级 | Wave-A | 命令/证据 |
|----|--------|-----------|
| L0 | 必跑 | `npm run test:showcase:cards:gate` |
| L1 | 必跑 | gate：54 卡、九栏×6、唯一绑定、禁词、隐藏 slug、合规免责 |
| L2–L4 | Wave-B | 见计划；`test:showcase:cards:live --dry-run` 可预览队列 |

重建 JSON：`node scripts/showcase/build-card-recommendation-20260803.mjs`  
重建本 MD：`node scripts/showcase/render-card-recommendation-md.mjs`

## 6. 人工确认清单（Wave-B 开跑前）

请确认后回复类似口令：

`确认 Wave-B，范围 P0+P1，shadow，项目 Showcase-Batch-20260803`

须覆盖：

1. 卡表文案与提示词是否 OK（砍卡列出 `sc-*`）
2. 范围：`P0-only` / `P0+P1` / `全部54`
3. 验收项目名（建议保留、禁 teardown）
4. Key：video / HF / 生图 / 博查（缺则 skipped）
5. 发布：默认 **shadow**；`enforce` 须另说「盖前台」

**无确认禁止批量 Gateway。**

## 7. Wave-A 自检

- [x] `npm run test:showcase:cards:gate` exit 0
- [x] JSON 54 / 九栏×6
- [x] MD 展开 54 条完整中英提示词
- [x] 零双主绑定、零隐藏 slug、零禁词
- [x] 合规 6/6 免责
- [x] 全案/合规 star=true
- [x] 未改前台 catalog、未跑 Gateway

**规格批全 A ≠ 案例已上线全 A。**
