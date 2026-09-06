# Open Design 技能整合 - 管理员说明文档

本文面向项目管理员与维护者，说明整合结构、联调验证、运维操作与排障路径。

## 0. Fork 改动隔离标准（能力中心专项）

本仓会持续拉取 OpenBMB/PilotDeck 上游代码，能力中心相关改动必须遵循以下隔离规范，避免后续合并冲突扩大。

### 0.1 适用边界

- OP 核心：`src/*`、`ui/*`（上游主线）
- OD 移植：`skills/open-design`、`skills/od-*`（会继续从 Open Design 同步）

### 0.2 改动原则

- **优先新增文件**：能力中心相关逻辑优先放在新 route、新组件、新脚本、新配置中。
- **最小接线**：仅在必须接线的位置修改 OP 核心，禁止重构既有技能管理协议。
- **哨兵注释**：每处 OP 核心改动都必须包裹以下注释，方便 rebase 定位：

```ts
// >>> pilotdeck-fork: capability-hub
// ...
// <<< pilotdeck-fork
```

- **不改 SkillManager 协议**：不修改 `skill_list` / `skill_read` 协议字段，不扩展 `SkillSummary`。
- **不改 SKILL.md 既有字段语义**：能力中心元数据走旁路注册表（`config/capabilities.overrides.json`）。

### 0.3 第三方 skills vendoring 规范

- vendored 目录固定为：`skills/vendor/<source>/<slug>/`
- 每个 source 必须附：
  - `skills/vendor/<source>/LICENSE`
  - `skills/vendor/<source>/ATTRIBUTION.md`
- 先校验许可证能否再分发；若不可再分发，改用「本地安装脚本」而非入库。
- 为避免 bootstrap 重名丢弃，叶子目录 slug 统一加 source 前缀（例如 `df-deep-research`）。

### 0.4 Fork 改动登记表（必须维护）

当发生能力中心相关改动时，在下表登记；新增/修改都要更新「变更摘要」和「日期」。

| 模块 | 文件路径 | 改动类型 | 哨兵注释 | 变更摘要 | 日期 |
|---|---|---|---|---|---|
| Tab 类型 | `ui/src/types/app.ts` | 接线 | 是 | 新增 `discover` tab | 2026-06-01 |
| 顶部工具栏 | `ui/src/components/app-shell/MainAreaV2.tsx` | 接线 | 是 | 新增能力中心入口 | 2026-06-01 |
| 主内容路由 | `ui/src/components/main-content/view/MainContent.tsx` | 接线 | 是 | 放行无项目访问 + discover 渲染 | 2026-06-01 |
| 服务端路由注册 | `ui/server/index.js` | 接线 | 是 | 注册 `/api/capabilities` | 2026-06-01 |
| 欢迎页引导 | `ui/src/components/chat-v2/ChatInterfaceV2.tsx` | UI | 是 | 欢迎 chips 改为动态能力建议 | 2026-06-01 |
| 会话空态建议 | `ui/src/components/chat-v2/MessagesPaneV2.tsx` | UI | 是 | 新会话建议改为能力中心建议 | 2026-06-01 |
| 多语言文案 | `ui/src/i18n/locales/zh-CN/common.json`、`ui/src/i18n/locales/en/common.json` | 文案 | 否 | 新增 `tabs.discover` | 2026-06-01 |
| 蚁小二 L2 | `skills/yixiaoer/`、`scripts/sync-yixiaoer-skill.mjs`、`scripts/yixiaoer-api.mjs` | 新增 | 否 | 国内社媒发布 Skill | 2026-06-01 |
| 蚁小二文档 | `docs/yixiaoer-admin-guide.md`、`docs/yixiaoer-prompt-examples.md` | 文档 | 否 | 管理员/用户手册 | 2026-06-01 |
| 能力中心 | `config/capabilities.overrides.json` | 配置 | 否 | yixiaoer → 发布分发 L2 | 2026-06-01 |
| anth-docx L2 | `skills/vendor/anthropics-skills/anth-docx/`、`scripts/vendor-anthropics-docx.mjs` | 新增 | 否 | Word docx 正式交付 | 2026-06-01 |
| docx 文档 | `docs/docx-admin-guide.md`、`docs/docx-prompt-examples.md` | 文档 | 否 | 管理员/用户手册 | 2026-06-01 |
| 能力中心 | `config/capabilities.overrides.json` | 配置 | 否 | anth-docx → 创意内容 L2 | 2026-06-01 |
| 流程模板 | `config/process-templates.json`、`ui/src/components/process-templates/` | 新增 | 否 | 12 条端到端流程模板 + 试一下注入 | 2026-06-02 |
| 流程模板 API | `ui/server/routes/processTemplates.js` | 新增 | 否 | GET /api/process-templates | 2026-06-02 |
| AI 搜索可见度 L2 | `skills/pd-geo/`、`scripts/aigeo-*.mjs`、`src/tool/builtin/geoApi.ts` | 新增 | 是 | GEO 技能 + geo_api + 3 条流程模板 | 2026-06-02 |
| GEO 文档 | `docs/aigeo-admin-guide.md`、`docs/aigeo-user-guide.md`、`docs/aigeo-prompt-examples.md` | 文档 | 否 | 管理员/用户手册 | 2026-06-02 |

