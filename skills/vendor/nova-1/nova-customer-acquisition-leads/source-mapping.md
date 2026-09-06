# Source of Truth Mapping

Portable Skill 资产与 NovaPage 智能获客源码对照表。修改后端 prompt / 渠道配置时须同步本 Skill 目录。

| Skill 文件 | 源码函数 / 资产 | 路径 |
|---|---|---|
| `prompts/refine-keyword.md` | `refine_keyword_prompt` | `backend/services/customer_acquisition_prompts.py` |
| `prompts/query-expansion.md` | `query_expansion_prompt` | 同上 |
| `prompts/page-classify.md` | `_classify_docs_intent` + `classify_batch_prompt_fragment` | `customer_acquisition_service.py` + prompts |
| `prompts/extract-lead-standard.md` | `extract_lead_prompt_standard` | `customer_acquisition_prompts.py` |
| `prompts/extract-lead-social.md` | `extract_lead_prompt_social` | 同上 |
| `prompts/intent-summary.md` | `_enrich_intent_summary_for_leads` | `customer_acquisition_service.py` |
| `prompts/score-and-track.md` | `_ai_score_and_recommend` | 同上 |
| `prompts/intent-routing.md` | `acquisition_*` in skillTypology | `frontend/src/pages/agent/services/skillTypology.ts` |
| `prompts/weak-context-block.md` | `_weak_search_context_block` | `customer_acquisition_service.py` |
| `channels/README.md` | `acquisition_inferDataSources` | `skillTypology.ts` |
| `channels/catalog.json` | `CHANNEL_CATEGORIES` / weights | `customer_acquisition_sources.py` |
| `playbook.md` | `run_pipeline` 阶段 | `customer_acquisition_service.py` |
| `schemas/lead-record.json` | `_normalize_lead` 字段 | 同上 |
| `quality-gates.md` | 抽取/校验单测语义 | `backend/tests/test_customer_acquisition_extraction.py` |
| `docs/customer-acquisition-pipeline.md` | 博查/Firecrawl 边界 | 仓库 docs |

## 不在 portable Skill 范围

- `lab_customer_acquisition_controller.py`（Nova 任务 API、JWT、排队）
- `heavy_queue_promotion.py`（用户级重型任务队列）
- `task_manager` / 任务浮岛轮询
- 自动 Firecrawl HTML 再抓、公司名二次搜索补联系方式（可写为 Agent 可选增强，非默认）
- 点数扣费与 `CUSTOMER_ACQUISITION_*` 运维 env 全量镜像
