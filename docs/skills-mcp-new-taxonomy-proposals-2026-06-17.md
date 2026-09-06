# 新建 Hub 子类 Pill 提案（2026-06-17）

> 仅当推荐表勾选项 **无法** 归入现有 Pill 时启用。执行前须用户确认子类 ID 与中文名。

---

## 提案总表

| 选 | 子类 ID | 中文 Pill 名 | 归属 Tab | 种子能力（≥3） | hidden 策略 |
|----|---------|--------------|----------|----------------|-------------|
| [ ] | `sales_enablement` | 销售赋能 | 营销飞轮·触达/策略 | `mkt-sales-enablement`、battlecard 类、销售话术模板 | 可见 |
| [ ] | `legal_compliance` | 法务合规 | 办公 | `legal-risk-assessment`、`legal-response`、lpm 代表 1 项 | **默认 hidden 大包**，Hub 露 2 卡 |
| [ ] | `hr_ops` | 人力资源 | 办公 | （待 vendor HR 包或 MCP） | 可见 |
| [ ] | `enterprise_mgmt` | 企业管理 | 办公 | `lark-okr`（若接飞书）、pms OKR 类 | 可见 |
| [ ] | `edu_fun` | 趣味学习 | 教育学习 | caveman/grill 类（趣味向） | 可见，标注非课纲 |
| [ ] | `create_play` | 趣味创作 | 创作 | ai-video-generation、趣味 HTML 类 | 可见 |

---

## 落位文件（确认后修改）

| 文件 | 改动 |
|------|------|
| [scripts/lib/capabilityHubTaxonomy.mjs](../scripts/lib/capabilityHubTaxonomy.mjs) | 注册 `category_subtag` / `task_group` + slug 映射 |
| [config/capability-hub-zh.json](../config/capability-hub-zh.json) | Pill 中文名与子类说明 |
| [config/capabilities.overrides.json](../config/capabilities.overrides.json) | `hidden_in_hub`、学段、阶段 |
| — | `npm run capabilities:gen` |

---

## 与现有体系关系

- **AI 搜索**：已有 `ai_search` Pill 六阶段双归属，**不需新建**
- **爬虫**：已有 `web_fetch`，Firecrawl/just-scrape 归入即可
- **脑爆**：已有 `methodology`；obra superpowers 可并入，不必新 Tab

---

*提案随推荐表勾选更新；未勾选前勿改 taxonomy 代码。*
