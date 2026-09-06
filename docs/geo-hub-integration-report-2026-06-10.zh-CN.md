# GEO 独立 Tab 整合报告（2026-06-10）

## 变更摘要

- 能力中心 **七 Tab**：营销之后新增 **GEO / AI 搜索**
- GEO **六段 L2** 步进器（无 L3 Pill）
- 营销飞轮 **移除 ai_search Pill**；`pd-geo` 与全部 geo/mkt-ai-seo 等迁至 `major_category: geo`
- 新增 skills：`geo-monitor-hub`、`geo-monitor-report`、`geo-cn-crawlers`、`geo-visibility-probe`
- Vendor 扩展：aaron content-gap / serp / backlink / performance-reporter
- MCP 虚拟能力：`mcp-geo-optimizer`、`mcp-ai-seo`、`mcp-agent-aeo`
- 监测 **双交付**：monitor-report.md + geo-monitor-report.html + monitor-data.json
- 流程模板：升级 `geo-monitor-loop`；新增 baseline/technical/monitor-dashboard/weekly 共 4 条

## 验收结果

| 命令 | 结果 |
|------|------|
| `npm run capabilities:gen` | 通过 |
| `npm run smoke:geo-hub` | 通过 |
| `npm run smoke:geo-monitor-report` | 通过 |
| `npm run templates:gen` | 39 条模板 |

## 文档

- 管理员：`docs/geo-hub-admin-guide.zh-CN.md`
- Taxonomy：见 `scripts/lib/capabilityHubTaxonomy.mjs` 中 `GEO_FLYWHEEL_STAGE_IDS`
