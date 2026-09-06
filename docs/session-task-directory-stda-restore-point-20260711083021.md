# STDA 会话任务目录 — 代码还原点

> 系统分配唯一任务成果目录（STDA）、新回合写入路径守卫、scopeDir 四线统一与 0710-T1 十案实机验收基线。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-session-task-directory-stda-20260711083021` |
| **提交** | `589c8cc6` |
| **时间** | 2026-07-11 08:30:21 +0800 |
| **说明** | STDA、taskPathGuard、resolveContractScopeDir、0710-T1 live |

```bash
git show restore-point/post-session-task-directory-stda-20260711083021 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- **STDA 引擎**：`sessionTaskDirectory` / `sessionTaskDirectoryCore` / `bootstrapSessionTaskDirectory`；JSONL `session_task_directory` 事件
- **路径守卫**：`taskPathGuard` 重定向新回合写入至分配任务根；`writeFile` / `generateImage` 联动
- **四线统一**：`resolveContractScopeDir`、`resolveSessionTaskDirectory`、`taskArtifactDir`；Dock/汇总表/文件夹经 `buildUnifiedDeliverableView` + scopeDir
- **流程模板**：STDA 目录提示补丁（`patch-process-templates-stda`）、`check-task-dir-prompts` 门禁
- **验收**：`test:task-dir:unit`、`test:0710:T1-live`、0710-T1 Playwright 与 UDC replay fixture
- **记忆**：`AGENTS.md` 代码还原点秒级命名约定补充

## 如何还原

### 硬回退（丢弃还原点之后所有提交）

```bash
git reset --hard restore-point/post-session-task-directory-stda-20260711083021
```

### 从还原点开实验分支

```bash
git checkout -b experiment/stda restore-point/post-session-task-directory-stda-20260711083021
```

### 只还原某个文件

```bash
git checkout restore-point/post-session-task-directory-stda-20260711083021 -- path/to/file
```

## 关联文档

- [`0710-T1-live-report-20260710.zh-CN.md`](./0710-T1-live-report-20260710.zh-CN.md)
- [`0710-T1-live-analysis-20260710.zh-CN.md`](./0710-T1-live-analysis-20260710.zh-CN.md)
- [`0709-stability-hardening-restore-point-20260710092903.md`](./0709-stability-hardening-restore-point-20260710092903.md)（上一还原点）
