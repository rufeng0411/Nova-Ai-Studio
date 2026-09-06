# 文档统一导出规格（Document Export）

> PD-SAAS-FORK：MD/HTML → PDF/DOCX/PPTX/XLSX 统一管线权威说明。

## 1. 目标

- Agent 通过 **`export_document`** builtin 一键交付主流办公格式。
- 渲染后端以 **DocumentExportProvider** 可拔插注册，builtin / cloud / skill 同级。
- 多模态（图、表、图表截图、视频封面+链接）经 **Document IR** 统一处理。

## 2. 冲突矩阵（与现有能力分工）

| 现有能力 | 裁决 |
|---------|------|
| `compose_images_to_document` | 仅「多图每页一图」；export 不覆盖 |
| `ocr_to_editable_pptx` | 扫描件 PPTX 走 `mineru-ocr-pptx` Provider，共用 Python 脚本 |
| `anth-docx/pptx/xlsx` | 深度编辑 / 模板 unpack；export 负责转换交付 |
| `minimax-pdf` | Skill Provider，`quality=fidelity` 时优先 |
| `office-nutrient` | Cloud Provider，HTML 高保真兜底 |
| `render_html_video` | 视频交付；export 不负责 MP4 |

## 3. Document IR 块类型

| type | 字段 |
|------|------|
| `heading` | `level`, `text` |
| `paragraph` | `text`, `inlines?` |
| `list` | `ordered`, `items[]` |
| `table` | `headers[]`, `rows[][]` |
| `image` | `src`, `alt?`, `resolvedPath?` |
| `chartImage` | `resolvedPath`, `caption?` |
| `videoLink` | `posterPath?`, `href`, `caption?` |
| `code` | `language?`, `text` |
| `pageBreak` | — |
| `slideBreak` | — |

## 4. Provider 注册协议

```typescript
interface DocumentExportProvider {
  id: string;
  formats: ('pdf' | 'docx' | 'pptx' | 'xlsx')[];
  integrationLevel: 'L2' | 'L1' | 'cloud';
  priority: number;
  availability(ctx): 'ready' | 'needs_config' | 'unavailable';
  canHandle(input, ir): boolean;
  render(ctx, ir, options): Promise<ExportResult>;
}
```

Skill 声明见 `config/document-export-providers.json`（及 SKILL frontmatter `document_export`）。

## 5. 配置（`pilotdeck.yaml`）

```yaml
tools:
  document:
    compose: { aspectRatio: "16:9" }   # 兼容 documentCompose
    ocr: { provider: mineru, ... }     # 兼容 documentOcr
    export:
      cloudPreference: cloud_first
      defaultQuality: balanced
      playwright: { poolSize: 1 }
      nutrient: { apiKey: "" }
      providers:
        playwright-pdf: true
        docx-js: true
        python-pptx-ir: true
        exceljs: true
        mineru-ocr-pptx: true
        nutrient: auto
```

## 6. 多模态规则

- **图片**：工作区内路径解析后嵌入。
- **图表**：Playwright 对 chart 容器截图 → `chartImage` 块。
- **视频**：封面帧 + 可点击链接；可选 PPTX 内嵌 mp4。

## 7. 验收清单

- [ ] PDF/DOCX/PPTX/XLSX 可用 Office/WPS/浏览器打开
- [ ] 中文无乱码；表格列对齐
- [ ] PPTX 正文可选中编辑
- [ ] 图表在导出物中可见（非空白）
- [ ] 无 Nutrient Key 时本机路径仍可产出

## 8. UI 导出与异步 Job（PD-SAAS-FORK）

- **入口**：成果弹窗 / 右栏预览 `PreviewActionToolbar` 彩色图标（PDF/Word/PPT/Excel）。
- **API**：
  - `GET /api/projects/:project/files/export/capabilities?path=`
  - `POST /api/projects/:project/files/export` → `{ jobId }`
  - `GET /api/projects/:project/files/export/:jobId`
- **路由**：`resolveExportScope` + `buildExportCapabilities`（`ui/src/shared/`）按工作区上下文选引擎：
  - `export_document` — MD/HTML/CSV/XLSX
  - `compose_images` — 配图幻灯整套 PDF/PPTX
  - `ocr_editable_pptx` — 可编辑文字 PPTX
- **输出**：默认写入源目录 `artifacts/**`（如 `slides-*/{title}-export.pdf`）。
- **Job 存储**：Redis + 内存 fallback；Playwright/OCR 串行队列。

## 9. 导出 Scope 表（UI 智能路由）

| scopeId | 典型产物 | 默认 UI 动作 |
|---------|---------|-------------|
| `report_markdown` | `*.md` 报告 | PDF + Word |
| `report_html` | `*.html` | PDF |
| `geo_bundle` | `artifacts/geo/**` | PDF |
| `slide_deck_png` | `artifacts/slides-*/slide-*.png` | 整套 PDF/PPTX（compose）+ 可编辑 PPTX |
| `slide_deck_html` | 演示 HTML | PDF |
| `slide_native_pptx` | `*.pptx` | 可编辑 PPTX（OCR） |
| `spreadsheet` | `*.csv` `*.xlsx` | XLSX + PDF |
| `scan_pdf_image` | 扫描/单图 | 可编辑 PPTX |
| `image_album` | 同目录多图 | 合成 PDF/PPTX |
| `existing_docx` / `video_media` / `archive_code` | — | 不展示导出条 |
