# Skills / MCP 接入批次表（2026-06-17 · 用户确认版）

> 来源：你在 [skills-mcp-hot-recommendations-2026-06-17.md](./skills-mcp-hot-recommendations-2026-06-17.md) 勾选的 **29 项**（去重后 **26 条执行任务**）。  
> 基线：[skills-system-inventory-2026-06-17.md](./skills-system-inventory-2026-06-17.md)

---

## 批次总览

| 类型 | 条数 | 说明 |
|------|------|------|
| **A 新安装 Skill** | 14 | vendor 或 L1 写入 `skills/`，须 Hub 落位 |
| **B MCP 连通** | 2 | 虚拟卡→真实 `mcp.json`，非新 Skill |
| **C 已有包升级** | 7 | bump upstream，**勿重复安装** |
| **D 仅分类 / 模板** | 3 | 无新 skill 文件，改 taxonomy / 流程模板 |
| **E 已装·仅补分类** | 1 | `brainstorm-structured` 即 obra brainstorming |

**建议执行顺序：** C（升级）→ B（MCP Key）→ A（新装）→ E/D（分类与模板）→ `capabilities:gen` → smoke

---

## 表 1 — 新安装 Skills（需 vendor + Hub 分类）

| # | 任务类型 | 名称 | 计划 slug | 上游 | L级 | Hub 落位 | 额外 API | 执行动作 | 与现有关系 |
|---|----------|------|-----------|------|-----|----------|----------|----------|------------|
| A1 | **新装** | vercel-react-best-practices | `dev-react-best-practices` | `vercel-labs/agent-skills` · `skills/react-best-practices` | L1 | 开发 · `dev_frontend` | 无 | 扩 `vendor-skills-ecosystem` 或 `npx skills add`；**勿覆盖** `dev-next-best-practices` | 现有 `dev-next-best-practices` 误映射同路径，应拆分为 React 专精 + 保留/修正 Next |
| A2 | **新装** | frontend-design | `create-frontend-design` | `anthropics/skills` · `skills/frontend-design` | L1 | 创作 · `create_ui` | 无 | vendor 到 `creation-ecosystem` 或 L1 add；inventory 曾删，**用户明确要求恢复** | 与 `od-*` 物料层互补，不替代 Open Design |
| A3 | **新装** | firecrawl CLI 总控 + search | `fc-firecrawl` · `fc-firecrawl-search` | `firecrawl/cli` 官方包 | L2 | 营销飞轮 · 调研 · `web_fetch` | `FIRECRAWL_API_KEY` | **新建** `skills/vendor/firecrawl/` + 扩 vendor 脚本整包（建议含 scrape/build，你勾了 search+总控） | 仅有 `mcp-firecrawl` 虚拟卡，Skill 层空白 |
| A4 | **新装** | just-scrape | `web-just-scrape` | `scrapegraphai/just-scrape` | L2 | 营销 · `web_fetch` | 视子 skill 可能需 Key | vendor 到 `skills/vendor/web-scrape/`；接入前读 LICENSE | Firecrawl 降级备选栈 |
| A5 | **新装** | obra writing-plans | `method-writing-plans` | `obra/superpowers` · `skills/writing-plans` | L1 | 脑爆 · `methodology` | 无 | 扩 `vendor-skills-ecosystem` dev-ecosystem 包 | 与 A6 同套件，不同 skill |
| A6 | **新装** | supabase-postgres-best-practices | `dev-postgres-best-practices` | `supabase/agent-skills` | L2 | 开发 · `dev_backend` | Supabase 项目可选 | vendor dev-ecosystem；SaaS PG 阶段可写 admin 说明 | 本仓 PG 控制面相关，**无现成 slug** |
| A7 | **新装** | ui-ux-pro-max | `create-ui-ux-pro-max` | `nextlevelbuilder/ui-ux-pro-max-skill` | L1 | 创作 · `create_ui` | 无 | L1 add 或 creation-ecosystem | smoke 中文输出质量 |
| A8 | **新装** | remotion-best-practices（独立 slug） | `remotion-best-practices` | `remotion-dev/skills` · `skills/remotion-best-practices` | L1 | 创作 · `create_video` | 无 | 扩 `vendor-video-coding.mjs` 映射（现仅 `remotion-video`←`skills/remotion`） | 见 **表 3-C7**，升级与新 slug 同批 |
| A9 | **新装** | microsoft playwright-cli | `dev-playwright-cli` | `microsoft/playwright-cli` | L2 | 开发 · `dev_testing` | 无 | vendor dev-ecosystem；与 `dev-playwright`（testdino 源）**并存** | 你同时勾 Playwright MCP，Skill+MCP 双轨 |
| A10 | **新装** | legal-risk-assessment | `legal-risk-assessment` | `anthropics/knowledge-work-plugins` | L1 | 办公 · **`legal_compliance`** 🆕 | 无 | vendor `skills/vendor/legal/` 代表项；Hub **可见** | 与 `pms-*` NDA 类不同层 |
| A11 | **新装** | legal-response | `legal-response` | 同上 | L1 | 办公 · `legal_compliance` | 无 | 与 A10 成套；UI 加「非律师意见」免责声明 | — |
| A12 | **新装** | lawvable agent-skills | `legal-*` 前缀 | `lawvable/agent-skills` | L3 | 办公 · `legal_compliance` **hidden** | 视子 skill | 整包 vendor；Hub 仅露 A10/A11 + 1 代表 | 合规审查后默认 hidden |
| A13 | **新装** | lpm-skills | `lpm-*` 或 2 代表 slug | `legalopsconsulting/lpm-skills` | L2 | 办公 · `legal_compliance` | 无 | vendor 2–5 代表进 Hub，其余 hidden | 律所/法务 PM 场景 |
| A14 | **新装** | caveman / grill（趣味） | `edu-fun-caveman` 等 | `juliusbrussee/caveman` 等 | L1 | 教育 · **`edu_fun`** 🆕 | 无 | L1 add；标注「非课纲·趣味向」 | Hermes K12 与飞轮隔开 |
| A15 | **新装** | ai-video-generation | `create-ai-video-gen` | `qu-skills/skills/ai-video-generation` | L2 | 创作 · `create_video` 或 **`create_play`** 🆕 | 对齐 Seedance/模型池 | vendor creation-ecosystem；绑定模型池 video Key | 与 `hf-*`、Seedance 互补 |

