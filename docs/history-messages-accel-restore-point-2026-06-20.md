# 云端对话历史加载加速 — 代码还原点

> 在 **Phase 0（历史 messages sanitize / tail read）** 实施前创建，用于整批回退。  
> 含截至本标签的全部本地 WIP（成果四线、PPT 交付策略、侧栏无感刷新、设计画布、Skills 批次、云端诊断脚本等）。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/pre-history-messages-accel-2026-06-20` |
| **提交** | `832e9a47127afa7cb0cb704d5d9741f6f46435f3` |
| **上一基线** | `a4e07f97` — feat(cloud): conversation catalog、欢迎随机五条、发版打包与云端验收闭环 |
| **计划** | [云端对话加载加速](../.cursor/plans/云端对话加载加速_40948653.plan.md)（Phase -1） |

```bash
git show restore-point/pre-history-messages-accel-2026-06-20 --no-patch --format="%H %s %ci"
```

## 本还原点包含的主要变更（相对 a4e07f97）

- **成果 / 四线**：`deliverablePathResolve`、`pathInProject`、跨 hub 搜索、`ProjectFilePreview` / SuperPreview 对齐
- **PPT 交付**：`anth-pptx` binding、`presentationDeliverablePolicy`、`slide_deck_html` → PPTX 导出
- **SaaS 侧栏**：`catalogCache` 失效、`useProjectsState` 乐观插入、`?fresh=1`
- **设计画布**：`canvasTools`、SuperPreview DesignCanvas 适配器、验收脚本
- **Skills 批次**：Firecrawl / batch-2026-06 / TimesFM / 能力目录扩容
- **UX**：`NovaLoadingScreen`、沉浸式 loading
- **诊断**：`scripts/diag-cloud-*-sessions.mjs`（云端对话加载分析，**不含凭据**）

## 如何还原

### 硬回退（丢弃还原点之后所有提交）

```bash
git reset --hard restore-point/pre-history-messages-accel-2026-06-20
```

### 从还原点开实验分支

```bash
git checkout -b experiment/history-messages restore-point/pre-history-messages-accel-2026-06-20
```

### 仅恢复单个文件

```bash
git checkout restore-point/pre-history-messages-accel-2026-06-20 -- path/to/file
```

## 还原点不包含

- `general/artifacts/` 等未纳入 git 的本地任务产物
- 云端 `/var/lib/nova` 租户数据
- 用户 `~/.pilotdeck` 运行时配置与密钥

## 还原后建议

```bash
npm run check:saas-fork
npm run brand:check
npm run test:prelaunch:quick
```
