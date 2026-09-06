# 智能获客 — Agent Playbook

Agent 按 **Phase A → G** 顺序执行。每阶段完成后再进入下一阶段；失败时见「错误恢复」。

---

## Phase A — 输入规范化

### Collect

| 字段 | 必填 | 默认 |
|---|---|---|
| `keyword` | 是 | 用户原文 trim |
| `data_sources` | 否 | `gov_bidding`, `supply_chain`, `outsourcing` |
| `max_results` | 否 | 30（portable 建议 10–50） |
| `min_weight` | 否 | null（不过滤） |
| `seed_urls` | 否 | [] |
| `result_start_date` | 否 | null |
| `exclude_completed` | 否 | true（丢弃已定标且无联系） |

### Intent routing

1. 读 [intent-routing.md](prompts/intent-routing.md)。
2. FAQ/配置类 → 回答后**停止**，不进入 B。
3. 可提交 → 继续。

### Resolve `data_sources`

1. 用户显式勾选 > [channels/README.md](channels/README.md) 决策树。
2. 写入 manifest `data_sources[]`。

### Confirm (recommended)

- 关键词一行摘要、渠道列表、目标条数、是否含社媒/C 端

---

## Phase B — 检索规划

1. [refine-keyword.md](prompts/refine-keyword.md) → `search_keyword`（一行）。
2. [query-expansion.md](prompts/query-expansion.md) → JSON：
   - `main_query`
   - `alternate_queries` (6–12)
   - `negative_terms` (3–8)
3. 保存 `query-expansion.json`（见 schema）。

### Checks

- [ ] `main_query` 非空
- [ ] alternate 覆盖招标/求购/外包等不同表述
- [ ] 未编造具体公司名/项目编号

---

## Phase C — 页面发现

Agent 使用**可用工具**收集 `raw_pages[]`：

| 方式 | 字段约定 |
|---|---|
| 联网搜索 API | `url`, `title`, `markdown` or snippet, `source`: bocha/tavily/manual, `content_layer`: bocha_snippet/search_snippet |
| 用户提供 URL + 抓取 | `content_layer`: page_body |
| Firecrawl / Jina / curl | 全文进 `markdown` |

### Diversity

- **轮询** alternate_queries，勿让单一「招标」query 占满列表。
- 勾选 `social` 时补充 C 端 query（求推荐、急求、找人外包）。
- 去重：`seen_urls` set。

### Output per page

```json
{
  "url": "https://...",
  "title": "...",
  "markdown": "...",
  "source": "bocha",
  "content_layer": "bocha_snippet"
}
```

### Minimum before Phase D

- [ ] ≥5 个有效 URL（portable 验收）；生产可更多
- [ ] 每页 body/snippet ≥40 字（否则丢弃）

---

## Phase D — 页面分类

1. [page-classify.md](prompts/page-classify.md) 批量调用 LLM。
2. 丢弃：`供应`、`无效`；`已中标` 且无联系方式。
3. 保留索引写入 `raw_pages_kept[]`。

### Checks

- [ ] 供应广告/种草页未进入抽取
- [ ] 分类超时则**保留**未分类页（Nova 同策略）

---

## Phase E — 线索抽取

对每条保留页：

1. 构建 `weak_block`（若有 snippet）→ [weak-context-block.md](prompts/weak-context-block.md)。
2. 社媒/C 端 → [extract-lead-social.md](prompts/extract-lead-social.md)。
3. 否则 → [extract-lead-standard.md](prompts/extract-lead-standard.md)。
4. 解析 JSON 数组；归一化字段名（见 lead-record schema）。**JSON 仅用于内部解析，禁止粘贴到用户对话。**
5. 合并全部 `leads[]`。
6. **去重（必做）**：
   - 同一 `source_url` 只保留 `extraction_confidence` 最高的一条；
   - 同一 `company_name` + `title`（归一化后）只保留一条；
   - 禁止 manifest 中出现 10+ 条完全相同的项目。

### Per-page retry

- 解析失败：重试 ≤2 次
- 仍失败：记录 `discarded_pages[]`，继续

---

## Phase F — 校验与评分

### Rule validation (must)

- 邮箱格式、`contact_candidates` 收集
- 400/95 客服号 → `contact_flags: 疑似客服热线为主`，略降 confidence
- `intent_label=noise_irrelevant` → 剔除
- 仅 snippet 来源 → cap confidence ≤0.65
- 无联系方式 + 非高价值政采 URL → 可剔除或标 Low

### Optional LLM enrich

1. [intent-summary.md](prompts/intent-summary.md) 批量（失败可跳过）
2. [score-and-track.md](prompts/score-and-track.md) 或规则 fallback

### Sort

- 默认：`track_level` High first，再 `confidence_score` desc，再 `match_score` desc

---

## Phase G — 交付

**先读** [references/pilotdeck-execution.md](references/pilotdeck-execution.md) 与 [references/report-template.md](references/report-template.md)。

目录：`artifacts/acquisition-{run_slug}/`

1. **`write_file` → `leads-report.md`**（主交付，精美 Markdown **表格**，禁止 JSON 代码块）。
2. **`write_file` → `acquisition-manifest.json`**（机器可读；**不要**在对话中展示全文）。
3. 可选 `query-expansion.json`、`leads.csv`。
4. 每条线索须含可点击 `source_url`。

### 对话收尾（给用户看的）

- 2–4 句执行摘要（纯文字）。
- **一张**高优线索 Markdown 表格（≤10 行），列：单位、需求、联系方式、匹配度、来源。
- 明确路径：`artifacts/acquisition-{run_slug}/leads-report.md`（须已真实写入）。
- **禁止**：JSON、HTML 残片、网页缓存文件路径作为成果列表。

### 内部文件命名

- 勿用含糊的 `index.json` 代替 `acquisition-manifest.json`。
- 勿将 `web_fetch` 下载的 `.html` 列入用户成果。

---

## 错误恢复

| 症状 | 动作 |
|---|---|
| 搜索结果全是供应广告 | 回 Phase B 增加 negative_terms；收窄渠道；改 query |
| 线索无联系方式 | 对高价值 URL 尝试全文抓取；或标记 Low 交付 |
| JSON 解析失败 | 缩短正文；重跑单页；检查 prompt 是否要求纯 JSON |
| 对话刷屏 JSON / 重复线索 | 去重后只写文件；对话仅表格摘要（见 pilotdeck-execution） |
| 用户只见 html 不见报告 | 补写 `leads-report.md`；html 不作为交付 |
| 与用户关键词无关 | 提高 match_score 门槛；检查 keyword 是否过宽 |
| 用户改关键词 | 新 `run_slug`、新目录；勿复用旧 leads |

---

## Portable limits (transparent)

- 无 Nova 任务中心 / 用户级队列 / 409
- 无自动 `CUSTOMER_ACQUISITION_*` 超时降级 env（Agent 自行控超时）
- 公司名二次搜索补联系方式、Firecrawl HTML 再抓为**可选增强**
- 博查/Firecrawl 需用户自备 API Key；无 Key 时依赖用户粘贴 URL 或浏览器搜索摘要（须标注 weak snippet）