---

## 表 2 — MCP 连通（非 Skill 新装）

| # | 名称 | 系统对照 | Hub | API | 执行动作 | mcp.json 参考 |
|---|------|----------|-----|-----|----------|---------------|
| B1 | Firecrawl MCP | 已有 `mcp-firecrawl` 卡，**未配** | 营销 · `web_fetch` | `FIRECRAWL_API_KEY` | `~/.pilotdeck/mcp.json` + SkillServices；与 A3 同 Key | `npx -y firecrawl-mcp` |
| B2 | Playwright MCP | 无 MCP；有 `dev-playwright` skill | 开发 · `dev_testing` | 无 | 添加 `@playwright/mcp` stdio；Settings 绿点验收 | 见 Microsoft 官方 README |

**注意：** B1+B2 与 A3/A9 成套验收；Firecrawl Key 一次配置两处复用。

---

## 表 3 — 已有包升级（bump，禁止当新项再装）

| # | 名称 | 现有 slug / 包 | 相对提升 | 执行命令 | 备注 |
|---|------|----------------|----------|----------|------|
| C1 | html-ppt | `html-ppt` | 主题/模板/sync upstream；Launch 已本地修复 | `npm run vendor:html-ppt` | 仅 bump `VENDOR.md` commit |
| C2 | hyperframes | `hf-*` | CLI/registry 子 skill 可能落后 | `npm run vendor:video-coding` | 对照 heygen changelog |
| C3 | marketingskills | `mkt-*` | seo-audit 等热榜项 upstream | `npm run vendor:marketing` 或 ecosystem 中 marketingskills 段 | 含 `mkt-sales-enablement` |
| C4 | seo-geo 包 | `geo-*`（7+ 项） | aaron-he-zhu 增量 | `npm run vendor:marketing` | 与 `pd-geo` 模板对齐 |
| C5 | phuryn PM | `pms-*`（68 项） | 补齐 SSL 失败项 | `npm run vendor:skills-ecosystem`（pm-skills-phuryn 段） | 非新装 |
| C6 | anthropics-skills | `anth-*` | pptx/pdf/canvas 等待 upstream | `vendor-skills-ecosystem` anthropics 段 | 可与 A2 的 frontend-design **不同 repo 路径** |
| C7 | remotion | `remotion-video` | 对齐 `remotion-best-practices` 378K 榜 | `npm run vendor:video-coding` + **新增** A8 slug 映射 | 与 A8 同批完成 |

---

## 表 4 — 仅分类 / 流程模板（无新 skill 文件）

