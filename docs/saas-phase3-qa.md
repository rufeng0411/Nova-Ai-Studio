# SaaS Phase 3 QA — Admin Dashboard & Analytics

**Date:** 2026-06-06  
**Environment:** `npm run dev:saas`

## Scope

- analytics_events + on-read aggregation
- `/api/saas/admin/dashboard` (visits, users, ops, subscriptions, AI usage)
- DashboardPage (5 KPI groups + 4 recharts panels)

## Automated

| Check | Command | Result |
|-------|---------|--------|
| Phase 3 smoke | `npm run test:saas:phase3` | **PASS** (2026-06-06) |
| Analytics unit tests | included in phase3 script | **PASS** |
| Phase 3 Playwright | `playwright-with-dev` + `PILOTDECK_DEV_MODE=saas` + `ui/e2e/phase3` | **PASS** (2026-06-06) |

## Manual

| # | Scenario | Expected | Pass |
|---|----------|----------|------|
| 1 | `/admin/dashboard` | 5 组 KPI + 4 图表 | _ |
| 2 | 登录/注册后 | analytics 事件计数增加 | _ |
| 3 | 有路由统计时 | AI 用量面板非零 | _ |

## L6 回测

| Check | Result |
|-------|--------|
| `npm run test:saas:all` | **PASS** (2026-06-06) |
| `npm run check:saas-fork` | **PASS** |
| `npm run brand:check` | **PASS** |

## Notes

五大盘与 4 图表 Playwright 已绿；埋点计数与路由统计复用建议手动抽测一次。
