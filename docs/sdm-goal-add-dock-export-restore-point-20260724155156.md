# SDM 目标追加与 Dock 导出 — 代码还原点

> 用户追加格式累加 SDM 槽位、Dock 清单扩展、HTML 导出对齐与 task-resume 上下文加固。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-sdm-goal-add-dock-export-20260724155156` |
| **提交** | `4fa9d36a` |
| **时间** | 2026-07-24 15:51:56 +0800 |
| **说明** | SDM 目标追加累加、Dock 清单扩展与导出/续跑上下文加固 |

```bash
git show restore-point/post-sdm-goal-add-dock-export-20260724155156 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- **目标追加（ADD）**：`detectGoalMutation.ts` 识别「给我/再要…HTML|PDF」等累加句式
- **SDM 槽位**：`mergeNumberedSlotsWithProfile.ts`、`sessionDeliverableManifest.ts`、`deliverableChecklistAuthority.ts`
- **Dock 累加**：`accumulateDockExpectedManifest.ts` goalVersion 增槽不替换
- **HTML 导出**：`exportSessionHtml.ts` 与 Dock 同源行对齐
- **续跑上下文**：`buildTaskResumeContext.ts` 缺失路径/已验证路径注入加固
- **工具看门狗**：`toolWatchdog.ts` 长步超时备选路径
- **Bridge/messages**：`messages.js`、`pilotdeck-bridge.js` 历史 envelope 字段
- **生产镜像**：`Dockerfile.prod` 运行时依赖 COPY 微调

## 排除项（未纳入提交）

- `general/artifacts/**`（本地交付物）
- `dev-saas-deeptest.out.txt`
- `.superpowers/`（本地 SDD 进度）

## 如何还原

### 硬回退（丢弃还原点之后所有提交）

```bash
git reset --hard restore-point/post-sdm-goal-add-dock-export-20260724155156
```

### 从还原点开实验分支

```bash
git checkout -b experiment/sdm-goal-add restore-point/post-sdm-goal-add-dock-export-20260724155156
```

### 只还原某个文件

```bash
git checkout restore-point/post-sdm-goal-add-dock-export-20260724155156 -- path/to/file
```

## 关联文档

- [`deliverable-trust-ux-restore-point-20260723162129.md`](./deliverable-trust-ux-restore-point-20260723162129.md)（上一还原点）
- [`conversation-resilience-spec.md`](./conversation-resilience-spec.md)
