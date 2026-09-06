# P0-6：官方素材预算、FSM 与工具硬约束

## 目标

实现官方素材 fallback 状态机、工具硬约束，并与旧 visualMediaDegradePolicy 互斥。

## 必须实现

- 扩展 `src/saas/media/mediaStrategyResolver.ts` 官方来源识别
- 新建 `src/saas/media/officialMediaFallbackStateMachine.ts`
- 新建 `src/saas/media/officialMediaPlaceholder.ts`
- 新建 `src/saas/media/goalToolPolicy.ts` + ToolRuntime 权限前 deny
- 扩展 `PilotDeckToolRuntimeContext` 注入 goalToolPolicy/officialMediaBudget
- `visualMediaDegradePolicy.ts` 在 official-required + enforce 时 no-op
- `capabilityBindingPrompt.ts` 官方模式顺序固定
- `PILOTDECK_OFFICIAL_MEDIA_V2=off|shadow|enforce` 单一开关 + stabilityFlags/devLauncher/pack/cloud
- policyAwarePathGuard for write_file/export tools
- child/subagent 继承 scope/budget/allowlist

## 测试

追加到 test:official-media:acceptance；shell/MCP/subagent 逃逸、旧 degrade 互斥、跨 turn 预算

## 约束

依赖 P0-4/P0-5；PD-SAAS-FORK；TDD；不提交不重启

报告：`F:\Ai-pilotdeck\.superpowers\sdd\task-p0-6-official-media-fsm-report.md`
