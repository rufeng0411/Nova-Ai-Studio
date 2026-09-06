# GEO 联网检索与验证顺序（PilotDeck）

**禁止**为 GEO 任务配置或提示 Perplexity API Key、Google Custom Search 等第三方搜索 Key。

## 标准顺序

| 优先级 | 方式 | 说明 |
|--------|------|------|
| 1 | **`web_search` 工具** | 大模型自带联网检索（PilotDeck 已默认开启） |
| 2 | **博查 Bocha** | `tools.webSearch.provider: bocha` 或 `BOCHA_API_KEY`；主检索失败时引擎自动 fallback |
| 3 | **`geo_api` verify** | 有 Bocha Key 时 CLI 可直接拉摘要；否则返回 `agent_web_search` 由 Agent 用 ①② 完成并写 `verify-report.json` |

## 评分（score）

- `geo_api` action `score` → 规则快评 `scoring_mode: quick` + **CORE-EEAT 自检**（`read_skill geo-aeo-audit` / `mkt-ai-seo`）
- 勿因 quick 模式中断；在 `report.md` 注明「规则快评 + 清单自检」

## 验证（verify）

1. 对 `keywords.md` 中每条验证问句调用 **`web_search`**
2. 根据摘要判断品牌是否被提及，记录 sentiment
3. 若 `geo_api verify` 返回 `verification_mode: bocha_web_search`，合并 CLI 结果
4. 落盘 `verify-report.json`；**勿**在正文写「未配置 Perplexity Key」

## 用户可见文案

- ✅ 「验证：web_search + 博查摘要 / CORE-EEAT 自检」
- ❌ 「因 geo_api 未配置 Perplexity API Key，验证部分为降级交付」
