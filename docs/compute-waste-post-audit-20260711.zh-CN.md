# 算力浪费 P0 落地复核（post-audit）

**生成时间**：2026-07-11T10:06:26.333Z

## 数据源

- 用量归因：`usage-attribution-audit-20260711.zh-CN.md`
- 僵尸会话：`zombie-sessions-audit-20260711.zh-CN.md`
- 删除生命周期：`session-lifecycle-audit-20260711.zh-CN.md`

## P0 增量行为（非历史 token 总量）

| P0 项 | 验证方式 | 结论 |
|-------|----------|------|
| UI grace 2→1 | `useAutoRecoveryContinue.test.ts` | 默认 grace=1 |
| validate cache | jsonl repair/acceptance 密度代理 | 见 zombie 审计 estValidateCalls |
| stale 去重 | Bridge abort 后 UI 不二次 submit | telemetry / 手工 |
| 工具快停 | render_html_video 连续失败 | zombie 标记 video_tool_stuck |
| SDM 写盘 | manifest 非 null 率 | zombie 报告 SDM 行 |

## Token vs Server CPU 节省区间（保守，对未来增量）

| 场景 | Token | Bridge+Gateway+工具 CPU |
|------|-------|---------------------------|
| P0 已落地，正常长交付 | ≈ 8～15% | ≈ 8～15% |
| P0+P1 僵尸止血（dev 多死循环） | ≈ 15～25% | ≈ 20～35% |
| 历史 stats.jsonl | **0%** | **0%** |

> validate cache **无独立 telemetry**；勿写 cache hit 已验证，除非后续补埋点。

## 备注

- audit_only：未改写 stats.jsonl
- KPI「未归属」仅计 __system__ session 数，非全部无 userId Token