## 1. 整合结构

## 代码位置

- 总控技能：`skills/open-design/`
- 表面技能：`skills/od-*/`（见下文完整列表）
- 用户提问手册：`docs/open-design-prompt-examples.md`（无技术术语）
- 迁移脚本：`scripts/port-open-design-skill.mjs`（Windows 需 `fileURLToPath` 路径，已修复）
- 实机联调脚本：`scripts/integration-open-design-smoke.mjs`
- 媒体能力验收脚本：`scripts/integration-media-smoke.mjs`

## 关键资源

- 设计系统索引（完整 150 套）：`skills/open-design/references/design-systems/_index.md`
- 静态帮助目录（随接入更新）：`docs/open-design-design-catalog.md`
- 同步设计系统：`node scripts/sync-open-design-systems.mjs`
- 重新生成本目录文档：`node scripts/generate-open-design-catalog.mjs`
- 设备框架：`skills/open-design/assets/frames/*.html`
- 署名与许可：`skills/open-design/references/ATTRIBUTION.md`

### 表面技能一览（`skills/od-*`）

| 技能目录 | 用途 |
|----------|------|
| `od-saas-landing` | 官网/落地页/产品介绍 |
| `od-pricing-page` | 定价与套餐对比 |
| `od-pricing-upgrade` | 升级会员/付费墙 |
| `od-dashboard` | 后台/数据看板 |
| `od-data-report` | 数据汇报摘要 |
| `od-mobile-app` | 手机 App 界面 |
| `od-mobile-onboarding` | 新用户引导 |
| `od-login-flow` | 登录/注册/验证码 |
| `od-email-marketing` | 营销邮件版面 |
| `od-social-carousel` | 社媒多图轮播 |
| `od-faq-page` | 帮助中心/常见问题 |
| `od-article-magazine` | 杂志风长文 |
| `od-poster-hero` | 竖版海报/分享长图 |
| `od-wireframe-sketch` | 线框结构草图 |
| `od-deck-magazine` | 杂志风横屏演示稿 |
| `od-release-notes-one-pager` | 版本发布说明 |
| `od-resume` | 求职简历页 |
| `od-after-hours-editorial` | 夜间编辑部品牌故事 |
| `od-field-notes-editorial` | 调研观察笔记 |
| `od-editorial-burgundy` | 勃艮第原则宣言 |
| `od-digits-fintech` | 金融/数据气质页 |
| `od-research-decision-room` | 研究决策看板 |
| `od-swiss-creative` | 创意作品集 |
| `od-swiss-user-research-video` | 用户研究视频脚本页 |
| `od-weread-year-in-review-video` | 年度回顾叙事页 |
| `od-8bit-orbit-video` | 8-bit 故事板页 |
| `od-web-artifacts-builder` | 页面精修打磨 |
| `od-waitlist-page` | 候补名单 / 预发布页 |
| `od-web-prototype` | 高保真网页原型 |
| `od-team-okrs` | 团队 OKR 页 |
| `od-kanban-board` | 看板任务板 |
| `od-meeting-notes` | 会议纪要页 |
| `od-docs-page` | 文档站点页 |
| `od-blog-post` | 博客文章页 |
| `od-finance-report` | 财务报告页 |
| `od-hr-onboarding` | 入职引导页 |
| `od-pm-spec` | 产品规格 / PRD 页 |
| `od-gamified-app` | 游戏化应用界面 |
| `od-deck-swiss` | 瑞士国际主义 HTML Deck |
| `od-social-x-card` | X（Twitter）分享卡 |
| `od-creative-director` | 创意审稿（Hub 隐藏） |
| `od-wireframe-mobile-flow` | 手机流程线框（Hub 隐藏） |

