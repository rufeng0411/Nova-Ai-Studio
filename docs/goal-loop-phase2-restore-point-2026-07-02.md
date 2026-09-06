# Goal Loop Phase 2 — 代码还原点

> Goal Loop P2（交付汇总/空表误完成/turn 墙钟/Skills 深评/实机矩阵验收）落地完成后创建，用于后续大改失败时回退。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-goal-loop-phase2-2026-07-02` |
| **说明** | 交付表正文剥离与空表门控、AgentLoop turnWallClock、readSessionMessages task-resume 过滤、Goal Loop 验收脚本与 E2E、Skills 深评报告 |

```bash
git show restore-point/post-goal-loop-phase2-2026-07-02 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- **交付汇总**：`buildDeliverableSummaryRows` / `deliverableSummaryBodyStrip` 空表与正文重复路径治理
- **引擎**：`AgentLoop` turn 墙钟、`detectGoalPivot`、validateDeliverablesEngine 加固
- **历史读取**：`readSessionMessages` 隐藏 synthetic task-resume / 泄漏 markup
- **验收**：goal-loop fixture replay、phase2 acceptance、final live matrix E2E
- **Skills**：`audit-skills-deep-rating` + 中文深评报告/XLSX

## 如何还原

### 硬回退（丢弃还原点之后所有提交）

```bash
git reset --hard restore-point/post-goal-loop-phase2-2026-07-02
```

### 从还原点开实验分支

```bash
git checkout -b experiment/goal-loop-p2 restore-point/post-goal-loop-phase2-2026-07-02
```

### 仅恢复单个文件

```bash
git checkout restore-point/post-goal-loop-phase2-2026-07-02 -- path/to/file
```

## 未纳入版本库（本地保留）

- `general/artifacts/**` 对话任务产物
- `dev-saas-deeptest.out.txt`
- Excel 临时锁文件 `docs/~$*.xlsx`
