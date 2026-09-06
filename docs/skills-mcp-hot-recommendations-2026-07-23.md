# Skills / MCP 全网深度调研推荐表（2026-07-23）

> **前置基线**：[`skills-system-inventory-2026-06-17.md`](./skills-system-inventory-2026-06-17.md) · catalog **1269** 项（`npm run capabilities:gen` 2026-07-23）  
> **计划权威**：Skills 全网深度调研计划（2026-07-23，§十五–§十八）  
> **用法**：勾选 `[x]` 后进入 [`skills-mcp-selected-batch-2026-07-23.md`](./skills-mcp-selected-batch-2026-07-23.md) 执行 vendor；**未经用户明示禁止自动 vendor**

---

## 权威门禁（入表标准）

| 维度 | 要求 |
|------|------|
| 交叉验证 | skills.sh 安装量 + GitHub 官方 / OpenAI plugins / Skillselion **≥2 源** |
| 可核验 | 已读 SKILL.md 或官方 README |
| 与本仓 | 写清「无 / 部分重叠 / 已装·可升级」 |
| overlay | bump 后 `npm run audit:skill-overlays` **0 missing**（P0-A 已落地） |

---

## 表 A — Top60 安装量（skills.sh 基准，2026-07-17 快照 · 2026-07-23 复核）

> 安装量为 skills.sh 公开计数，随社区波动；**星级与相对排序**仍有效。完整 JSON 见 `artifacts/capabilities-smoke/skills-sh-top60-20260717.json`（门禁脚本可复扫）。

| 选 | 名称 | 地址 | 安装量（约） | 星级 | 本仓对照 | 建议动作 |
|----|------|------|-------------|------|----------|----------|
| [ ] | find-skills | vercel-labs/skills | 2.1M | ★★★★★ | `df-find-skills` 待换源 | **替换** → 官方 |
| [ ] | frontend-design | anthropics/skills | 561K | ★★★★★ | 无 | P1 新增 |
| [ ] | vercel-react-best-practices | vercel-labs/agent-skills | 485K | ★★★★★ | 部分 `dev-next-*` | P1 cherry-pick |
| [ ] | agent-browser | vercel-labs/agent-browser | 461K | ★★★★★ | 无 | batch_browser ✓ |
| [ ] | remotion-best-practices | remotion-dev/skills | 378K | ★★★★☆ | `remotion-*` 已装 | **升级** |
| [ ] | ai-video-generation | qu-skills | 306K | ★★★☆☆ | 部分 seedance/hf | 观察 |
| [ ] | caveman | juliusbrussee/caveman | 261K | ★★★☆☆ | 无 | 教育趣味 P2 |
| [ ] | obra brainstorming | obra/superpowers | 230K | ★★★★☆ | `brainstorm-structured` | batch_dev_quality ✓ |
| [ ] | lark-okr | 飞书官方 | 231K | ★★★★☆ | 无 | 批次未选 |
| [ ] | supabase-postgres | supabase/agent-skills | 239K | ★★★★☆ | 无 | batch_devops_security ✓ |
| [ ] | just-scrape | scrapegraphai | 196K | ★★★★☆ | `web-just-scrape` 已装 | **升级** |
| [ ] | shadcn/ui | shadcn/ui | 196K | ★★★★☆ | 无 | batch_frontend ✓ |
| [ ] | ui-ux-pro-max | nextlevelbuilder | 223K | ★★★☆☆ | `create-ui-ux-pro-max` | **升级** |
| [ ] | hyperframes | heygen-com/hyperframes | 103K | ★★★★☆ | `hf-*` 已装 | **升级** + gate |
| [ ] | firecrawl CLI | firecrawl/cli | 58–76K/项 | ★★★★★ | `fc-*` 已装 | **升级** |
| [ ] | seo-audit | marketingskills | 140K | ★★★★★ | `mkt-seo-audit` | 勿重复装 |
| [ ] | copywriting | marketingskills | 71K | ★★★★★ | `mkt-copywriting` | 保留 bump |
| [ ] | pptx | anthropics/skills | 150K | ★★★★★ | `anth-pptx` | bump |
| [ ] | pdf | anthropics/skills | 137K | ★★★★★ | `anth-pdf` | bump |

（表 A 续项 20–60 见 2026-06-17 版 [`skills-mcp-hot-recommendations-2026-06-17.md`](./skills-mcp-hot-recommendations-2026-06-17.md) 表 A；本批增量见 §十七 仿写/蒸馏、§十四 媒体）

---

## 表 B — P1 新增（2026-07-23 确认）

