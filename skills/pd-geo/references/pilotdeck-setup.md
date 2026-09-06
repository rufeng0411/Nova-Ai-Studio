# PilotDeck × AI 搜索可见度 执行说明

## 产物目录

统一写入：系统分配的 **taskArtifactDir**（`<task-artifact-dir>` 注入；仅 basename，如 `keywords.md`、`drafts/zhihu.md`）

| 文件 | 说明 |
|------|------|
| `audit-checklist.md` | AI 可见度审计清单 |
| `keywords.md` | 关键词与验证问句 |
| `drafts/*.md` | 各平台初稿 |
| `optimized.md` | 优化后主稿 |
| `schema.jsonld` | 结构化数据 |
| `score.json` | 工具评分（权威） |
| `verify-report.json` | 提及验证 |
| `report.md` | 给人看的摘要 |
| `score-estimate.md` | 降级清单评估（无 geo_api 时） |

## 联网检索与验证

权威顺序见 [search-verify.md](search-verify.md)：

1. **`web_search`**（模型联网）
2. **博查**（`BOCHA_API_KEY` 或 `tools.webSearch.provider: bocha`）
3. **不使用** Perplexity / Google 搜索 API

## geo_api 调用

**优先使用内置工具 `geo_api`**，勿用 bash 搜 Python 脚本。

常用 payload：

- `score`：需 `brand`、`content` 或 `content_path`，可选 `advantages`、`platform`
- `verify`：需 `brand`、`queries`（字符串数组，建议 ≤10 条）；有 `BOCHA_API_KEY` 时 CLI 走博查摘要
- `keywords`：需 `brand`、`advantages`，可选 `competitors`（数组）
- `schema`：需 `brand`、`page_type`（faq/article）、`content_path`
- `rag_ingest` / `rag_query`：品牌知识库（可选）
- `history_summary`：只读历史摘要（可选）

环境（维护者配置）：

- `tools.webSearch.provider: bocha` + `apiKey`，或环境变量 **`BOCHA_API_KEY`**
- `tools.geo.dataDir`（可选，默认 `~/.pilotdeck/geo-data`）
- Python venv：运行 `node scripts/setup-aigeo-venv.mjs`（无 venv 时工具降级，见 resilience）

**已废弃**：`tools.geo.perplexityApiKey` / `PERPLEXITY_API_KEY`（GEO 验证不再使用）

备选 CLI（仅 geo_api 不可用时）：

```bash
node scripts/aigeo-api.mjs --payload-file payload.json
```

## 与 mkt-ai-seo 分工

- **mkt-ai-seo**：方法论、审计清单、优化原则（先 read）
- **pd-geo**：编排、多平台成稿、geo_api 评分 + web_search/博查验证

## 发布

国内社媒草稿用 **yixiaoer**，不要用剪贴板同步。默认草稿、不公开发布。