| # | 名称 | 现有能力 | 动作 | 新建 Pill |
|---|------|----------|------|-----------|
| D1 | 销售 · battlecard 强化 | `mkt-sales-enablement`、`mkt-competitive-intel`、`pms-competitive-battlecard` | 新建 **`sales_enablement`** task_group；增 1 条流程模板「销售 battlecard 全链路」 | ✅ `sales_enablement` |
| D2 | 法律 · lawvable 包（策略） | 同 A12 | Hub 策略：大包 hidden + 代表卡 2；流程模板「法务风险快检」 | ✅ `legal_compliance`（与 A10–A13 同批注册） |
| D3 | pd-geo / Nova 模板 | `pd-geo`、`geo-*` 已装 | `npm run templates:gen` 核对 GEO 模板引用；与 `ai_search` Pill 六阶段对齐 | 不需新建 Tab |

---

## 表 5 — 已装·仅补分类（勿重复 vendor）

| # | 你勾选名 | 本仓 slug | 动作 |
|---|----------|-----------|------|
| E1 | obra brainstorming | `brainstorm-structured` | **已 vendor**（`obra/superpowers/brainstorming`）；任务 = 落位 **脑爆 · `methodology`** + `capability-hub-zh` 显示名改为「结构化脑暴（Superpowers）」；**勿再装第二份** |

---

## 表 6 — 需新建 Hub Pill（本批确认启用）

| Pill ID | 中文名 | 归属 Tab | 本批种子能力 |
|---------|--------|----------|--------------|
| `sales_enablement` | 销售赋能 | 营销飞轮 · 触达/策略 | D1 模板 + `mkt-sales-enablement` + `pms-competitive-battlecard` |
| `legal_compliance` | 法务合规 | 办公 | A10、A11 + lpm 1 代表；lawvable 大包 hidden |
| `edu_fun` | 趣味学习 | 教育学习 | A14 caveman/grill |
| `create_play` | 趣味创作（可选） | 创作 | A15 ai-video-generation；若仅归 `create_video` 则可不建 |

落位文件：`capabilityHubTaxonomy.mjs` · `capability-hub-zh.json` · `capabilities.overrides.json`

---

## 执行分期（建议）

### 第一期 · 低风险升级（1 次 PR）

```bash
npm run vendor:html-ppt
npm run vendor:video-coding      # C2 + C7 + A8 映射一并改脚本
npm run vendor:marketing         # C3 + C4
npm run vendor:skills-ecosystem  # C5 + C6 + A1/A5/A6/A9 映射扩展
npm run capabilities:gen
npm run smoke:capability-hub
```

### 第二期 · MCP + Firecrawl 栈

1. 配置 `FIRECRAWL_API_KEY`（SkillServices + mcp.json B1）
2. 新建 vendor 脚本 `vendor-firecrawl.mjs`（A3）
3. vendor just-scrape（A4）
4. 配置 Playwright MCP（B2）
5. `npm run capabilities:gen` · 对话试 `mcp__firecrawl__*` / `mcp__playwright__*`

### 第三期 · 法律 / 趣味 / 视频新装

1. vendor legal 包（A10–A13）+ 注册 `legal_compliance`
2. L1：frontend-design、ui-ux-pro-max、caveman（A2、A7、A14）
3. ai-video-generation（A15）
4. taxonomy：sales_enablement、edu_fun
5. `templates:gen`（D3）+ 销售 battlecard 模板（D1）

### 第四期 · 验收

```bash
npm run smoke:capability-hub
npm run smoke:capability-try-prompts
npm run smoke:marketing-install
npm run verify:marketing-saas
npm run smoke:templates
```

---

## 风险与去重备忘

| 项 | 说明 |
|----|------|
| `dev-next-best-practices` vs A1 | 当前 ecosystem 脚本把 `react-best-practices` 目录映射为 `dev-next-best-practices`，**命名错误**；A1 应新增 `dev-react-best-practices`，并核查 Next 专精是否另有 upstream 路径 |
| obra brainstorming vs A5 | E1 已覆盖 brainstorming；只装 writing-plans |
| remotion C7 vs A8 | 一次改 `vendor-video-coding.mjs`，同时 bump 与新增 `remotion-best-practices` slug |
| lawvable 出现 2 次 | 表 A12 + D2 合并为一条 L3 vendor + hidden 策略 |
| 销售 battlecard | **不新装 skill**；D1 分类 + 流程模板 |
| legal 免责声明 | A10/A11 须在 Hub 中文介绍与模板 prompt 中标注「非律师意见」 |

---

## 机器可读清单

见 [config/skills-selection-batch.json](../config/skills-selection-batch.json)

---

*批次整理：2026-06-17 · 待你确认「立即执行」后按分期落地*
