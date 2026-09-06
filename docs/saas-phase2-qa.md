# SaaS Phase 2 QA — Billing & Captcha

**Date:** 2026-06-06  
**Environment:** `npm run dev:saas`

## Scope

- control.db: plans, subscriptions, credit_wallet, credit_ledger
- Billing API: plans, subscribe, wallet, admin credit
- Register captcha (in-memory MVP)
- AccountMenu balance
- Quota soft block (402 API + WebSocket chat turn)

## Automated

| Check | Command | Result |
|-------|---------|--------|
| Phase 2 smoke | `npm run test:saas:phase2` | **PASS** (2026-06-06) |
| Billing unit tests | included in phase2 script | **PASS** |
| Phase 2 Playwright | `playwright-with-dev` + `PILOTDECK_DEV_MODE=saas` + `ui/e2e/phase2` | **PASS** (2026-06-06) |

## Manual

| # | Scenario | Expected | Pass |
|---|----------|----------|------|
| 1 | 注册 Tab | 图形验证码展示，错误码拒绝提交 | _ |
| 2 | 新用户注册 | 自动 trial 订阅 + 钱包积分 | _ |
| 3 | GET wallet | 返回 balance | _ |
| 4 | admin POST credit | 目标用户余额增加 | _ |
| 5 | balance=0 时 POST consume | 402 softBlock | _ |

## L6 回测

| Check | Result |
|-------|--------|
| `npm run test:saas:all` | **PASS** (2026-06-06) |
| `npm run check:saas-fork` | **PASS** |
| `npm run brand:check` | **PASS** |

## Notes

自动化门禁已全部通过；手动项（注册 trial、402 软拦截）待你在 `dev:saas` 下勾选。
