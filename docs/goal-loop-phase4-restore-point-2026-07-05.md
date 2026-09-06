# Goal Loop Phase 4 — 代码还原点

> 交付门控、SDM 同源匹配、汇总表四列契约与 Plan 卡 UI 强化验收通过后创建，用于后续大改失败时回退。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-goal-loop-phase4-2026-07-05` |
| **提交** | `252c65d3` |
| **说明** | COMPLETION_GATE/VERIFICATION_PASS、sdmSlotMatching、汇总表契约 MOD-07/08 |

```bash
git show restore-point/post-goal-loop-phase4-2026-07-05 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- **门控**：`taskContinuationPolicy` repair 统一、`AgentLoop` verification_repair_triggered
- **SDM**：`sdmSlotMatching.ts` 引擎/UI 同源 kind-only 匹配
- **汇总表**：四列契约单测、MOD-07 部分 1/5、MOD-08 全量 5/5
- **UI**：空 Plan 卡不渲染、侧栏导出会话 HTML（`exportSessionHtml`）
- **发版**：`pack.mjs` / `devLauncherCore` 默认 `PILOTDECK_COMPLETION_GATE=1`、`PILOTDECK_VERIFICATION_PASS=1`

## 如何还原

### 硬回退（丢弃还原点之后所有提交）

```bash
git reset --hard restore-point/post-goal-loop-phase4-2026-07-05
```

### 从还原点开实验分支

```bash
git checkout -b experiment/goal-loop-p4 restore-point/post-goal-loop-phase4-2026-07-05
```

### 只还原某个文件

```bash
git checkout restore-point/post-goal-loop-phase4-2026-07-05 -- path/to/file
```

## 生产回滚

`.env` 设 `PILOTDECK_COMPLETION_GATE=0` / `PILOTDECK_VERIFICATION_PASS=0` 并 recreate nova 容器。
