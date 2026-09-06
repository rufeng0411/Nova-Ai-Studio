# TTFT 首 turn 跳过 memory 分析（2026-06-21）

样本：**109** 条 turn-timing（F:\Ai-pilotdeck\.saas-dev-data\telemetry\turn-timing.jsonl）

## 首 turn vs 后续 turn

| 指标 | 首 turn | 后续 turn |
|------|---------|-----------|
| 样本数 | 61 | 48 |
| 含 memory_retrieve | 61 | 48 |
| memory p50 (ms) | 5005 | 5008 |
| turn 总时长 p95 (ms) | 573921 | 741648 |

**首 turn 跳过 memory 比例**：0%

估算首 turn p95 相对后续 turn 改善约 **22.6%**（受样本量影响，仅供参考）。

JSON：[ttft-memory-skip-2026-06-21.json](./ttft-memory-skip-2026-06-21.json)
