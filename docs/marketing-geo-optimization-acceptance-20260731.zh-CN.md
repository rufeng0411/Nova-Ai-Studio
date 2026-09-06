# 整站 GEO / AEO 优化验收报告（2026-07-31）

## 结论

| 级 | 裁决 | 说明 |
|----|------|------|
| L0 | **PASS** | `test:marketing-site:unit` + `check:marketing-seo`（2026-07-31） |
| L1 | **PASS** | `npm run test:marketing-site:gate` 全绿 |
| L2 | **PASS** | `test:marketing-site:live --gate` → **56 pass / 0 fail**（含 `/faq/` `/compare/` `/claims/`） |
| L3 | **PASS** | 新页 200；导航露出对比/常见问题；FAQ 与 geo 同源 10 问；og-default.png 可达 |
| L4 | **PASS** | 本文件 + 审计缺口对照表 |

品牌锁定：主称 **Nova Ai-Studio**；域名别名 NovaPage；消歧 Amazon Nova / Nova Act。

---

## 新 URL 与 Schema

| URL | Schema / 要点 |
|-----|----------------|
| `/` | Organization + SoftwareApplication `@id=#software` + alternateName + disambiguatingDescription + featureList；og:image |
| `/faq/` | FAQPage（10 问）+ BreadcrumbList |
| `/compare/` | WebPage + ItemList + BreadcrumbList；vs Dify/FastGPT/Coze |
| `/claims/` | WebPage + BreadcrumbList；70% 方法论 |
| `/geo/` | FAQPage 与 `/faq/` 问句同步；stub 链 `/faq/` |
| `/docs/` | TechArticle + BreadcrumbList；og:url/image |
| `/contact/` | ContactPage + BreadcrumbList |
| `/llms.txt` | 权威页含 faq/compare/claims + 消歧 |

资源：`assets/og-default.png`（1200×630）、`shared/content.css`、`geo-monitor-queries.json`。

站外内容包：`artifacts/geo-distribution-20260731/`（成稿 + DISTRIBUTION-CHECKLIST）。

---

## 与三份审计缺口对照

| 审计缺口 | 闭环 |
|----------|------|
| 无 schema / llms（报告过时） | 此前已有；本批加固 `#software`、alternateName、消歧、og:image |
| 无 FAQ 落地页 | ✅ `/faq/` 人机同源 |
| 无对比页 | ✅ `/compare/` |
| 70% 无方法论 | ✅ `/claims/` + 首页回链 |
| 实体混淆 Amazon Nova | ✅ 文案 + schema + llms |
| 第三方权威≈0 | ✅ 成稿包就绪；发帖属人工（清单勾选） |
| 监控词库 | ✅ `geo-monitor-queries.json`（25 条） |
| 案例 / 定价页 | 刻意不做（无真实案例、无公开价） |

---

## 验收命令

```bash
npm run test:marketing-site:gate
# 可选 live（Bridge 7990 + MARKETING_SITE=1）:
# SERVER_URL=http://127.0.0.1:7990 npm run test:marketing-site:live
```

Flag：`PILOTDECK_MARKETING_SITE`（既有）；回滚可删 faq/compare/claims 目录并还原 sitemap/pathMatch。

---

## 关键文件

- `deploy/marketing/{index,faq,compare,claims,geo,contact,docs}/**`
- `deploy/marketing/{llms.txt,robots.txt,sitemap.xml,geo-monitor-queries.json}`
- `ui/server/saas/marketing/marketingPathMatch.js` (+ test)
- `ui/scripts/viteMarketingProxyPlugin.mjs`
- `scripts/check-marketing-seo.mjs` / `check-marketing-site-links.mjs` / `run-marketing-site-acceptance.mjs`
- `artifacts/geo-distribution-20260731/**`
