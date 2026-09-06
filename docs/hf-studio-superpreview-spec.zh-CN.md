# HyperFrames Studio × SuperPreview 规格

权威对照 [html-studio-spec.zh-CN.md](./html-studio-spec.zh-CN.md)。

## 门控

- `VITE_PILOTDECK_HF_STUDIO=0` / `PILOTDECK_HF_STUDIO=0` 关闭
- 设置页 `pilotdeck-hf-studio-enabled`（未设=开）

## 互斥

- `artifacts/task-*/hf-project/**` 仅走 `hyperframesStudio`
- HTML Studio 对 `hf-project/` **显式禁用**

## 预览红线

- **弹层**：仅 view（工程 iframe + promo 视频）
- **右栏**：可 edit（懒加载 `@hyperframes/studio`）
- **promo.mp4**：禁止 PUT，仅 Bridge `POST …/hyperframes/render` 或 Gateway `render_hyperframes`

## 写白名单

- 允许：`hf-project/**.{html,css,js,mjs,json,svg,png,jpg,webp,woff2}` + `.nova-edit-backups/**`
- 拒绝：路径逃逸、`promo.mp4` 直写

## 渲染

- 原子写盘：`.hf-render/{jobId}.mp4.partial` → `rename` → `promo.mp4`
- 跨进程锁：`promo.mp4.lock`（Bridge + Gateway 同源）
- 503 队列满：UI 退避，文案「正在渲染，请稍候」

## 四线刷新

re-render 后 `dispatchHfDeliverableUpdated` → 失效 validate cache / pipeline cache → Dock/footer/export/文件夹 Tab 同源。

## Agent 协作

Composer 预填 `@…/hf-project/index.html` + `<hf-edit>…</hf-edit>`。

## 验收

```bash
npm run test:hf-studio:acceptance
npm run test:hf-studio:four-line -- --gate
npm run test:hf-studio:superpreview:e2e
npm run test:hyperframes:gateway-live
```
