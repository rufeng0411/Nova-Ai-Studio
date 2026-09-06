# Skills 重复项彻查报告（2026-06）

## 摘要

| 指标 | 清理前 | 清理后 |
|---|---:|---:|
| 目录项（catalog） | 967 | **865** |
| 磁盘镜像对（`mkt-brand-skills-*` ↔ `mkt-brand-*`） | 102 | **0** |
| 中文 `display_name` 撞名组 | 39（含 149 项批量「品牌站相关能力辅助」） | **0** |
| SKILL.md `name` 字段同名不同 slug | 112 组 | 13 组（均为**跨包有意保留**） |
| Hub 可见项 | ~670 | **584** |

验收：`npm run audit:skill-duplicates`、`npm run smoke:capability-hub` 均通过。

---

## 一、真重复（已删除）

### 1. `mkt-brand-skills-*` 镜像包（102 个目录）

**原因**：vendor `rampstackco/claude-skills` 时，上游仓库存在 `skills/skills/*` 嵌套目录，被错误打成 `mkt-brand-skills-foo`，与 `mkt-brand-foo` 内容完全一致。

**处置**：
- 已执行 `npm run remove:duplicate-brand-skills`，物理删除 102 个目录
- 已修 `scripts/vendor-skills-ecosystem.mjs`：`slugFn` 跳过 `/skills/skills/` 路径，防止再次 vendor 出双份
- `mkt-brand-*` 仍按橱窗策略：仅 16 个在营销 Tab 展示，其余 `hidden_in_hub`

---

## 二、同名不同功能（保留，已中文区分）

以下 13 组 SKILL.md 内 `name` 字段英文相同，但 **slug 前缀、场景、简介均不同**，属于多供应商整合的正常现象，**不删除**。

| 英文 name | slug 列表 | 中文区分策略 | 处置 |
|---|---|---|---|
| `competitor-analysis` | `geo-*` / `pms-*` / `mkt-aso-*` | GEO竞品 / PM·竞品 / ASO·竞品 | 保留 |
| `keyword-research` | `geo-*` / `mkt-aso-*` | GEO·挖词 / ASO·挖词 | 保留 |
| `customer-journey-map` | `pms-*` / `pmd-*` | PM·用户旅程 / 方法·用户旅程 | 保留 |
| `opportunity-solution-tree` | `pms-*` / `pmd-*` | PM·机会树 / 方法·机会树 | 保留 |
| `monetization-strategy` | `pms-*` / `mkt-aso-*`（隐藏） | PM·变现 / ASO 侧已隐藏 | 保留 |
| `marketing-ideas` | `pms-*` / `mkt-*` | PM·营销点子 / 营销点子 | 保留 |
| `roadmap-planning` | `pmd-*` / `mkt-brand-*`（隐藏） | 方法·路线图 / 品牌站·路线图 | 保留 |
| `programmatic-seo` | `mkt-*` / `mkt-brand-*` | 程序化SEO / 品牌站·程序化SEO | 保留 |
| `content-strategy` | `mkt-*` / `mkt-brand-*` | 内容策略 / 品牌站·内容策略 | 保留 |
| `xlsx` / `pptx` / `pdf` | `anth-*` / `edu-sci-*` | 办公官方包 / 科研包（科研侧隐藏） | 保留 |
| `deep-research` | `df-*` / `ala-*`（隐藏） | 深度调研 / 助手调研 | 保留 |

中文映射权威：`scripts/lib/capabilityZhAuto.mjs` → `SLUG_ZH_OVERRIDE`（约 80+ 条显式区分）。

---

## 三、pms vs pmd 同 tail（2 组，保留）

| tail | PM 包 | 方法论包 | 说明 |
|---|---|---|---|
| `customer-journey-map` | `pms-customer-journey-map` | `pmd-customer-journey-map` | Phuryn PM 工具 vs Dean Peters 工作坊式方法论，prompt 结构不同 |
| `opportunity-solution-tree` | `pms-opportunity-solution-tree` | `pmd-opportunity-solution-tree` | 同上，OST 引导粒度不同 |

两者均在脑暴 Tab 可见，中文标题已前缀区分，**不是重复项**。

---

## 四、中文撞名修复

### 根因
1. 自动生成把大量 `mkt-brand-*` 落成同一标题「品牌站相关能力辅助」
2. `resolveZhDisplayName` 优先截断 `task_summary`（12 字），导致「PM 包：策略」「品牌官网·设计」等批量撞名
3. `capability-hub-zh.json` 中 `mkt-image` 与 `tool-generate-image` 均写「营销生图」

### 修复
- 重写 `scripts/lib/capabilityZhAuto.mjs`：按完整 slug tail + 显式 override 生成唯一中文名
- `generate-capabilities-i18n.mjs`：`hasExplicitZhOverride` 路径优先使用 `auto.display_name`
- 更新 `config/capability-hub-zh.json` 中 3 处冲突文案

---

## 五、运维命令

```bash
# 审计重复（输出 artifacts/capabilities-smoke/skill-duplicates-audit.json）
npm run audit:skill-duplicates

# 若镜像包再次出现（不应再发生）
npm run remove:duplicate-brand-skills
npm run capabilities:gen

# Hub 分类回归
npm run smoke:capability-hub
```

---

## 六、后续建议

1. **vendor 后必跑** `audit:skill-duplicates`，镜像对应为 0
2. 新增跨包 skill 时，若英文 `name` 与既有项相同，须在 `SLUG_ZH_OVERRIDE` 登记中文区分
3. `edu-sci-*` 共 145 项已 `hidden_in_hub`，与 `anth-*` 办公包英文 name 重叠不影响用户可见层
4. 若再扩 `mkt-brand-*` 橱窗，从 hidden 池按场景挑选，勿恢复整包 102 项

---

---

## 七、第二轮修复（语言对齐 + 感知重复）

### 问题
1. **PM/方法论包** 约 60+ 项中文名被截成 `PM 包：test an` 等英文碎片，简介同为英文。
2. **GEO 包** 等项中文标题下 `description` 仍为英文（catalog 混排中文 summary + 英文 description）。
3. **fal-fal-*** 双前缀目录导致英文 slug 展示；与 `mkt-video` 撞名「营销视频」。
4. **营销 Tab** `mkt-content-strategy` 与 `mkt-brand-content-strategy` 等同题双卡。

### 处置
| 项 | 做法 |
|---|---|
| pms-/pmd- 全量 | 新增 `scripts/lib/pmPackZh.mjs` 117 条 tail 中文映射 |
| i18n 生成 | `finalizeZhLocale` 兜底：中文名则简介/介绍必须含中文 |
| geo-* 9 项 | `SLUG_ZH_OVERRIDE` 补全中文 description |
| fal-fal-* | 重命名 7 目录 + vendor `slugFn` 防再现 |
| 营销重复 | 橱窗移除 `mkt-brand-content-strategy`、`mkt-brand-programmatic-seo`（保留通用 `mkt-*`） |
| fal-marketing | 改名为「Fal·营销片」避免与 `mkt-video` 撞名 |

### 验收（第二轮后）
```bash
npm run audit:capability-zh-alignment   # visible: 语言不对齐 0、撞名 0
npm run audit:skill-duplicates          # zh display_name 撞名 0
```
- 可见项 **582**；可见层英文 summary/description **0**
- `zh_summaries` 覆盖率 **857/865**

*生成时间：2026-06-10 · 审计 JSON：`artifacts/capabilities-smoke/skill-duplicates-audit.json`、`capability-zh-alignment-audit.json`*
