# GEO 能力中心管理员指南

## 概览

能力中心第 **7** 个 Tab **GEO / AI 搜索**，二级为专业六段：`geo_baseline` → `geo_strategy` → `geo_citability` → `geo_technical` → `geo_distribution` → `geo_monitor`。

营销 Tab **已移除「AI搜索」Pill**；GEO 能力仅在 GEO Tab 展示。

## 监测三层栈

| 层 | 能力 | 产出 |
|----|------|------|
| L1 采集 | geo-visibility-probe、mcp-agent-aeo、geo-rank-track、mkt-brand-mention | 原始探测数据 |
| L2 聚合 | geo-monitor-hub | monitor-data.json |
| L3 呈现 | geo-monitor-report | monitor-report.md + geo-monitor-report.html |

Schema：`config/geo-monitor-schema.json`（含 **`llm_coverage`** 主流大模型收录矩阵：`models` / `gaps` / `optimization`）

### 主流大模型收录（单一事实源）

**必测 11 模型（硬约束）** — 见 [`config/geo-llm-coverage-required-models.json`](../config/geo-llm-coverage-required-models.json)：

| 国内 | 国外 |
|------|------|
| 豆包 · DeepSeek · 千问 · 百度文心 · Kimi · **腾讯元宝** | OpenAI · Gemini · Claude · Grok · Meta AI |

缺 Key 时仍须 `skipped` 占位，不得省略行。

| 层 | 职责 |
|----|------|
| geo-visibility-probe | 逐模型探测 → `llm_coverage`（见 `skills/geo-visibility-probe/references/llm-coverage-matrix.md`） |
| geo-monitor-hub | 合并 probe + AgentAEO，**不重复全量探测** |
| geo-monitor-report | MD/HTML 呈现收录分析与优化建议 |

**不重复矩阵**：`mkt-brand-mention`（公开舆情）、`geo-competitor-analysis`（竞品差距报告）、`pd-geo` verification-plan（快检 10 问句）均不含九模型全量矩阵。

## 分析报告 MD + HTML 双交付

凡 GEO Tab 下产出**报告/分析类** Markdown（审计、调研、竞品、可引用性、技术、绩效等），须 **先完成 MD 落盘**，再同步生成**同名 HTML** 专业仪表盘（Chart.js 图表、KPI 卡、CSS 动效）。

**硬顺序**：`write_file *.md` → `read_file` 确认 → `read_skill geo-dual-report` → `write_file *.html`。禁止未写 MD 先写 HTML。

| 组件 | 路径 |
|------|------|
| 全局策略 | `config/deliverable-derivation.manifest.json` |
| 绑定表 | `config/geo-dual-report.manifest.json` |
| 同步 skill | `geo-dual-report`（模板 `skills/geo-dual-report/templates/geo-report-base.html`） |
| 监测专用 | `geo-monitor-report` → `geo-monitor-report.html`（不共用通用模板） |

**不强制 HTML**：成稿正文 `optimized.md`、平台 drafts、`llms.txt`、`schema.jsonld`、`verification-plan.md`。

流程模板「基线调研包」「技术结构包」「可见度快检」「可引用内容优化」等已写入 MD+HTML 清单；Hub「试一下」经 `appendHtmlPairsToDeliverables` 自动扩展 HTML 对。

## 报告视觉规范（NGRS v1）

GEO HTML 报告统一使用 **Nova GEO Report System**：

| 资源 | 路径 |
|------|------|
| 设计规范 | `docs/geo-report-design-system.zh-CN.md` |
| Theme 配置 | `config/geo-report-design-system.json` |
| ChartCatalog | `config/geo-chart-catalog.json` |
| CSS / JS | `skills/geo-dual-report/templates/geo-report-theme.css`、`geo-chart-theme.js` |

验收：`npm run smoke:geo-report-design`

## Key 分层（管理员配置）

| 层级 | 必需配置 | 说明 |
|------|----------|------|
| MVP | 模型池 + 博查联网 + Python | 规则分 + 国内 probe，HTML 仍可出页 |
| 标准 | + AGENTAEO_API_KEY + geo-visibility-probe | 四引擎 citation / SOV |
| 完整 | + MCP geo-optimizer + monitorHistoryDir | 趋势对比与深度审计 |

### 配置项

| 配置项 | 路径/变量 | 关联能力 |
|--------|-----------|----------|
| 对话模型池 | `model.providers.*` | 全部 GEO |
| 联网搜索 | `tools.webSearch.provider: bocha` + `BOCHA_API_KEY` | pd-geo、probe |
| GEO 数据目录 | `tools.geo.dataDir` | pd-geo / geo_api |
| AgentAEO | `AGENTAEO_API_KEY` + `@agentaeo/mcp-server` | mcp-agent-aeo、监测完整度 |
| geo-optimizer MCP | `mcp.json` Python 模块 | mcp-geo-optimizer |
| ai-seo-mcp | `mcp.json` npx 包 | mcp-ai-seo |
| 监测历史 | `tools.geo.monitorHistoryDir` | geo-monitor-weekly |

示例 MCP 片段见 `products/_example/config/mcp.json.example`。

## 验收命令

```bash
npm run capabilities:gen
npm run smoke:geo-hub
npm run smoke:geo-monitor-report
npm run smoke:geo-dual-report
npm run smoke:geo-report-design
npm run smoke:geo-llm-coverage-required
npm run verify:geo-saas
```
