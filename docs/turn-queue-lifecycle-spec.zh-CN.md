# Turn Queue 生命周期规范

## 目标

- 用户发送后 **必接受**（`turn_accepted`），超限进入 **FIFO 排队**，不再 `turn_rejected` 丢任务
- 每用户最多 **3 路 running**（`PILOTDECK_USER_MAX_ACTIVE_TURNS=3`）
- accept 时同步写 **catalog + jsonl 首条 user**，刷新后侧栏与对话区可恢复
- **accept 入队扣 1 次用量**（queued 与 running 不重复扣）
- 停止 / 右键暂停 / 运行中点完成 → **已暂停**；新消息 **续跑**

## 状态机

| execution_status | 含义 |
|------------------|------|
| `idle` | 无排队/运行任务 |
| `queued` | 已接受，等待槽位 |
| `running` | Gateway 正在执行 |
| `paused` | 用户暂停，可续跑 |

与 catalog `status`（pending/active/deleted）独立。

## WS 协议

| 事件 | 方向 | 说明 |
|------|------|------|
| `turn_accepted` | S→C | `{ sessionId, executionStatus, queuePosition? }` |
| `turn_started` | S→C | queued → running |
| `turn_paused` | S→C | 暂停确认 |
| `queue_updated` | S→C | 排队变化 / 取消 |
| `pause-turn` | C→S | 暂停 running |
| `cancel-queued-turn` | C→S | 取消 queued |
| `turn_rejected` | S→C | 仅 quota / platform_busy / catalog 硬失败 |

## 特性开关

- `PILOTDECK_TURN_QUEUE=1`（dev:saas 默认开；`0` 回退旧 reject 路径）

## 模块

- `ui/server/saas/concurrency/turnAcceptanceService.js` — accept 入口
- `turnSlotRegistry.js` — 槽位（Redis + 进程内降级）
- `turnQueueManager.js` — FIFO
- `turnQueuePump.js` — 释放槽位后 pump
- `turnQueueTranscript.js` — queued 写 jsonl
- migration `005_turn_execution_status.sql`

## 验收

1. 同项目连发 7 个新对话：7 条可见，≤3 running，其余 **排队中**
2. F5 后状态与列表保持
3. 停止 → **已暂停** → 再发消息续跑
4. `npm run test:turn-queue:unit`
