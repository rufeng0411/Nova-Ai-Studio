# 成果路径对齐修复报告（2026-06-18）

## 根因摘要

| 症状 | 根因 |
| --- | --- |
| 成果面板 / 前往文件夹打开错误 `index.html` | `findArtifactFileByBasename` 全树扫描取 **mtime 最新** |
| 正文完整路径正常、面板裸名串台 | 三入口预处理不一致（正文无 reconcile，面板 reconcile 后仍可能二次 mtime resolve） |
| general 多任务必碰撞 | 单云枢纽 `artifacts/` 累积，裸 `index.html` / `slide-01.png` 必然多候选 |

## 修复要点

1. **服务端 `file/resolve`**：新增 `hintDir` query；裸冲突名无 hint 时返回 `409 ambiguous_deliverable`（最多 5 候选）。
2. **`pathInProject.js`**：`findArtifactFileMatches` + hintDir 约束；禁止无 hint 的 mtime 猜测（`PILOTDECK_DELIVERABLE_HINT_DIR=0` 可回滚旧行为）。
3. **客户端 `resolveDeliverablePath`**：正文链接、成果弹窗、右栏预览、前往文件夹统一入口。
4. **`turnArtifactDir`**：回合收集阶段写入 `DeliverableItem`，经 Markdown 上下文与面板传递。
5. **`reconcileTurnDeliverables`**：tool 来源裸 `index.html` 等 re-anchor 到 turn 目录。
6. **`findFileTreeNode`**：多候选裸名无 hint 返回 null；有 hintDir 时前缀匹配。
7. **`catalogBridgeHooks`**：写入 PG 前 `resolveCatalogLegacyProjectId(general → tenant slug)`。

## 基线 vs 修复后（碰撞夹具）

权威矩阵见 [`docs/deliverable-path-baseline-2026-06-18.md`](deliverable-path-baseline-2026-06-18.md)。

| 查询 | 修复前（典型） | 修复后 |
| --- | --- | --- |
| `index.html` 无 hint | mtime 最新（task-b） | **409 ambiguous** |
| `index.html` + hintDir task-a | 可能仍是最新 | `artifacts/task-a/index.html` |
| `slide-01.png` + hint deck-b | 跨 deck 猜测 / 404 | `artifacts/slides-deck-b/slide-01.png` |

## 验收

```bash
npm run test:deliverable-paths
```

- 集成：`scripts/deliverable-path-collision-check.mjs` ✅
- 单元：pathInProject / deliverablePathResolve / reconcile / fileTree / pickPrimary / resolveDeliverablePath ✅（33 tests）

`test:prelaunch:quick` 已纳入 `test:deliverable-paths` 步骤。

## 手工复现（general 连续两任务）

1. 任务 A：`write_file artifacts/collision-a/index.html`
2. 任务 B：`write_file artifacts/collision-b/index.html`
3. 任务 B 回合：成果面板点击、正文裸链、前往文件夹均应打开 `collision-b`，不得打开 `collision-a`。

## 已知边界

- 极旧会话若 reconcile 后仍为裸名且无 `turnArtifactDir`，可能 409/404，需用户从完整路径或文件树打开。
- Playwright 全 UI 碰撞 E2E（`deliverable-collision-e2e.mjs`）依赖 dev 栈；当前以夹具 + API 集成矩阵为主回归，预览回归仍用 `scripts/ui-artifact-preview-check.mjs`。

## 2026-07-16 增补（FAQ 9fee0532 / GEO 误扩写）

- **症状**：正文链接 `artifacts/faq-dutch-goji/index.html` 可开，成果清单 `artifacts/geo/faq-dutch-goji/index.html` 404。
- **根因**：slug 路径默认优先 `artifacts/geo/` 扩写；SDM `pathHint` 未与 `turnArtifactDir` 编译。
- **修复**：`shouldSkipGeoExpansion` / `compileDeliverableSlotPath` / `scopeDir` linkable 门禁；详见 `docs/deliverable-governance-acceptance-2026-07-16.zh-CN.md`。

## 回滚

环境变量 `PILOTDECK_DELIVERABLE_HINT_DIR=0` 恢复裸名 mtime 最新优先（应急）。
