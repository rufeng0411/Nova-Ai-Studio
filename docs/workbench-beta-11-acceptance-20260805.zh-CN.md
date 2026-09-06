# 工作台 1.1-Beta 验收报告（2026-08-05）

## 范围

- 并行入口：`/app-1.1-beta`、`/m/app-1.1-beta`
- **未做** P-cutover（`/app` 挂载不变）
- Flag：dev `VITE_WORKBENCH_BETA_11=on` + UX `shadow`；pack/apply-cloud 默认 `off`

## L0–L4

| 级 | 命令 / 证据 | 结果 |
|---|---|---|
| L0 | `npm run test:workbench-beta-11:flags` + `test:workbench-beta-11:unit` | **PASS**（2026-08-05） |
| L1 | `npm run brand:check` + `check:saas-fork` | **PASS**（manifest 含 beta 条目） |
| L2 | e2e `workbench-beta-11-isolation-app`：`/app` 无 `[data-workbench-beta]` / footer / chips / `#tourRoot` | 脚本已就绪；实机需 Launcher + Playwright |
| L3 | `test:workbench-beta-11:ui-clicks` + `live-cases` | live-cases **fixture smoke PASS**（无 BASE_URL）；完整核心案需 `PLAYWRIGHT_BASE_URL` |
| L4 | telemetry `beta_*` 事件缓冲 + 本报告 | buffer 模块已接；实机计数待 Launcher 会话 |

## 隔离合同

- `/app`：零 Beta DOM
- MessageRow：`useWorkbenchBetaSurface().active===false` 时不增 wrapper
- CSS：仅 `[data-workbench-beta]` 作用域
- 营销 PWA `start_url` 未改

## 回滚

```bash
VITE_WORKBENCH_BETA_11=off
# 或生产 apply-cloud-perf-env 默认已 off
```

## 归档

- Fixtures：`tests/fixtures/workbench-beta-11/`
- 实机摘要：`artifacts/workbench-beta-11-acceptance/`（`seed` / live-cases 写入）

## 三原则

| 原则 | 状态 |
|---|---|
| 质量 | sticky/footer 仍走现网 pipeline；Beta 仅加 Tour/Footer/芯片 |
| 速度 | Tour 可跳过；下一步芯片只预填不发送（enforce） |
| 兼容 | `/app` isolation；i18n 仅增 `workbenchBeta.*`；引擎/扣费未改 |
