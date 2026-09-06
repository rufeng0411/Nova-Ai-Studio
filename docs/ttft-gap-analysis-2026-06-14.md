# TTFT 差距分析（2026-06-14）

基于 `npm run ttft:baseline` / `npm run ttft:benchmark` 产出与 SLA 对照。

## SLA 目标

| 指标 | 目标 p95 |
|------|----------|
| 热会话首可见 (`turn.first_visible_ui`) | < 3s |
| 热会话首 text (`turn.model_ttfb`) | < 8s |
| 新会话首可见 (`turn.session_prepare` + 首可见) | < 5s |

## 改造项与预期影响

| 阶段 | 改造 | 预期受益场景 |
|------|------|--------------|
| Phase 1 | Judge 非阻塞快路径 | S1/S2 `router_judge` |
| Phase 1 | 记忆 5s 超时 | S2/S3 `memory_retrieve` |
| Phase 1 | 附件并行 | S3 `attachments` |
| Phase 1 | plugin refreshIfNeeded | S2 `session_prepare` |
| Phase 2 | MCP 预热 | S2 冷启动 |
| Phase 2 | Tier-3 compact 延迟 | 长上下文首 token |

## 仍可能超标时需追加

| 若实测仍慢 | 建议 |
|------------|------|
| `memory_retrieve` p95 > 2s | 异步 RAG / 首 turn 跳过 |
| `session_prepare` p95 > 3s | 加强 warmup、会话级 MCP 缓存 |
| `model_ttfb` p95 > 8s | 供应商侧 / 路由 tier 默认更轻 |

## 跑测命令

```bash
npm run dev:saas
npm run ttft:benchmark
npm run ttft:baseline
```

无 Gateway 时：`npm run ttft:benchmark -- --report-only` 仅汇总已有 jsonl。
