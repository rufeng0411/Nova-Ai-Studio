# 可编辑 PPTX 迁移基线（editable-pptx-export-kit）

生成说明：对照 Nova `enterprise-ai-training-2026` 验收套图，记录迁移前后指标。

## 验收套图

- 路径：`skills/vendor/nova-1/nova-ppt-aesthetic-slides/acceptance/enterprise-ai-training-2026/`
- 页数：8（16:9）
- manifest：`slide-manifest.json`

## 基线（legacy：`mineru-json-to-pptx-v2`）

| 指标 | 值 |
|------|-----|
| 8 页首次导出（bundled MinerU） | ~18s |
| 8 页二次导出（JSON 缓存） | ~2s |
| 幻灯片尺寸 | 固定 13.333×7.5 英寸（manifest 16:9） |
| 文字框来源 | MinerU 块级 header/text/footer |
| 去字方式 | PIL 高斯模糊 |
| 已知问题 | 文字框位置偏移、重复叠框 |

## 目标（kit 管线：`export-editable-pptx-pd.py`）

| 指标 | 目标 |
|------|------|
| 8 页首次导出 | 20–30s（hybrid + 百度 inpaint + 4 并发） |
| 8 页二次导出 | <5s |
| 幻灯片尺寸 | 页图像素 / 96 DPI |
| 文字框来源 | hybrid：百度 OCR 细框优先 |
| 去字方式 | 百度图像修复（可降级 PIL） |
| bbox 叠加验收 | `python scripts/render-editable-pptx-bbox-overlay.py` |

## 迁移后（Kit 管线）

- 入口：`scripts/export-editable-pptx-pd.py`（默认）；回退 `PILOTDECK_EDITABLE_PPTX_ENGINE=legacy`
- 配置：`tools.baiduAi` + `tools.documentOcr.extractorMethod` / `inpaintMethod`
- 验收：`python scripts/render-editable-pptx-bbox-overlay.py`
- 基准：`npm run smoke:editable-pptx-benchmark`
