# 会话切换与多用户并发优化规范

## 前端

- `sessionDeliverablePipeline.ts`：单次 O(n) 成果扫描 bundle；开关 `VITE_SESSION_PIPELINE_BUNDLE`
- `useSessionStore` LRU：默认保留 10 个 warm slot（`VITE_SESSION_STORE_LRU_SLOTS`）
- 503 退避：`fetchWithBackoff.ts`（messages + validate）
- 冷启动 fast80：`VITE_TAIL_PAGE_FAST_SWITCH`（有 tailCache/warm slot 仍 120）

## Bridge

- `sessionState` LRU cap 500 + `ownerUserId`
- `turnConcurrencyGate.js`：每用户默认 2 路并行 turn
- `loginRateLimit.js`：登录/注册 Redis 限流
- `GET /api/projects` 背压 + 侧栏 catalog 默认 7 天（`SAAS_SIDEBAR_DEFAULT_DAYS`）

## 验收

```bash
npm run test:session-switch:validation
```

报告：`artifacts/session-switch-validation/load-summary.json`