另：`skills/frontend-slides` 用于简洁风横屏演示（非 `od-` 前缀）。

### 部分集成分轨（2026-08-03）

| 轨 | 内容 | 入口 |
|----|------|------|
| **B 精选场景** | 上表新增 `od-*`，STDA `artifacts/task-*`，中文名经 `capabilityZhAuto` | Hub「创作 · 网页与原型」等 |
| **C 模板影子** | `config/open-design-template-registry.json`，默认 Hub 不可见 | Flag `PILOTDECK_OD_TEMPLATE_REGISTRY=off\|shadow\|1`；文档 `docs/open-design-template-registry.zh-CN.md` |

```bash
node scripts/port-open-design-batch-b.mjs          # 重放 Batch B + STDA 归一
node scripts/generate-open-design-template-registry.mjs
npm run capabilities:gen
npm run smoke:od-skills
```

**禁止**：整包 port 官网 100+ 模板进 Hub；接 OD daemon / marketplace UI。

## 2. 同步机制

PilotDeck 启动或执行 bootstrap 时会把仓库 `skills/` 同步到用户目录 `~/.pilotdeck/skills`。

手动同步命令：

```bash
node scripts/bootstrap-pilotdeck-config.mjs
```

验证同步日志应包含：

- `Synced repo skills into ...`
- 新增或跳过统计

## 3. 联调与实机测试（已落地）

## 执行命令

```bash
node scripts/integration-open-design-smoke.mjs
node scripts/integration-media-smoke.mjs
```

## 测试场景

- `landing-open-design`
- `login-flow`
- `release-notes`

## 测试产物

- 报告：`artifacts/od-smoke/report.json`
- 页面产物：
  - `artifacts/od-smoke/landing-open-design.html`
  - `artifacts/od-smoke/login-flow.html`
  - `artifacts/od-smoke/release-notes.html`
- 媒体产物：
  - `artifacts/media-smoke/smoke-image.png`
  - `artifacts/media-smoke/smoke-video.mp4`
  - `artifacts/media-smoke/smoke-html-video.mp4`
  - `artifacts/media-smoke/report.json`

说明：本次实机链路里出现了网关流式响应超时（脚本侧 180s timeout），但三条场景均成功执行到 `write_file` 并落地产物文件，属于“可用但响应收尾需优化”的状态。

## 4. 媒体与 Figma 接入

### 4.1 能力配置（`pilotdeck.yaml`）

```yaml
tools:
  image:
    provider: openai-compatible
    apiKey: ${OPENAI_API_KEY}
    baseUrl: https://api.openai.com/v1
    model: gpt-image-1
  video:
    provider: openai-compatible
    apiKey: ${OPENAI_API_KEY}
    baseUrl: https://api.openai.com/v1
    model: sora
```

支持 provider：`openai-compatible / google / qwen / volcengine / baidu / azure / cloud`。

### 4.2 Figma MCP（项目或全局）

