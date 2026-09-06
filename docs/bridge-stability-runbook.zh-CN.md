# Bridge 稳定性运维 Runbook

## 症状 → 探针

| 症状 | 探针 |
|------|------|
| 交付汇总永远「校验中」 | 浏览器 Network：`deliverables/validate` 是否 pending；12s 后应 settled |
| 加载更早无效 | `GET …/messages?direction=backward` 是否 503/30s 超时；`nextCursor` 是否 null |
| Bridge 卡死 | `GET /api/saas/health/ready` 是否 >3s 或 503 |

## 本地回归命令

```bash
npm run test:bridge-stability:unit
npm run test:bridge-stability:browse   # 贴近侧栏连点
npm run test:bridge-stability:smoke
npm run test:history-messages:quick
npm run test:deliverable-paths
```

## 压测与容量数据

```bash
SERVER_URL=http://127.0.0.1:7990 npm run test:bridge-stability:smoke
SERVER_URL=http://127.0.0.1:7990 npm run test:bridge-stability:stress
```

报告输出：`artifacts/bridge-stability-test/load-*.json`

## 修复后验收门槛

- ready P95 < 500ms（smoke 期间 wedgedCount = 0）
- 同会话 3 张交付表 validate 请求 ≤ 1
- truncated 首屏 `nextCursor != null`

## 重启

Nova Launcher「重启」或 `npm run restart:ui-dev`（会中断进行中对话）。
