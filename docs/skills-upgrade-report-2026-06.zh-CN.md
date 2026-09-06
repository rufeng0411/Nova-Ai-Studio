# 技能生态升级 — 最终修改报告（2026-06）

> 生成时间：2026-06-10 · 对照计划「技能生态深度调研」四批次落地

## 一、总览

| 指标 | 升级前 | 升级后 |
|------|--------|--------|
| 目录能力项 | ~408 | **967** |
| Vendor 生态包技能 | 0 | **508**（本次 vendor 成功；含历史已装） |
| 流程模板 | 19 | **28**（+T1–T9） |
| 脑爆子类 Pill | 名人思维 | **名人思维 + 方法论** |
| 创作子类 | 7 类 | **+润色 +音频** |

## 二、表 A 新增落地（摘要）

### 批次一（零依赖 / 本地）

- **官方办公**：`anth-pptx`、`anth-xlsx`、`anth-mcp-builder`、`anth-canvas-design` → `skills/vendor/anthropics-skills/`
- **润色双件套**：`humanizer`、`unslop` → `skills/vendor/writing-polish/`（创作 Tab · **润色** Pill）
- **脑爆方法论**：`pmd-*`（deanpeters 48 项）、`brainstorm-structured`；`pms-*`（phuryn）本次因网络 SSL 未重拉，保留历史目录
- **营销包**：`mkt-claude-seo`、`mkt-last30days`、`mkt-email-bible`、`mkt-x-article-publisher`、`mkt-adv-*`（11）、`mkt-aso-*`（35）、`mkt-brand-*`（118+）、`mkt-screenshots`（stub）
- **创作包**：`create-color-expert`、`create-taste-skill`、`create-ui-*`、`create-threejs-*`、`create-youtube-clipper`、`office-epub`
- **开发**：`dev-playwright`、`dev-next-best-practices`（**替换** `react-next-best-practices`）、`dev-sentry-sdk-setup`（stub）
- **教育**：`edu-sci-*`（145，Hub **hidden_in_hub**）、`edu-recursive-research`、`edu-tutor-skills`
- **办公**：`office-ecom`、`office-nutrient`（B 档）

### 批次二（B 档 needs_config）

| 前缀/Slug | 配置入口 | 环境变量 |
|-----------|----------|----------|
| `fal-*` | 设置 → 技能服务 → fal.ai | `FAL_KEY` |
| `mkt-typefully-*` | Typefully | `TYPEFULLY_API_KEY` |
| `video-db-*` | VideoDB | `VIDEO_DB_API_KEY` |
| `create-ai-music` | 音乐生成 | `PILOTDECK_SKILL_MUSIC_API_KEY` |
| `create-wonda` | Wonda | `PILOTDECK_SKILL_WONDA_API_KEY` |
| `office-nutrient` | Nutrient | `NUTRIENT_API_KEY` |
| `dev-sentry-sdk-setup` | Sentry | `SENTRY_DSN` |
| `create-nanobanana-ppt` | **继承模型池 Google Key** | `PILOTDECK_NANOBANANA_GOOGLE_KEY` |

实现：`ui/server/services/pilotdeckConfig.js` → `applySkillServicesRuntimeEnv`；UI：`PilotDeckConfigTab` → `SkillServicesHubSection`。

### 按计划排除（未装）

postiz-agent、xiaohongshu-mcp、n8n-skills、notebooklm-skill、openai/sora、hf paper-publisher、Trail of Bits 安全包、translate-book。

### Vendor 失败 / 可选（7）

| 项 | 原因 | 处理 |
|----|------|------|
| phuryn pm-skills | Git SSL 握手失败 | 保留历史 `pms-*` 目录；可重跑 `npm run vendor:skills-ecosystem` |
| digital-marketing-pro | 同上 | 待网络恢复后重拉 `mkt-dmp-*` |
| mkt-screenshots | 上游仓库不存在 | **stub** 已写入 |
| hamelsmu evals | 仓库 404 | 待换源 |
| office-minimax docx/xlsx/pptx | MiniMax 仓库 404 | 已有 `minimax-pdf`；三件套待换源 |
| dev-sentry-sdk-setup | getsentry 布局变更 | **stub** + needs_config |

