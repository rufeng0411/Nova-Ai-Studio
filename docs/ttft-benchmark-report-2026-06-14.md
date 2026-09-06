# TTFT 跑测报告（2026-06-14）

Gateway：`ws://127.0.0.1:18789/ws`
轨迹样本：**4**（F:\Ai-pilotdeck\.saas-dev-data\telemetry\turn-timing.jsonl）

## 场景执行

| 场景 | 次数 | 成功 | 超时 |
|------|------|------|------|
| S1 热会话短消息 | 0 | 0 | 0 |
| S2 新会话首条复杂指令 | 0 | 0 | 0 |
| S3 带附件短任务 | 0 | 0 | 0 |
| S4 PPT 类复杂任务 | 0 | 0 | 0 |

## SLA 对照

| 指标 | 目标 p95 | 实测 p95 | 达标 |
|------|----------|----------|------|
| 首可见反馈 | <3000ms | 26898 | 待验证 |
| turn 总时长 | — | 885848 | — |

## 分阶段（ms）

| 阶段 | 样本 | p50 | p95 |
|------|------|-----|-----|
| turn.attachments | 4 | 0 | 1 |
| turn.compact | 52 | 147 | 574 |
| turn.config_reload | 4 | 25 | 51 |
| turn.context_prepare | 52 | 2376 | 5019 |
| turn.first_visible_ui | 3 | 0 | 0 |
| turn.mcp_ready | 2 | 0 | 0 |
| turn.memory_retrieve | 52 | 2372 | 5012 |
| turn.model_ttfb | 40 | 9946 | 20758 |
| turn.per_session_mcp | 2 | 560 | 613 |
| turn.plugin_refresh | 2 | 1 | 692 |
| turn.router_judge | 4 | 2 | 3 |
| turn.session_prepare | 4 | 2 | 1273 |

原始 JSON：[ttft-benchmark-2026-06-14.json](./ttft-benchmark-2026-06-14.json)
