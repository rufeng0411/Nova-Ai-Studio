# SaaS Phase 1 QA — Auth & Admin UI

**Date:** 2026-06-06  
**Branch / tag:** _fill before release_  
**Environment:** `npm run dev:saas` (PILOTDECK_SAAS_MODE=1)

## Scope

- `ui/src/saas/theme/saasTokens.css` from `artifacts/saas-design/chosen/tokens.css`
- Login / Register pages (v1 Native Slate)
- Admin layout + Users page
- App.tsx SaaS routing; Config tab hidden for non-admin
- Tenant project paths via `resolveEffectivePilotHome` + disk listing
- `/admin/platform` 平台配置页 + 非管理员 config 写入 403

## Automated

| Check | Command | Result |
|-------|---------|--------|
| Phase 1 unit + bootstrap smoke | `npm run test:saas:phase1` | **PASS** (2026-06-06) |
| Phase 1 Playwright | `playwright-with-dev` + `PILOTDECK_DEV_MODE=saas` + `ui/e2e/phase1` | **PASS** (2026-06-06) |
| UI unit | `npm run test:ui:unit` | **PASS** 120/120 (2026-06-06) |

## L6 回测

| Check | Result |
|-------|--------|
| `npm run test:saas:all` | **PASS** |
| `npm run check:saas-fork` | **PASS** (28 entries) |
| `npm run brand:check` | **PASS** |

## Manual

| # | Scenario | Expected | Pass |
|---|----------|----------|------|
| 1 | Open `/login` | Nova 品牌、登录/注册 Tab、左侧 hero | _ |
| 2 | admin / admin123 登录 | 进入工作区，WebSocket 正常 | _ |
| 3 | `/admin/users` | 侧栏、KPI 行、用户表格 | _ |
| 4 | 普通成员登录 | 设置中无「配置」入口 | _ |
| 5 | admin 打开设置 | 可见「配置」Tab | _ |

## Notes

_Record defects, screenshots, env vars here._
