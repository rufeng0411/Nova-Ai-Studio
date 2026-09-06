# 营销 SaaS 深度验收报告

生成时间：2026-06-07

## 摘要

- **verify:marketing-saas**：catalog 355 项、中文 display_name 355/355
- **六阶段 AI搜索 Pill**：均已非空（pd-geo 双归属 brand_geo + ai_search）
- **新 vendor**：seo-geo 7 项 + geo-aeo-audit + geo-citability + knowledge-work 6 项
- **办公 MCP 虚拟卡**：mcp-google-workspace、mcp-notion-collab、mcp-similarweb 已上架（待配置）

## 跑测缺项（MCP 须用户配置）

详见 **[marketing-install-readiness.zh-CN.md](./marketing-install-readiness.zh-CN.md)**。

| 类型 | 说明 |
|------|------|
| 虚拟 MCP | Similarweb / Google 套件 / Notion 须在设置中填 Key 或 OAuth |
| L1 Skills | 零配置可读；对话内提供 URL/品牌名即可使用 |

## 命令

```bash
npm run vendor:marketing
npm run capabilities:gen
npm run verify:marketing-saas
```

## 产物

- `artifacts/marketing-saas-smoke/install-readiness.json`
- `artifacts/marketing-saas-smoke/deep-report.json`
- `artifacts/capabilities-smoke/taxonomy-audit.json`
