# 流程模板 — 管理员指南

流程模板（Process Templates）是叠在 PilotDeck **对话式架构之上**的辅助层：帮用户一键填入「一次对话跑完整个项目」的主提示词。不改 Agent / router / 执行逻辑。

用户说明：对话空态与输入框「流程模板」按钮；使用方式同能力中心「试一下」。

---

## 路径一览

| 路径 | 用途 |
|------|------|
| `config/process-templates.json` | 管理员维护的唯一源（12 条模板，轻量/标准/全案） |
| `scripts/generate-process-templates.mjs` | 校验 + 生成前端 bundle 与目录文档 |
| `ui/src/generated/process-templates.json` | 前端离线兜底 bundle |
| `ui/server/routes/processTemplates.js` | `GET /api/process-templates?locale=` |
| `ui/src/components/process-templates/` | Gallery + Dialog UI |
| `docs/process-templates-catalog.zh-CN.md` | 自动生成目录 |

---

## 维护流程

```bash
# 编辑 config/process-templates.json 后
node scripts/generate-process-templates.mjs
npm run smoke:templates
```

`prebuild` 已包含 `generate-process-templates.mjs`。

---

## 配置字段

每条 `templates[]` 项：

| 字段 | 说明 |
|------|------|
| `id` | 唯一 slug |
| `complexity` | `light` \| `standard` \| `full` |
| `title` / `outcome` / `scenario` / `outputs` | 双语 `{ "zh-CN", "en" }` |
| `stageBadges[]` | 飞轮阶段 id（展示用） |
| `relatedSkills[]` | 须在 `capabilities.catalog.json` 中存在 |
| `flow[]` | `{ step, title{}, skill }` 逐步说明（卡片主篇幅） |
| `prompt{}` | 「试一下」注入的主提示词，含 `【占位符】` |

生成器会校验：id 唯一、双语完整、flow ≥2 步、prompt 含编号步骤、`relatedSkills` 在 catalog 中。

---

## 与能力中心分工

| | 能力中心 | 流程模板 |
|---|---------|---------|
| 粒度 | 单个原子能力 | 多能力编排的完整项目 |
| 卡片 | 紧凑 | 更大，含流程链路说明 |
| 交互 | 试一下 → 注入 | 同上，复用 `injectCapabilityPrompt` |

---

## Fork 改动登记

| 模块 | 路径 | 类型 | 说明 | 日期 |
|------|------|------|------|------|
| 流程模板 | `config/process-templates.json`、`ui/src/components/process-templates/` | 新增 | 12 条端到端流程模板 | 2026-06-02 |
| API | `ui/server/routes/processTemplates.js` | 新增 | GET /api/process-templates | 2026-06-02 |
| 文档 | `docs/process-templates-admin-guide.md` | 文档 | 管理员指南 | 2026-06-02 |
