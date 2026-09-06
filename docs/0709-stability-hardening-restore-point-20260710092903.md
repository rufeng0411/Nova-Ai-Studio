# 0709 续跑加固 — 代码还原点

> 0709 批次后续：taskContinuation 契约、模板绑定、用户可见错误与 browser-compat 探针加固。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-0709-stability-hardening-20260710092903` |
| **提交** | `427a89b9` |
| **时间** | 2026-07-10 09:29:03 +0800 |
| **说明** | 续跑策略、模板契约、userFacingErrors、browser-compat D-06 |

```bash
git show restore-point/post-0709-stability-hardening-20260710092903 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- **续跑**：`taskContinuationPolicy` / `taskGoalContract` 扩展与单测
- **契约**：`capabilityBindingPrompt`、`processTemplateExecutionPrompt` 加固
- **错误**：`userFacingErrors` 视频/工具快停用户文案
- **引擎**：`AgentLoop` 校验缓存与 continuation 联动
- **验收**：`0709-retest` fixture、browser-compat-matrix D-06 探针更新

## 如何还原

### 硬回退（丢弃还原点之后所有提交）

```bash
git reset --hard restore-point/post-0709-stability-hardening-20260710092903
```

### 从还原点开实验分支

```bash
git checkout -b experiment/0709-stability restore-point/post-0709-stability-hardening-20260710092903
```

### 只还原某个文件

```bash
git checkout restore-point/post-0709-stability-hardening-20260710092903 -- path/to/file
```

## 关联文档

- [`browser-compat-matrix-report-2026-07-09.zh-CN.md`](./browser-compat-matrix-report-2026-07-09.zh-CN.md)
- [`deliverable-triple-unify-restore-point-2026-07-09.md`](./deliverable-triple-unify-restore-point-2026-07-09.md)（上一还原点）
