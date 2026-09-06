# 删除 / 终止生命周期审计

**生成时间**：2026-07-11T10:06:26.211Z
**PASS**：0 · **FAIL**：5

| sessionId | 三态 | transcript | read status | PASS | 说明 |
|-----------|------|------------|-------------|------|------|
| `web-s_06522f92-a5d…` | orphan | Y | true | ❌ | P1 gap: orphan readable until tombstone |
| `web-s_0ffbb6a3-266…` | orphan | Y | true | ❌ | P1 gap: orphan readable until tombstone |
| `web-s_26fece88-799…` | orphan | Y | true | ❌ | P1 gap: orphan readable until tombstone |
| `web-s_3f36122f-065…` | orphan | Y | true | ❌ | P1 gap: orphan readable until tombstone |
| `web-s_49a9fff6-f88…` | orphan | Y | true | ❌ | P1 gap: orphan readable until tombstone |

## 其他检查项

- Bridge sessionState 清理：verify via deleteSession + removeBridgeSessionState (code)
- usage_session_owner 保留：expected — historical attribution

> 本脚本只读，不修改用户 jsonl。