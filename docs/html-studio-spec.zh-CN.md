# HTML Studio 规范（Nova SuperPreview）

> PD-SAAS-FORK · FieldEditor Phase 1 · VisualEditor Phase 2 · 编辑仅右栏 Dock

## 1. 功能门控

| 层 | 开关 | 说明 |
|----|------|------|
| UI | `localStorage pilotdeck-html-studio-enabled` | 设置页「HTML 可视化编辑」 |
| Build | `VITE_PILOTDECK_HTML_STUDIO=0` | 构建时禁用 |
| SaaS 偏好 | `userPreferences.htmlStudioEnabled` | 登录后 hydrate |
| 租户 | Admin `htmlStudioEnabled`（Phase 1b 可选） | 关闭后仅只读 |

**默认**：localStorage 未设视为 **开启**。

## 2. 交互红线

- 弹窗 **仅查看**；**编辑必须右栏 Dock**（`htmlStudioDock.ts`）
- overlay 内不得挂载 `[data-testid=html-studio-adapter]` 编辑态
- `previewMode` 在 `apiPath` 变更时 **强制 reset 为 view**
- 未保存（`isDirty`）切换 view / 关右栏 / 换 session → 温和确认（i18n）
- Composer 预填 `<html-edit>` 遵守 `composerInputGuard`

## 3. Adapter 决策树

`resolveHtmlEditAdapter(contract, fileName, apiPath)` 返回 `'designCanvas' | 'htmlStudio' | 'none'`：

1. **designCanvas**（gate ON）：图片、excalidraw、`canvas-manifest`、 `artifacts/canvas-*/` 下资源（含 `diagrams/*.html`）
2. **none**：`slide_deck_png` 且 `contract.pages.length > 0` → PPT 工作台
3. **htmlStudio**（gate ON）：`artifacts/**/*.html|htm` 报告/幻灯（无 manifest pages）、非 canvas board 的 `diagram*.html`
4. **none**：其余只读 + Bridge

`showModeToggle = canToggleCanvas || canToggleHtmlStudio`（互斥渲染）。

## 4. FieldEditor（Phase 1）

- **禁止**整页 import 进单一 TipTap Document
- `htmlPatchEngine.parseEditableFields` → `FieldDescriptor[]`（selector、kind、jsonPath?）
- 每字段点击激活 TipTap BubbleMenu；失焦 commit patch
- 编辑容器注入 sibling `*.css` / 内联样式；**非** sandbox iframe
- NGRS：`data-ngrs-*` + `#report-data` JSON 双写；保存后 `NGRS.renderReport`（若存在）

## 5. SaaS 写白名单

租户 `PUT /file`、upload 允许：

- `**/artifacts/**/*.html|htm`
- 同目录 `*.css` / `*.js`（dirname 匹配，GEO 主题）
- `**/artifacts/**/.nova-edit-backups/**`

**拒绝**（`validateHtmlDeliverableWrite`）：

- `<script>` 内容 hash 变更
- 文件 > 2MB

审计：`DATA_ROOT/telemetry/html-studio-writes.jsonl`（tenantId、userId、path、sha256、ts）。

## 6. 保存分流

| 改动 | 通道 |
|------|------|
| 文本 / KPI / 表格单元格 | `api.saveFile` + backup |
| script / 新 block / 版式 | `htmlStudioBridge` → `<html-edit>` |
| 保存后 | `pilotdeck:html-deliverable-updated` |

## 7. VisualEditor（Phase 2）

- 动态 `import('grapesjs')`；Nova graphite 皮肤
- `slide_deck_html` 多页；DOMPurify 保存前消毒
- skills 模板加 `data-nova-block-id`

## 8. 验收

- `npm run test:html-studio:acceptance -- --tier=fast|full`
- E2E：右栏改 h1 → 保存 → F5 保留；NGRS Chart 仍在；移动编辑 disabled
