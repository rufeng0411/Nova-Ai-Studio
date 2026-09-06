# 容错与降级（PilotDeck）

对话**不得**因评分/验证失败而中断。禁止向用户展示原始 Python/HTTP 报错。

## 联网检索顺序（GEO 验证必读）

见 [search-verify.md](search-verify.md)：**web_search → 博查 Bocha**；勿使用 Perplexity / Google 搜索 API。

## 降级阶梯

| 情况 | Agent 做法 | 落盘 | 用户可见 |
|------|------------|------|----------|
| `geo_api` / venv 不可用 | `read_skill mkt-ai-seo` 清单 + 规则自检 | `score-estimate.md`、`verification-plan.md` | 弱提示：评分服务未就绪，已用清单版 |
| `score` 返回 `scoring_mode: quick` | 接受规则分 + CORE-EEAT 自检 | `score.json` 标注 quick | 继续下一步，勿提 Perplexity |
| `verify` 返回 `agent_web_search` | 对每条 query 先 `web_search`，失败自动试博查 | `verify-report.json` | 说明已用联网检索验证 |
| `verify` 返回 `bocha_web_search` | 合并 geo_api 博查摘要 | `verify-report.json` | 正常交付 |
| `web_search` 与博查均失败 | 保留 queries 列表，清单式验证计划 | `verification-plan.md` | 全局联网弱提示 |
| 信息不全 | 用【品牌】占位，**不**反复问卷 | 照常写 keywords | — |
| 任一步失败 | 保留已生成文件 | — | 提示可发「继续」从第 N 步接着做 |

## 部分成功

P0：**至少一份** `artifacts/geo/<slug>/` 下文件存在即算可交付。

## geo_api 返回约定

工具 JSON 含 `ok`、`data`、`error`、`degradation`、`scoring_mode`、`verification_mode`。`ok: false` 时按上表降级，勿停止整条工作流。**禁止**向用户输出「未配置 Perplexity API Key」类文案。