在 `~/.pilotdeck/mcp.json` 或项目 `.pilotdeck/mcp.json` 添加（示例）：

```json
{
  "figma": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "figma-developer-mcp", "--stdio"],
    "env": {
      "FIGMA_TOKEN": "${FIGMA_TOKEN}"
    }
  }
}
```

接入后工具会自动暴露为 `mcp__figma__*`。

## 5. 管理员日常操作

## 新增长尾技能

```bash
node scripts/port-open-design-skill.mjs <open-design-skill-slug> [target-skill-slug]
```

示例：

```bash
node scripts/port-open-design-skill.mjs frontend-design od-frontend-design
```

脚本行为：

- 从 `OpenDesign/skills/<slug>` 迁移 `SKILL.md`
- 清洗 Open Design 扩展 frontmatter（保留兼容字段）
- 复制 `assets/` 与 `references/`（若存在）

## 重新同步

```bash
node scripts/bootstrap-pilotdeck-config.mjs
```

## 网关可见性验证

通过 WS `skill_list` / `skill_read` 验证新技能可见并可读。

## 6. 排障指南

## 症状 A：技能看不到

排查顺序：

1. 执行 bootstrap 同步命令。
2. 检查 `skills/<skill>/SKILL.md` 是否存在且有 `name`/`description` frontmatter。
3. 用 `skill_list` 确认网关返回。

## 症状 B：技能被调用但不落地 HTML

排查顺序：

1. 查看是否触发了 `write_file`。
2. 检查提示是否含“直接执行，不要提问”（避免进入长问答环节）。
3. 检查 `workspaceCwd` 与输出路径是否正确。

## 症状 C：联调脚本超时

可能原因：

- 模型推理耗时较长，`submit_turn` 长流未及时返回 response 收尾。
- 场景 prompt 过于复杂。

建议：

- 调高脚本 `STAGE_TIMEOUT_MS`。
- 保持“直接执行，不要提问”。
- 先验证 `write_file` 落地，再优化流式收尾判定。

## 7. 许可证与合规

- Open Design 上游：Apache-2.0
- 本仓库保留来源与说明于 `skills/open-design/references/ATTRIBUTION.md`
- 迁移范围仅限技能资源与方法论，不包含其 daemon/web/Electron 运行时实现

## 8. 静态帮助目录维护（必做）

当发生以下任一变更时，更新 `docs/open-design-design-catalog.md`：

1. 新增/删除/重命名 `skills/od-*` 或调整 `scripts/generate-open-design-catalog.mjs` 内 `CATEGORIES`
2. 从上游同步设计系统后
3. 用户提问示例策略变化（同步改 `docs/open-design-prompt-examples.md`）

```bash
node scripts/sync-open-design-systems.mjs
node scripts/generate-open-design-catalog.mjs
```

## 9. 推荐维护节奏

- 每周一次：跑 `integration-open-design-smoke.mjs` 回归。
- 每次新增 `od-*` 技能后：立即 bootstrap + smoke + 重新生成 catalog。
- 每次发现“AI味”回归：优先调整 `open-design/references/anti-slop-checklist.md` 与 `critique.md`，再改表面技能。

## 10. 能力中心（Capability Hub）运维命令

能力中心以 `config/capabilities.overrides.json` 作为分类增强源，`config/capabilities.catalog.json` 作为生成产物，运行时由 `/api/capabilities` 与 `skill_list` 合并。

### 10.1 初始化/重拉第三方 L1 技能

```bash
node scripts/vendor-l1-skills.mjs
node scripts/bootstrap-pilotdeck-config.mjs
```

### 10.2 生成能力目录

```bash
node scripts/generate-capabilities-catalog.mjs
```

### 10.3 冒烟校验（必须通过）

```bash
node scripts/integration-capabilities-smoke.mjs
```

通过标准：

- `missingInCatalog = 0`
- `staleInCatalog = 0`
- `emptyStages = 0`
- 输出报告：`artifacts/capabilities-smoke/report.json`

