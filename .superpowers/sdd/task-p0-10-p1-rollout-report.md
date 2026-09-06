# P0-10 + P1  rollout — 验收报告

**状态：DONE_WITH_CONCERNS**

## P0-10

- `scripts/run-mingdi-g700-live.mjs` + `test:mingdi-g700:live`
- `scripts/smoke-cloud-official-media.mjs` + `test:cloud:official-media-smoke`（无 URL 显式 skip）
- `docs/mingdi-g700-production-hardening-acceptance-20260718.zh-CN.md`

## P1

- `scripts/audit-capability-scope.mjs` + `audit:capability-scope`
- Bridge load soak：P0-0 已修栈溢出；wedged 门禁仍须独立 soak 复测
- 布局回归 / 来源缓存：计划级 sketch，未在本批 enforce

## Concerns

- `test:mingdi-g700:live` 默认不跑 dev:saas 实机；设置 `MINGDI_G700_LIVE_URL` 后仍须 Gateway harness 接线。
- Bridge load `wedgedCount` 未在本会话重跑 5 分钟 soak。
