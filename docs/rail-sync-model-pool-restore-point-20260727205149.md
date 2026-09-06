# 侧栏切换成果同步 · 右栏 Rail · 模型池 — 代码还原点

> 侧栏切换 Dock/成果同步、RightWorkspaceRail 上下文加固、模型池冗余 Key 与免费档批量启用；HF Studio 预览微调与 AGENTS 记忆更新。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-rail-sync-model-pool-20260727205149` |
| **提交** | `2a264013` |
| **时间** | 2026-07-27 20:51:49 +0800 |
| **说明** | 侧栏切换成果同步、右栏 Rail 与模型池冗余 Key 加固 |

```bash
git show restore-point/post-rail-sync-model-pool-20260727205149 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- **侧栏切换成果同步**：`sessionSwitchDeliverablesSync.ts` 切换会话时 Dock/成果 envelope 对齐，单测覆盖
- **右栏 Rail**：`RightWorkspaceRailContext.tsx` 上下文与 `TaskFolderRailPanel` early-bind scopedRoot
- **成果 Dock**：`DeliverableSessionDock.tsx`、`deriveDeliverablesDockState.ts` 与切换同步联动
- **模型池冗余 Key**：`providerApiKeys.ts` 多 Key 回退链；`PilotDeckConfigTab` 免费档批量启用（`catalogFreeTierModels`）
- **模型清单**：`catalogProviders.ts`、`listModelsSupplements.js` 补充与 kinds 对齐
- **HF Studio**：`HfViewSurface.tsx`、`hfStudioSupport.ts` 预览路径微调
- **诊断**：`scripts/diag/new-chat-stuck-probe.mjs` 新会话卡死探针
- **AGENTS.md**：continual-learning 增量记忆（HF Studio、P0′、还原点 SOP、模型池冗余）

## 排除项（未纳入提交）

- `general/artifacts/**`（本地交付物）
- `dev-saas-deeptest.out.txt`
- `.superpowers/`

## 如何还原

### 硬回退（丢弃还原点之后所有提交）

```bash
git reset --hard restore-point/post-rail-sync-model-pool-20260727205149
```

### 从还原点开实验分支

```bash
git checkout -b experiment/rail-sync-model-pool restore-point/post-rail-sync-model-pool-20260727205149
```

### 只还原某个文件

```bash
git checkout restore-point/post-rail-sync-model-pool-20260727205149 -- path/to/file
```

## 关联文档

- [`hf-studio-p0prime-speed-restore-point-20260727104347.md`](./hf-studio-p0prime-speed-restore-point-20260727104347.md)（上一还原点）
