# Turn Queue 验收报告（2026-06-28）

## 自动化

| 项 | 命令 | 结果 |
|----|------|------|
| 槽位 FIFO 单测 | `npm run test:turn-queue:unit` | 见 CI 输出 |
| Playwright 7 并发 + F5 | `npm run test:turn-queue:lifecycle` | 占位 skip，手工按 spec |

## 手工（0712-1 脚本）

1. 同项目连发 7 个新对话 → 侧栏 7 条，≤3 running，其余「排队中」
2. F5 → 7 条仍在，状态正确
3. 停止 →「已暂停」→ 再发消息续跑
4. 运行中右键「标记完成」→ 先暂停再标记

## 配置

- `PILOTDECK_TURN_QUEUE=1`
- `PILOTDECK_USER_MAX_ACTIVE_TURNS=3`
- `PILOTDECK_USER_MAX_ACTIVE_TURNS_ADMIN=3`

权威：`docs/turn-queue-lifecycle-spec.zh-CN.md`
