# 成果三线统一（UDC）规范 R11

> 权威方案：闭合「对话成果 / 成果清单 / 任务文件夹 / HTML 导出」分裂；单内核 `buildUnifiedDeliverableView` + 编译/持久化/磁盘 enrich 三层防御。

## 1. 问题定义

同一任务内可能出现：

| 入口 | 数据源 | 典型症状 |
|------|--------|----------|
| 任务文件夹 Tab | 磁盘 `useFileTreeData` | 文件存在且可点 |
| 预览区 | `file/resolve` + readFile | 正常渲染 |
| 汇总表 / Dock | SDM 槽 + transcript verified | 槽位「未完成」、链接空 |
| HTML 导出 | 旧：末轮 verified 全标「已交付」 | 17 行假绿 / 空表 |

**根因**：Enrich 双轨——文件夹读盘、清单读 transcript，未走统一 contract。

## 2. 单内核架构

```
compileSessionDeliverableManifest (+ mergeNumberedSlotsWithProfile)
  → baselineLocked
  → turn 末 filterVerified → reconcileSlotsWithVerifiedPaths (resolvedPath)
  → strict GT (optional flag)
  → buildUnifiedDeliverableView (+ diskSnapshot)
  → 汇总表 | Dock | exportSessionHtml | 文件夹过程文件标记
```

**五处路径一致**：`slotBindings[].resolvedPath` / reconcile 写回的 `resolvedPath`。

## 3. 模块清单

| PR | 模块 | 说明 |
|----|------|------|
| PR-0 | `ui/src/shared/buildUnifiedDeliverableView.ts` | UDC 单内核 |
| PR-0 | `exportSessionHtml.ts` | contract 导出 N 行；`PILOTDECK_EXPORT_USE_CONTRACT=1` |
| PR-1 | `mergeNumberedSlotsWithProfile.ts` | numbered + profile pathHints |
| PR-1 | `normalizeDeliverableBasename.ts` | `01-aeo-*` 序号前缀归一化 |
| PR-1 | `config/sdm-slot-profile-merge.json` | geo/battlecard/monitor 映射 |
| PR-2 | `filterVerifiedForContractBinding.ts` | 非用户交付物过滤 + basename 去重 |
| PR-2 | `deliverableGroundTruth.ts` | `PILOTDECK_SDM_BASELINE_STRICT_GT=1` |
| PR-2 | `turn_acceptance_meta.slotBindings` | 持久化槽绑定 |
| PR-3 | `GET …/deliverables/task-folder-snapshot` | scopeDir 磁盘列表 |
| PR-3 | `useTaskFolderDiskSnapshot` | Dock disk enrich |
| PR-3 | `TaskFolderRailPanel` | 契约外标「过程文件」 |

## 4. 0709 八案锚点

| ID | session 前缀 | 契约 N | 要点 | UDC 覆盖 |
|----|-------------|--------|------|----------|
| C1 | eca4cc5d | 3 | 显式 pathHint | PR-0/1 |
| C2 | cf6a9bf5 | 1 | 单文件 | PR-0 |
| C3 | 7c8ab3d2 | 1 | 单 md | PR-1 |
| C4 | **dc7a63d3** | **7** | P0：导出 17 行假绿 | 全栈 |
| C5 | **d7890d1d** | **7** | 截图：`01-aeo-audit-checklist.md` 未绑槽 | PR-1/2/3 |
| C6 | d45a0ed0 | 3 | 跨目录 verified | PR-2/3 scopeDir |
| C7 | 1d1bf62f | 1 mp4 | media 过程文件 | PR-1/2 |
| C8 | e75fe21d | 8 | profile 误绑 geo；导出空表 | PR-0/1 守卫 |

## 5. 验收命令

```bash
npm run test:deliverable-triple-unify:export   # PR-0 导出 contract
npm run test:goal-loop:0709-live                # PR-1 六案 fixture
npm run test:sdm:unit                           # SDM 单元
npm run test:deliverable-triple-unify           # 全量门禁编排
npm run test:four-line-audit -- --gate          # 五线对齐（发版前）
```

## 6. Feature Flags

| Flag | 默认 | 作用 |
|------|------|------|
| `PILOTDECK_EXPORT_USE_CONTRACT` | 开 | HTML 导出走 contract |
| `PILOTDECK_SDM_BASELINE_STRICT_GT` | **自动**（baselineLocked + Tier-0/merged pathHints 时开；`=0` 仅回滚） | 禁 profile 旁路假 passed |
| `PILOTDECK_TASK_FOLDER_SNAPSHOT` | 开 | Dock 磁盘 enrich |

## 7. RCA 三分取证

排查「文件夹有、清单无」时须同时采集：

1. **contractHash** — 汇总表 / Dock / 导出 `<section data-contract-hash>`
2. **task-folder-snapshot** — `GET …/task-folder-snapshot?scopeDir=`
3. **turn_acceptance_meta** — `slotBindings` + `verifiedPaths`（JSONL）

三者不一致时优先查：compile pathHints → reconcile → disk enrich 链路。

## 8. 回滚顺序

PR-3 `PILOTDECK_TASK_FOLDER_SNAPSHOT=0` → PR-2 strict GT → PR-1 merge 表 → PR-0 export flag

每 PR tag：`pre-udc-r11-pr{N}`

## 9. 终验收证书（2026-07-17 四线加固）

职责边界：

| 层 | 职责 | 权威 |
|----|------|------|
| 合同 | 用户应得什么 | 冻结 SDM / 显式清单 |
| 磁盘 | 文件是否存在 | scopeDir 内真文件 |
| 证书 | 一对一绑定 + completionState | `turn_acceptance_meta.acceptanceCertificate` |
| 展示 | 对话/Dock/文件夹/导出 | 只读证书 + enrich，禁止正文猜路径 |

`contractHash` 仅哈希合同；`evidenceHash` 哈希槽位状态与 resolvedPath。UI/导出不得用 progress  alone 升格 passed。
