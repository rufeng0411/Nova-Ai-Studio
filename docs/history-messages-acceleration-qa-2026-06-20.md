# 云端对话历史加载加速 — 验收报告

> Phase 1–5 本地实现与单测门禁；生产实机需在发版开 flag 后补跑 `npm run test:cloud:chat-load`。

## Flag 状态（本地 dev:saas 建议）

| Flag | 开发默认 | 说明 |
|------|----------|------|
| `PILOTDECK_HISTORY_SANITIZE` | 随 `PILOTDECK_SAAS_MODE=1` 开启 | HTTP 历史 API 载荷瘦身 |
| `PILOTDECK_HISTORY_TAIL_READ` | **关**（显式 `=1` 开启） | JSONL 真尾读 |
| `PILOTDECK_HISTORY_MESSAGE_CACHE` | **关** | Redis 尾页缓存 |

## 生产发版 .env（打包更新记录）

> 权威运维：[`docs/history-messages-deploy-runbook.zh-CN.md`](history-messages-deploy-runbook.zh-CN.md)  
> `pack.mjs` → `dist-release/DEPLOY.md` + `MANIFEST.json` → `historyMessagesAccel`

| 阶段 | 写入 ECS `.env` | 验收 |
|------|-----------------|------|
| **A** | `PILOTDECK_HISTORY_SANITIZE=1` | `npm run test:cloud:chat-load` — tail120 **<500KB** |
| **B** | `PILOTDECK_HISTORY_TAIL_READ=1` | 同上 — API **P95 <1.5s** |
| **C** 可选 | `PILOTDECK_HISTORY_MESSAGE_CACHE=1` + `CACHE_TTL_MESSAGES_SEC=120` | 须 `REDIS_URL` |

首装 `deploy.env` 默认含 `PILOTDECK_HISTORY_SANITIZE=1`；**upgrade 不覆盖**已有 `.env`。

## 自动化门禁

| 命令 | 状态 |
|------|------|
| `npm run test:history-messages:baseline` | 绿 |
| `npm run test:history-messages:sanitize` | 绿 |
| `npm run test:history-messages:tail` | 绿 |
| `npm run test:history-messages:cache` | 绿 |
| `npm run test:history-messages:quick` | 绿 |
| `npm run test:history-messages:e2e` | 需 DIAG 凭据（Playwright） |

## L 本地用例（dev:saas + fixture）

| ID | 场景 | 结果 |
|----|------|------|
| L-01 | 重会话 tail120 <500KB / <2s | 单测 + 本地 curl 待补 |
| L-02 | 轻量会话不退化 | pagination 单测绿 |
| L-03 | 上滚 cursor 连续 | pagination 单测绿 |
| L-04 | 成果四线 | collectDeliverables 扩展单测 |
| L-05 | refresh 不全量 | useSessionStore.pagination 绿 |
| L-06 | Gateway 断连 disk fallback | messagesRoute sanitize 一致 |
| L-07 | WS 流式 | 未改 WS 路径 |
| L-08 | Recovery | 未回归专项 |

## C 云端 Playwright

| ID | 场景 | 结果 |
|----|------|------|
| C-01～C-05 | `ui/e2e/saas/history-messages-perf.spec.ts` | 发版前跑 |

## A API 诊断

| ID | 命令 | 结果 |
|----|------|------|
| A-01 | `npm run test:cloud:chat-load` | nightly |
| A-02 | 三轮 median | 发版后 |
| A-03 | `verify-cloud-perf.sh` | warn 项见脚本 |

## 回滚

```bash
PILOTDECK_HISTORY_SANITIZE=0
PILOTDECK_HISTORY_TAIL_READ=0
PILOTDECK_HISTORY_MESSAGE_CACHE=0
```

代码回退：`git reset --hard restore-point/pre-history-messages-accel-2026-06-20`
