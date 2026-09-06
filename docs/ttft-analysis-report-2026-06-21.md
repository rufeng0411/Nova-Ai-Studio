# TTFT 基线报告（2026-06-21）

样本数：**109**

## 总耗时（ms）

| 指标 | p50 | p95 |
|------|-----|-----|
| turn 总时长 | 74015 | 684104 |
| 首可见反馈 | 19202 | 37201 |

## 分阶段（ms）

| 阶段 | 样本 | p50 | p95 |
|------|------|-----|-----|
| turn.attachments | 109 | 0 | 4 |
| turn.compact | 682 | 141 | 965 |
| turn.config_reload | 109 | 38 | 63 |
| turn.context_prepare | 682 | 3821 | 5023 |
| turn.first_visible_ui | 100 | 0 | 0 |
| turn.mcp_ready | 68 | 1 | 2 |
| turn.memory_retrieve | 682 | 3814 | 5015 |
| turn.model_ttfb | 629 | 8224 | 27492 |
| turn.per_session_mcp | 66 | 577 | 4007 |
| turn.plugin_refresh | 68 | 723 | 1693 |
| turn.router_judge | 112 | 2 | 5 |
| turn.session_prepare | 109 | 1044 | 5145 |

原始 JSON：[ttft-baseline-2026-06-21.json](./ttft-baseline-2026-06-21.json)
