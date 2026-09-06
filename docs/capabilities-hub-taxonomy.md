# 能力中心分类体系

> 管理员参考：完整字段与 UI 行为见实施计划；用户可见文案见 [capabilities-hub-copy-guide.md](./capabilities-hub-copy-guide.md)。

## 顶层大类（Tab 顺序）

1. **营销飞轮** — 调研 → 策略 → 创意 → 触达 → 发布 → 监测（**无 AI搜索 Pill**）  
2. **GEO / AI 搜索** — 基线 → 策略 → 可引用 → 技术 → 分发 → 监测（独立 Tab，六段 L2 步进器，无 L3 Pill）  
3. **办公** — 文档、表格、演示、协作  
4. **创作** — 设计、视频、OD 全库  
5. **开发** — 工程、测试、部署、平台工具  
6. **脑爆** — 名人思维 / 方法论  
7. **教育学习** — 学前～高中、综合升学、**学术研究**

## GEO 六段（`geo_stage`）

| ID | 中文 | 典型产出 |
|----|------|----------|
| geo_baseline | 基线调研 | keywords.md、competitor-visibility.md |
| geo_strategy | 策略定位 | strategy-brief.md、pd-geo 全案 |
| geo_citability | 可引用内容 | optimized.md、平台成稿 |
| geo_technical | 技术与结构 | aeo-audit.md、llms.txt、schema.jsonld |
| geo_distribution | 发布与分发 | programmatic-*.html、email-sequence.md |
| geo_monitor | 监测与迭代 | monitor-data.json + monitor-report.md + geo-monitor-report.html |

## 营销飞轮子类（第三层 Pill）

| 阶段 | 子类 ID | 展示名 |
|------|---------|--------|
| 调研 | user_market / market_landscape / competitive_intel / brand_sentiment / deep_research / web_fetch / verify / deliverable | 已移除 **ai_search** |
| 策略～监测 | … | 同上，GEO 能力见 GEO Tab |

**GEO 归属**：`major_category: geo` + `geo_stage`；`pd-geo` 仅在 `geo_strategy`。

## 验收

```bash
npm run vendor:marketing
npm run capabilities:gen
npm run smoke:geo-hub
npm run smoke:geo-monitor-report
npm run verify:geo-saas
npm run smoke:marketing-install
npm run verify:marketing-saas
```

跑测缺项表：`docs/marketing-install-readiness.zh-CN.md`  
AI 搜索 playbook：`docs/ai-search-optimization-playbook.zh-CN.md`

## 配置与生成

| 文件 | 用途 |
|------|------|
| `scripts/lib/capabilityHubTaxonomy.mjs` | slug 映射、虚拟卡、子类定义 |
| `config/capability-hub-zh.json` | 中文 display_name / 说明 |
| `config/capabilities.overrides.json` | 阶段、学段、覆盖规则 |
| `npm run capabilities:gen` | 生成 catalog |

```bash
node scripts/generate-capability-hub-zh.mjs
npm run capabilities:gen
node scripts/check-capabilities-i18n-zh.mjs
node scripts/integration-capabilities-smoke.mjs
```