## 三、表 C 删除 / 隐藏

### 物理删除（16 目录）

`find-skills`、`skill-creator`、`frontend-design`、`web-design-guidelines`、`react-next-best-practices`、`apple-notes`、`apple-reminders`、`bear-notes`、`1password`、`himalaya`、`gog`、`weather`、`spike`、`trello`、`blogwatcher`、`summarize`。

### hidden_in_hub

`github`、`obsidian`、`notion`、`tmux`、`ala-content-creator`、`mkt-competitors`、`mkt-competitor-profiling`、`mkt-competitive-brief`、`mkt-aso`（装 `mkt-aso-*` 后隐藏旧项）、`edu-sci-*`（145 项默认不展示）。

竞品分析保留：`nova-research-competitor` + `mkt-competitive-intel`。

## 四、表 D 新分类

| 子类 | Tab | 种子技能 |
|------|-----|----------|
| `methodology` | 脑爆 | `pmd-*`、`pms-*`、`brainstorm-structured` |
| `polish` | 创作 | `humanizer`、`unslop` |
| `create_audio` | 创作 | `create-ai-music`、`df-podcast-generation`（迁入） |

`dev_security` 子类按计划**本次不建**。

## 五、九条新流程模板（T1–T9）

已写入 `config/process-templates.json`，`npm run templates:gen` 验证 **28** 条（轻 8 / 标 13 / 全 7）。

| ID | 名称 | 档位 | rating |
|----|------|------|--------|
| outline-ppt-video | 大纲→PPT→炫酷视频 | 全案 | 4.8 |
| website-promo-video | 官网→品牌宣传视频 | 标准 | 4.6 |
| research-podcast | 深度调研→双人播客 | 标准 | 4.5 |
| one-article-matrix | 一文多发内容矩阵 | 标准 | 4.4 |
| data-story-video | 数据→动态网页→数据视频 | 全案 | 4.7 |
| xhs-hit-factory | 小红书爆款工厂 | 标准 | 4.5 |
| meeting-to-deck | 会议记录→复盘 PPT+待办 | 轻量 | 4.3 |
| doc-to-course | 资料→课件→随堂测验 | 标准 | 4.4 |
| persona-debate-article | 名人脑爆→观点长文 | 轻量 | 4.6 |

T4/T6 已去掉「直发小红书」，保留 humanizer 润色增强。

## 六、星级 icon

- 数据：`config/skills-ecosystem-ratings.json` + 模板 `rating` 字段
- 生成：`capabilities:gen` 透传 `rating` → catalog
- API：`capabilities.js` `finalizeCapability` 双路径透传 `rating`、`setup_hint`
- UI：`CapabilityCard` / `ProcessTemplateGallery` 显示「★ 4.5」紧凑样式

## 七、涉及文件清单

| 类型 | 路径 |
|------|------|
| Vendor | `scripts/vendor-skills-ecosystem.mjs`、`skills/vendor/skills-ecosystem-manifest.json` |
| 分类 | `scripts/lib/capabilityHubTaxonomy.mjs`、`scripts/lib/skillsEcosystemTaxonomy.mjs` |
| 目录 | `config/capabilities.catalog.json`、`config/skills-ecosystem-ratings.json` |
| 模板 | `config/process-templates.json` |
| API/UI | `ui/server/routes/capabilities.js`、`ui/server/routes/processTemplates.js`、`CapabilityCard.tsx`、`CapabilityHub.tsx`、`ProcessTemplateGallery.tsx` |
| Key | `ui/server/services/pilotdeckConfig.js`、`PilotDeckConfigTab.tsx` |
| Fork 登记 | `config/pilotdeck-core-fork.manifest.json`（+7 条） |

## 八、后续建议

1. 网络稳定后重跑 `npm run vendor:skills-ecosystem` 补 phuryn / digital-marketing-pro / MiniMax / hamelsmu。
2. `edu-sci-*` 可按需挑 5–10 项取消 `hidden_in_hub` 作学术橱窗。
3. 为新增 vendor 包批量补 `capability-hub-zh.json` 中文 display_name（当前 389/967 已有中文元数据）。
