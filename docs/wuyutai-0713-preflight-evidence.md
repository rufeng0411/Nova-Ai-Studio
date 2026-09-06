# 0713 吴裕泰五案 JSONL/Telemetry 前置取证

> 实施前取证（HTML 导出 repair 子串计数易 inflated，以 telemetry 为准）。

## 数据源

- `.saas-dev-data/telemetry/stability-events.jsonl` — `cold_resume_fired`（221c）
- `.saas-dev-data/telemetry/recovery-events.jsonl` — tool_recovery
- `.saas-dev-data/telemetry/turn-timing.jsonl` — turn 边界

## 221c0bd7（AI 搜索格局）

- `cold_resume_fired` ×1（session `web-s_221c0bd7-0b4f-4314-b09a-5c1e7667eb0f`）
- 多 turn 续跑（turn-timing 可见 9951edb6、8851f7c1、1d9a6f8c 等）
- **结论**：infra 冷续跑 + 错误 SDM 槽（brief/index）为主因；HTML 中 `infra_interrupt` 出现 18 次含 meta 重复，非 18 次独立 repair

## e3f7f0ef（GEO 竞品分析）

- recovery-events：`tool_recovery`（bash 失败）×2，非 deliverable_repair 风暴
- 多 turn 正常结束（turn-timing 有 endedAtMs）
- **结论**：文件已 write 但 slot/verified 未同步更可能；非 repair 循环

## 6f49ee71（GEO 行业深度调查）

- 本地 telemetry **无**该 sessionId 条目（会话可能在云端或其它 DATA_ROOT）
- HTML 导出 `deliverable_repair` 子串 ×40 **不可作实计**；须云端 JSONL `turn_acceptance_meta.continuationOwner` 复核
- **结论**：geo 7 槽误绑仍属 P0-2 必修复项；熔断 gapKey 已改为 SDM 槽位优先

## 实施门禁

- PR1：五案 goal fixture 编译 pathHint 断言
- PR2：e3f7 合成 verified + taskArtifactDir → acceptance passed
- PR3：`test:deliverable-triple-unify`
