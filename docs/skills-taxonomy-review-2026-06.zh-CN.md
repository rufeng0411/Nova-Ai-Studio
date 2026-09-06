# 能力分类与中文展示 — 盘点与调整说明（2026-06）

## 一、问题诊断（调整前）

| 问题 | 表现 | 根因 |
|------|------|------|
| 营销 Tab 爆炸 | 可见营销 **409** 项，策略阶段 **222** 项 | Brand Build 包 `mkt-brand-*` 与 `mkt-brand-skills-*` **102 对完全重复**；ASO 包 40 项全展示 |
| 中文名缺失 | **816** 项 `display_name` 无中文 | 生态 vendor 技能未进 `SKILL_ZH` 手工表；i18n 生成回退英文 |
| 三级分类错位 | `fal-*` 主归营销·视频 | 前缀规则 `major_category: marketing` |
| 未归类 | `diagram-maker` 落在 uncategorized | 缺 `SLUG_TAXONOMY` 条目 |
| 脑爆/教育 | 方法论 118 项、教育 201 项可见 | 符合预期（pms/pmd + Hermes 学段） |

## 二、分类体系（L1 / L2 / L3）

| 层级 | 营销飞轮 Tab | 办公/创作/开发/脑爆/教育 Tab |
|------|-------------|------------------------------|
| **L1 大 Tab** | `major_category: marketing` | `office` / `creation` / `development` / `brainstorming` / `education` |
| **L2** | 飞轮六阶段 Pill（调研→…→监测） | 子类 Pill（如办公·文档、创作·视频、脑爆·方法论） |
| **L3** | `task_group`（如 AI搜索、竞品情报） | `category_subtag`（如 `office_slides`、`create_video`） |

跨 Tab 展示：`secondary_categories` / `secondary_task_groups` / `secondary_stages`。

## 三、已落实调整

### 3.1 去重与降噪（Hub 可见 805 → **584**）

1. **`mkt-brand-skills-*` 全部隐藏** — 与 `mkt-brand-*` 一一镜像，属 vendor 嵌套目录重复。
2. **`mkt-brand-*` 仅保留 16 个橱窗** — 品牌发现/识别/语气、SEO、内容策略、落地页、程序化 SEO、CRO、上线、漏斗、设计系统、分析、付费、实验、竞品体验、文案、编辑质检。
3. **`mkt-aso-*` 仅保留 10 个橱窗** — 关键词、元数据、截图、审计、竞品、本地化、评论、Apple Search Ads、自定义产品页、应用内活动。
4. **`edu-sci-*`（145）继续 hidden** — 学术工具包默认不进 Hub，避免教育 Tab 爆炸；对话仍可按 slug 调用。

### 3.2 分类纠偏

| 包/技能 | 调整 |
|---------|------|
| `fal-*`（17） | 主 Tab → **创作·视频**；`secondary` 保留营销飞轮·视频 |
| `diagram-maker` | → **创作·品牌视觉**；`secondary` 办公/开发 |
| `mkt-brand-*` 橱窗 | 按 slug 关键词补 `secondary_categories`（设计→创作、文档→办公、代码/安全→开发） |

### 3.3 中文名称与介绍（967/967）

- 新增 `scripts/lib/capabilityZhAuto.mjs`：按前缀（`pms-`/`mkt-aso-`/`edu-sci-` 等）与片段词典自动生成 **display_name / task_summary / description**。
- `generate-capabilities-i18n.mjs` 对无手工条目技能走自动中文。
- `capabilityLocale.ts` 客户端同步透传 `display_name`、`setup_hint`（与 API 一致）。
- 验收：`zh_display_names=967`、`zh_summaries=967`；`npm run check:i18n-zh` 通过。

## 四、调整后可见分布（Hub）

| 大 Tab | 可见数 | 说明 |
|--------|--------|------|
| 营销飞轮 | **170** | 策略阶段 **31**（原 222）；核心 mkt/geo/nova/od + 品牌/ASO 橱窗 |
| 脑爆 | **129** | 方法论 118 + 名人 11 |
| 教育学习 | **201** | Hermes 学段包；`edu-sci` 已隐藏 |
| 创作 | **48** | 含 fal-17、润色、视频、UI 等 |
| 开发 | **22** | |
| 办公 | **14** | |

## 五、合理性结论

| 维度 | 评价 |
|------|------|
| L1 五 Tab + 飞轮 | **合理** — 与产品定位一致 |
| 脑爆·方法论 | **合理** — pms/pmd 独立 Pill，与名人思维并列 |
| 创作·润色/音频 | **合理** — humanizer/unslop、播客/音乐归位 |
| 营销·品牌/ASO 大包 | **已优化** — 由「全量展示」改为「橱窗 + 隐藏重复」 |
| 教育·学术 145 项 | **合理隐藏** — 需要时可挑 5–10 项取消 hidden 作橱窗 |
| 中文展示 | **已全覆盖** — 选手工表 + 自动生成；橱窗项可逐步精修文案 |

## 六、后续可选精修（非阻塞）

1. **橱窗文案精修**：对 16+10 个品牌/ASO 橱窗写入 `capability-hub-zh.json` 短标题（2–8 字）替代自动生成。
2. **digital-marketing-pro**：网络恢复后 vendor `mkt-dmp-*`，建议同样采用「橱窗 + hidden」策略。
3. **phuryn pms-***：重跑 vendor 后核对与 pmd 是否重复主题，必要时合并 Pill 筛选规则。
4. **飞轮阶段「策略 31」**：若仍偏多，可将部分 `mkt-adv-*` 迁至「触达·付费」并提高 `hub_sort` 区分度。

## 七、涉及文件

- `scripts/lib/skillsEcosystemTaxonomy.mjs` — 隐藏规则、橱窗白名单、fal 纠偏
- `scripts/lib/capabilityZhAuto.mjs` — 中文自动生成
- `scripts/generate-capabilities-i18n.mjs` — 接入 auto zh
- `scripts/lib/capabilityHubTaxonomy.mjs` — diagram-maker
- `ui/src/shared/capabilityLocale.ts` — display_name 本地化
- 重新生成：`npm run capabilities:gen`
