# 鸣镝 G700 生产稳态加固 — 生产验收（2026-07-18）

## 范围

本报告覆盖 P0-10 live 门禁脚本与 P1 泛化审计入口，不含 dev:saas 实机 7 场景（需 `MINGDI_G700_LIVE_URL` + Gateway）。

## 已落地门禁

| 入口 | 说明 |
|------|------|
| `npm run test:mingdi-g700:unit` | 11 案解析 + Bridge 延迟单元 |
| `npm run test:mingdi-g700:replay` | 脱敏 fixture replay |
| `npm run test:mingdi-g700:live -- --gate --tier p0 --workers=1` | replay + official-media + 7 场景结构报告 |
| `npm run test:cloud:official-media-smoke` | 无 staging URL 时显式 SKIP |
| `npm run audit:capability-scope` | exact slug 范围审计 |

## Feature flags

- `PILOTDECK_CAPABILITY_SCOPE_V2`
- `PILOTDECK_GOAL_QUALITY_CONTRACT`
- `PILOTDECK_OFFICIAL_MEDIA_V2`
- `PILOTDECK_CONTENT_QUALITY_V2`
- `PILOTDECK_UI_DELIVERABLE_QUALITY`
- `PILOTDECK_QUALITY_CANARY_SLUGS` / `PILOTDECK_QUALITY_CANARY_TENANTS`

## KPI（结构门禁）

- `false_complete=0`、`false_incomplete=0`（replay fixture 基线）
- live 实机 KPI 需 dev:saas 串行跑满 7 场景后写入 `artifacts/mingdi-g700-production-acceptance/`

## 回滚

各三态 flag 经 `stabilityFlags.ts` / `pack.mjs` / Bridge runtime flags 分钟级回滚。
