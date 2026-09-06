# 设计画布规范（Nova SuperPreview）

> PD-SAAS-FORK · gate 默认关闭 · 编辑仅右栏 Dock

## 1. 功能门控（A0）

| 层 | 开关 | 说明 |
|----|------|------|
| UI | `localStorage pilotdeck-design-canvas-enabled=1` | 设置页「设计画布」 |
| Gateway | `PILOTDECK_DESIGN_CANVAS=1` | 注册 `canvas_*` Agent 工具 |
| dev:saas | `devLauncherCore.mjs` 默认注入 Gateway env | 与 UI 开关联调 |
| SaaS 偏好 | `userPreferences.designCanvasEnabled` | 登录后 hydrate 到 localStorage |

**生产租户级统一开关**：Phase 4；当前 dev/E2E 须同时开 UI + Gateway。

## 2. 交互红线

- 弹窗 **仅查看**；**编辑必须右栏 Dock**（`designCanvasDock.ts`）
- overlay 内不得出现 `[data-testid=design-canvas-adapter]`
- `artifacts/slides-*` **禁止**上板
- Composer 预填遵守 `composerInputGuard`；画布「发送到对话」视为显式用户动作

## 3. 目录与 manifest

```
artifacts/canvas-{id}/
  canvas-manifest.json   # 权威清单（原子写 .tmp → rename）
  assets/                # 图片、裁剪产物
  diagrams/              # .excalidraw / .mmd
  exports/               # 整板导出（Phase 5）
```

- `nodes[]`：业务摘要（path 为 **board 相对路径**）
- `tldraw_snapshot`：tldraw 完整状态
- 图片加载：**blob URL**（`readFileBlob`），禁止 tldraw 直链 token URL

## 4. SaaS 写白名单

租户 `PUT /file`、upload 允许：

- `**/artifacts/canvas-*/canvas-manifest.json`
- 同 board 下 `assets/`、`diagrams/`、`exports/`

## 5. Agent 工具（gate ON）

- `canvas_read_board`
- `canvas_add_asset`
- `canvas_add_diagram`
- `canvas_update_manifest`

turn 完成可 dispatch `pilotdeck:canvas-asset-added` 刷新 UI。

## 6. 成果链（L3）

gate ON 时 `collectDeliverables` 识别 `canvas-manifest.json` → `kind: design_canvas` + `turnArtifactDir`。

## 7. 验收 tier

- `fast`：单元 + gate OFF + phase2 E2E
- `full`：+ phase3–4 + 租户写 board
- `matrix`：skill 矩阵（nightly，`--skip-skills` 可跳过）

编排：`npm run test:design-canvas:acceptance -- --tier=fast`
