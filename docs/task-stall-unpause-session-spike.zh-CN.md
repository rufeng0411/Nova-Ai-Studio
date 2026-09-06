# P0-2：取消「任务完成」服务端同步 — 设计 Spike

> **状态**：设计已定稿，待 PR-A 实现  
> **关联**：[`SidebarV2.tsx`](../ui/src/components/app-shell/SidebarV2.tsx) `handleContextToggleComplete`、[`turnAcceptanceService.js`](../ui/server/saas/concurrency/turnAcceptanceService.js)

## 问题

标记完成时：`pause-turn` → catalog `executionStatus=paused` + localStorage `completed:true`。  
**取消完成**时：仅 `toggleSessionSidebarCompleted` → localStorage，**服务端仍 paused**。  
后果：`turnAcceptanceService` L174–193 拒绝 synthetic 续跑；用户手发消息行为不一致。

## 方案（推荐）：新增 WS `unpause-session`

对称于现有 `pause-turn`（[`ui/server/index.js`](../ui/server/index.js) L2589）。

### Bridge 消息

```typescript
// Client → Bridge
{
  type: 'unpause-session',
  sessionId: string,
  reason?: 'user_unmark_complete' | 'user_resume',
}
```

### 服务端 `unpauseSession(input)`（`turnAcceptanceService.js` 或 `turnLifecycleStore.js`）

1. `updateExecutionStatus({ executionStatus: 'idle', pausedReason: null, queuePosition: null })`
2. **不**调用 `abortViaGateway`（与 pause 不同）
3. **不**自动 `submitTurn`（用户须显式发消息或点「继续」）
4. `writer.send({ type: 'session_unpaused', sessionId, executionStatus: 'idle' })`
5. 可选：`pumpUserQueue` 若同用户有其他 queued 项

### UI 侧栏 `handleContextToggleComplete`

| 动作 | 现有 | 改后 |
|------|------|------|
| 标记完成 | `pause-turn` + localStorage | 不变 |
| **取消完成** | 仅 localStorage | localStorage + **`unpause-session`** + `patchSessionExecutionStatus(idle)` 乐观更新 |

### 与 M7 终态门控关系

- `unpause-session` **不清除** transcript 中 `acceptanceStatus: passed`
- 取消完成后：`sessionSidebarCompleted=false` → `resolveSessionTerminalComplete` 仍可能 terminal（passed 桶）
- **PR-A 须同步**：取消完成时若仅因 sidebar 终态，允许用户手发消息；`sessionTerminalComplete` 在 sidebar=false 且用户 unmark 后 **不**因 passed alone 阻断 **用户 initiated** turn（`userInitiatedTurnPending=true` 绕过 gate，已有 [`staleSessionPausePolicy.ts`](../src/saas/concurrency/staleSessionPausePolicy.ts) L75）

### 单测

- `tests/server/unpauseSession.test.mjs`：paused → idle；synthetic 续跑在 unmark 后仍拒、user 消息 accept
- `SidebarV2` 集成：mock WS，unmark 发出 `unpause-session`

### 回滚

- Bridge 忽略未知 type 时 UI 仍可用 localStorage；feature flag `PILOTDECK_UNPAUSE_SESSION=0` 跳过 WS 发送

## 备选方案（不采用）

| 方案 | 缺点 |
|------|------|
| 复用 Gateway `resumeSession` | UI Bridge 未暴露；语义混同 Gateway 会话 |
| 取消完成时发空 user turn | 污染 transcript；违背 manual continue 产品意图 |

## 验收（E2E #4）

1. 右键标记完成 → catalog paused  
2. 右键取消完成 → `session_unpaused` + catalog idle  
3. 用户输入并发送 → `turn_accepted`（非 `session_paused`）