| 选 | 名称 | slug | Hub | 批次 | 安装量/依据 |
|----|------|------|-----|------|-------------|
| [x] | **quill 羽笔** | `writing-quill` | 创作·polish | batch_copy_rewrite_distill ✓ | 中文社区热 |
| [x] | **avoid-ai-writing** | `writing-avoid-ai` | 创作·polish | 同上 | v3.18 · 21 类规则 |
| [x] | **skill-creator 官方** | `skill-creator` | 开发·dev_platform | 同上 | anthropics 官方 |
| [x] | **claude-ads** | `mkt-claude-ads` | **媒体·数字** | batch_paid_media_ops ✓ | AgriciDaniel |
| [x] | **cn-ads-skills** | `mkt-cn-ads-*` | **媒体·数字** | 同上 | linxumoney |
| [x] | **tribo OOH** | `mkt-ooh-strategy` | **媒体·户外** | batch_media_planning ✓ | dmend3z/tribo-skills |
| [x] | **produce-ooh** | `mkt-produce-ooh` | **媒体·户外** | 同上 | ClaudSkills（SPDX 审查） |

---

## 表 C — 媒体 Tab 架构（已落地 taxonomy）

| L1 Tab | L2 | L3 示例 | 双入口 slug |
|--------|-----|---------|-------------|
| **媒体** | 户外 `media_ooh` | ooh_brief → … → ooh_measure | `mkt-campaign-plan`、`mkt-ad-creative` |
| **媒体** | 数字 `media_digital` | dig_brief → … → dig_report | `mkt-ads`、`mcp-ads` |

- **8 Tab 顺序**：营销 → **媒体** → GEO → 办公 → 创作 → 开发 → **脑爆** → 教育  
- **回滚**：`VITE_HUB_MEDIA_TAB=0`  
- **验收**：`npm run smoke:capability-hub`（含 media 步进非空）

---

## 表 D — 已装·建议升级（batch_upgrade_only）

| 包 | 命令 | overlay 后验 |
|----|------|-------------|
| `anth-docx` | `node scripts/vendor-anthropics-docx.mjs` | `audit:skill-overlays` |
| `hf-*` | `npm run vendor:video-coding` | hf NOVA-EXEC + `test:hyperframes:unit` |
| `mkt-*`/`geo-*` | `npm run vendor:marketing` | `verify:marketing-saas` |
| `fc-*` | `npm run vendor:firecrawl` | smoke:skills-batch |
| `html-ppt` | `npm run vendor:html-ppt` | launch:check |
| `pms-*` | `npm run vendor:skills-ecosystem` | 补 SSL 失败项 |
| `humanizer` | writing-polish bump | 与 quill/avoid-ai 并存 |

---

## 表 E — 替换对照（slug 去重）

| 旧 | 新 | 批次 |
|----|-----|------|
| `df-find-skills` | vercel find-skills 官方 | batch_upgrade_only ✓ |
| `df-skill-creator` | `skill-creator` 官方 | batch_copy_rewrite_distill ✓ |
| `dev-playwright`（旧） | microsoft/playwright-cli | batch_browser ✓ |
| openai/skills 整包 | openai/plugins codex 子集 | batch_office_legal ✓ |
| obra superpowers（Hub） | superpowers-zh 代表 | batch_superpowers_zh ✓ |

**去重审计**：`npm run audit:skill-duplicates` → `artifacts/capabilities-smoke/skill-duplicates-audit.json`（2026-07-23：frontmatter 同名组 120，中文 display_name 组 94，多为 lawvable/lpm 大包 intentional hidden）

---

## 表 F — 智能仿写 + 蒸馏（§十七）

| slug | 角色 | 与 humanizer/unslop |
|------|------|---------------------|
| `writing-quill` | 6 维文风 + 仿写 + 蒸馏 Skill 卡 | **Hub 主露** |
| `writing-avoid-ai` | 去 AI 味加强版 | **Hub 主露** |
| `skill-creator` | Skill 元蒸馏 / eval | 替换 df-skill-creator |
| `humanizer` | 保留 bump | 卡片可折叠 |
| `unslop` | 保留 | 卡片可折叠 |

---

## 表 G — 视频能力路由（§18.6）

| 用户意图 | 主 skill | 禁止误用 |
|----------|----------|----------|
| 官网 promo / HTML 动效成片 | `hf-hyperframes` → `render_hyperframes` | 单次失败降级 `generate_video` |
| Remotion 产品宣传片 | `create-video-shotcraft` | 替代 HyperFrames 官网片 |
| 真 AI 文生视频 | `generate_video` | `render_html_video` 单次即降级 |
| md 转 PPT 无视觉诉求 | `export_document` / anth-pptx | html-ppt 默认 |

---

## 表 H — 明确不推荐

| 项 | 原因 |
|----|------|
| openai/skills 整包 | **deprecated** → plugins |
| playwright-interactive | 废弃，改 playwright-cli |
| batch_design_stitch | **待定**（Google stitch-skills） |
| tribo programmatic/DSP | 用户仅选户外 |
| postiz-agent / xiaohongshu-mcp | 历史排除 |

---

## 附录 — 验收命令（P0–P1）

```bash
npm run audit:skill-overlays      # P0-A 已绿
npm run audit:skill-duplicates
npm run capabilities:gen
npm run smoke:capability-hub      # 含 media Tab
npm run test:hyperframes:unit     # 动 hf-* 时
npm run verify:marketing-saas     # 动 mkt/geo 时
```

**HyperFrames 全量 gate**（bump 后）：`test:hyperframes:unit` → `test:hyperframes:gate` → `test:hyperframes:official:verify`
