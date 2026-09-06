# 主流大模型收录矩阵（LLM Coverage Matrix）

`geo-visibility-probe` 采集时须按本表逐模型填写 `monitor-data.json` → `llm_coverage.models[]`。  
**勿**在 `mkt-brand-mention`（公开舆情）或 `geo-competitor-analysis`（竞品差距报告）中重复全量矩阵；完整矩阵只写一次，由 `geo-monitor-hub` 合并、`geo-monitor-report` 呈现。

机器可读必测清单：[`config/geo-llm-coverage-required-models.json`](../../../config/geo-llm-coverage-required-models.json)

## 核心策略（必测模型，硬约束）

收录分析 **必须覆盖以下 11 个模型 id**（缺 Key 时 `status: skipped` + `indexing_status: unknown`，**仍须占位一行**，不得省略）：

### 国内（6）

| id | 名称 | 采集方式 |
|----|------|----------|
| `doubao` | 豆包 | web_search 模拟 |
| `deepseek` | DeepSeek | web_search 模拟 |
| `qwen` | 通义千问（千问） | web_search 模拟 + 可选 DashScope |
| `baidu` | 百度文心 | web_search 模拟 |
| `kimi` | Kimi | web_search 模拟 |
| `yuanbao` | 腾讯元宝 | web_search 模拟 |

### 国外（5）

| id | 名称 | 采集方式 |
|----|------|----------|
| `openai` | OpenAI（ChatGPT） | mcp-agent-aeo 或 web_search |
| `gemini` | Gemini | mcp-agent-aeo 或 web_search |
| `claude` | Claude | mcp-agent-aeo 或 web_search |
| `grok` | Grok | mcp-agent-aeo 或 web_search |
| `meta` | Meta AI | mcp-agent-aeo 或 web_search |

**id 别名（合并时归一）**：`ernie`/`wenxin` → `baidu`；`chatgpt`/`gpt` → `openai`。

可选扩展（不替代必测）：`zhipu`（智谱）、`perplexity` 等见 config `optionalModels`。

## 被查询主体（subject）

| 字段 | 说明 |
|------|------|
| `type` | `brand` / `product` / `event` |
| `name` | 主名称（如品牌名、产品型号、活动名） |
| `aliases` | 别名、英文名、简称 |
| `keywords` | 8–12 条口语化问句（与 `queries[]` 对齐） |

## indexing_status 判定

| 状态 | 含义 | 典型证据 |
|------|------|----------|
| `indexed` | 多数问句稳定提及且可溯源 | 回答含品牌/产品名 + 官网或权威来源 |
| `partial` | 部分问句提及或仅泛化描述 | 偶发提及、无首位推荐 |
| `absent` | 相关问句均未提及 | 多次探测 0 命中 |
| `unknown` | 未探测或 Key 不可用 | skipped |

## indexing_score（0–100）

加权建议（可规则化）：

- indexed → 85–100
- partial → 45–84（按 mention_rate 线性）
- absent → 0–20
- unknown → 不纳入 coverage_score 分母

`llm_coverage.coverage_score` = 有效模型 `indexing_score` 均值。

## 每模型最小字段

```json
{
  "id": "qwen",
  "name": "通义千问",
  "region": "cn",
  "indexing_status": "partial",
  "indexing_score": 62,
  "mention_rate": 55,
  "top_pick_rate": 10,
  "citation_sources": ["example.com", "zhihu.com/question/…"],
  "evidence_summary": "8 问句中 4 次提及，无首位推荐",
  "status": "ok"
}
```

## gaps 与 optimization

- `gaps[]`：按模型列出收录缺口（high/medium/low）
- `optimization[]`：须可执行，带 `target_models` 与 P0/P1/P2
  - 示例：补齐 llms.txt / schema、FAQ 可引用段落、权威外链、问句落地页

## 与 engines[] 的关系

- `llm_coverage.models`：**逐模型收录详情**（主事实源，≥11 必测行）
- `engines[]`：hub 从 models 派生的 SOV/得分摘要，供图表与旧字段兼容  
  hub 合并时：`engines[i].score = models[i].indexing_score`（同名 id 对齐）
