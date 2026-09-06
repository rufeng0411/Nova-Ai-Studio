# 可编辑 PPTX 导出 — 技术架构分析

> 本文档描述 NovaPage 仓库中「页图 → 可编辑 PowerPoint」链路的实现原理，与 `backend/` 内源码一一对应。  
> 读者无需打开原 monorepo 即可理解设计与迁移要点。

---

## 1. 问题定义与产物形态

**输入**：每张幻灯片一张位图（通常为 AI 生成的 `generated_image_path`，任意分辨率与宽高比）。

**输出**：`.pptx`，每页结构为：

1. **底层**：去掉文字后的背景图（`clean_background`，inpaint 产物）或原图；
2. **上层**：多个可编辑 **文本框**（`python-pptx` `add_textbox`），位置与 OCR/版面 bbox 对齐；
3. **可选**：图表/图片/表格区域以图片块或递归子元素呈现。

用户可在 PowerPoint 中选中文字修改；**不是** OCR 嵌入 PDF，也**不是**整页单张不可编辑图（那是 `create_pptx_from_images`「快速 PPTX」）。

---

## 2. 逻辑架构（五阶段）

```
┌─────────────┐    ┌──────────────────┐    ┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│ 页图 PNG/JPG │ -> │ ImageEditability │ -> │ 样式提取     │ -> │ PPTXBuilder  │ -> │  .pptx 文件  │
│  (N 张)      │    │ Service 版面分析  │    │ (可选 VLM)   │    │ 组装幻灯片    │    │             │
└─────────────┘    └──────────────────┘    └─────────────┘    └──────────────┘    └─────────────┘
                          │                        │
                          v                        v
                   MinerU + 百度 OCR          CaptionModel
                   inpaint 去字              颜色/粗体/对齐
```

### 2.1 编排入口（三种）

| 入口 | 源文件 | 说明 |
|------|--------|------|
| **HTTP 异步** | `export_controller.py` → `task_manager.export_editable_pptx_with_recursive_analysis_task` | `POST .../export/editable-pptx`，返回 `task_id`，轮询任务进度 |
| **服务 API** | `ExportService.create_editable_pptx_with_recursive_analysis` | 可被任意后台任务/脚本调用 |
| **CLI** | `scripts/export_editable_pptx.py` | 本地图片列表 → PPTX，最适合迁库验证 |

### 2.2 阶段 A：版面分析（`ImageEditabilityService`）

**文件**：`backend/services/image_editability/service.py`

对每张图执行 `make_image_editable(image_path)`：

1. **提取元素** `_extract_elements` → 注册表选 `HybridElementExtractor` 或纯 `MinerUElementExtractor`；
2. **转 EditableElement** `_convert_to_editable_elements`（bbox、content、element_type）；
3. **生成 clean background** `_generate_clean_background`（按文本 bbox mask → inpaint）；
4. **可选递归** `_process_children`（`max_depth>1` 时对图表/图片内子区域再分析）。

服务设计为**无状态**，页级并发由 `ThreadPoolExecutor` 在 `ExportService` 层调度。

### 2.3 阶段 B：元素提取（Hybrid / MinerU）

#### MinerU 路径（`extractors.py` → `MinerUElementExtractor`）

1. 单页图 → 临时 PDF（`ExportService.create_pdf_from_images`）；
2. `FileParserService.parse_file` 上传 MinerU API；
3. 结果落盘 `uploads/mineru_files/{extract_id}/`：`layout.json`、`*_content_list.json`；
4. 读 `pdf_info[0].page_size`，将块 `bbox` **线性缩放**到实际像素尺寸；
5. 从 `lines/spans` 抽文本，行内公式经 `latex_utils.latex_to_text`。

**缓存**：`uploads/mineru_cache/{sha256}.json` 指向 `extract_id`，`PPT_EXPORT_MINERU_CACHE=1`（默认开）时重复导出同图跳过远程解析。

#### Hybrid 路径（`hybrid_extractor.py`）

单页内 **MinerU ∥ 百度高精度 OCR** 并行，再 `_merge_results`：

- 图片块**包含**的 OCR 框 → 丢弃（避免图内字重复）；
- 表格块内 OCR 框 → **保留 OCR**，删 MinerU 表格块；
- 其他文字区与 OCR **有交集** → 以 **OCR 的 bbox+文本** 为准。

降级：MinerU 401/失败时，若仍有合并元素则**部分成功**继续导出。

### 2.4 阶段 C：背景修复（Inpaint）

**文件**：`inpaint_providers.py`、`factories.py`（`InpaintProviderRegistry`）

| 模式 | 实现 | 速度/成本 |
|------|------|-----------|
| `baidu` | `BaiduInpaintProvider` | 快、成本低，**生产默认**（`PPT_EXPORT_DEFAULT_INPAINT_METHOD`） |
| `generative` | `GenerativeEditInpaintProvider`（`ai_service` 图编辑） | 慢、API 贵 |
| `hybrid` | 百度修复 + 可选生成式画质提升 | `PPT_EXPORT_INPAINT_ENHANCE_QUALITY=0` 默认跳过第二步以提速 |

流程：`mask_utils.create_mask_from_bboxes` 按文本区域生成 mask → provider 修复 → 保存 `clean_background` 路径。

### 2.5 阶段 D：文字样式（可选）

**文件**：`text_attribute_extractors.py`、`export_service._batch_extract_text_styles_hybrid`

当 `skip_text_styles=False` 时：

- **全图批量**（`extract_batch_with_full_image`）：粗体、斜体、下划线、对齐；
- **单块裁剪**（`extract`）：字体颜色、`colored_segments` 多色段。

Prompt 见 `prompts_editable_pptx_excerpt.py`（原 `services/prompts.py`）。

**重要**：`TextStyleResult` **不包含字号**；字号由 `PPTXBuilder.calculate_font_size` 根据 bbox **几何拟合**。

**默认加速**：项目字段 `export_skip_text_styles` 为 NULL 时视为 **True**，任务层不创建 VLM 提取器。

### 2.6 阶段 E：PPTX 组装（`PPTXBuilder` + `ExportService._add_editable_elements_to_slide`）

**文件**：`utils/pptx_builder.py`、`export_service.py`（约 L1480–1810）

每页：

1. `setup_presentation_size(slide_width_pixels, slide_height_pixels)` — 通常取**首张页图像素**；
2. `add_blank_slide`；
3. `add_picture(clean_background)` 铺满幻灯片（经 `ExportEmbedImageCache` JPEG 压缩以减小体积）；
4. 遍历 `EditableElement`：
   - 文本类 → `add_text_element(bbox_list, text, text_style)`；
   - 表格 → inpaint 背景 + 递归子单元格；
   - 图片/图表 → 原图或递归子层。

**坐标链**：

```
MinerU/OCR 像素 bbox
  → (递归时) CoordinateMapper.local_to_global
  → 页级 scale_x/y = slide_px / image_px
  → 像素 ÷ 96 DPI → 英寸 → EMU (python-pptx)
```

文本框 **margin=0**，bbox **外扩 1%** 防裁切。

---

## 3. 位置、字体、视觉一致性

### 3.1 位置

- **来源**：MinerU 块级 bbox + hybrid 时 OCR 细框；
- **一致性手段**：与页图同一像素坐标系；写入前统一 `scale_x/y`；递归子图用 `bbox_global`；
- **局限**：python-pptx 幻灯片最大 56 英寸，超大像素图会**等比缩小**整页（bbox 同比例缩放）。

### 3.2 字体

| 属性 | 实现 | 与原图一致度 |
|------|------|----------------|
| **字号** | `calculate_font_size` 二分搜索 + NotoSansSC 测宽 | 几何近似，非 OCR 字号 |
| **字体族** | **未设置** `font.name` | PPT 用主题默认字体，**不还原**原图字体 |
| **颜色** | VLM `colored_segments` / `font_color_rgb` | 依赖模型，可 `--no-text-styles` 跳过 |
| **粗斜体/对齐** | VLM 全图批量 | 同上 |

### 3.3 视觉叠层

去字底图 + 上层文字 ≈ 原图外观；inpaint 质量决定「底图是否留残影」。`baidu` 快但复杂背景可能略糊；`generative` 更干净但更慢。

---

## 4. 性能工程

| 策略 | 配置/代码位置 |
|------|----------------|
| 页级并行 | `max_workers`（1–16），`ExportService` L1392 `ThreadPoolExecutor` |
| Hybrid 内并行 | `hybrid_extractor` MinerU+OCR 双线程 |
| MinerU 缓存 | `get_ppt_export_mineru_cache_enabled()` |
| 默认跳过 VLM 样式 | `skip_text_styles=True`（`export_controller` / 项目字段） |
| 默认 baidu inpaint | `resolve_effective_export_inpaint_method` |
| 关闭 hybrid 二次画质 | `PPT_EXPORT_INPAINT_ENHANCE_QUALITY=0` |
| 嵌入 JPEG 压缩 | `PPT_EXPORT_PPTX_MAX_LONG_EDGE`、`JPEG_QUALITY`、`ExportEmbedImageCache` |
| 样式阶段并发 | `_batch_extract_text_styles_hybrid` 使用 `max_workers * 2` |

基准：`scripts/benchmark_editable_pptx_speed.py` 对比 inpaint / cache / enhance 组合。

---

## 5. 错误处理与可观测性

- **`no_text_layers`**：版面分析 0 个文本元素 → `fail_fast` 抛 `ExportError`（提示检查 MinerU Token、hybrid、百度 OCR）；
- **`ExportWarnings`**：样式失败、渲染失败等收集为警告，半成品模式 `export_allow_partial` 仍可出文件；
- **任务进度**：`progress_callback(step, message, percent)` 映射 0–40% 版面、45–70% 样式、75–100% 构建；
- **日志关键字**：`[export_editable_pptx]`、`[ppt-pipeline-gate]`（若接前端闸门）、MinerU 缓存命中日志。

---

## 6. 与「快速 PPTX」对比

| | 可编辑导出 | `create_pptx_from_images` |
|--|------------|-------------------------|
| API | `POST .../editable-pptx` | `POST .../export/pptx` 等 |
| 页内容 | 去字底图 + 文本框 | 单图 letterbox/铺满 |
| 耗时 | 高（MinerU+inpaint[+VLM]） | 低 |
| 依赖 | MinerU、OCR、inpaint | 仅 Pillow/python-pptx |

---

## 7. 递归深度语义

`max_depth=1`：**仅处理整页**，不进入图表/图片内部；  
`max_depth=2`：对符合条件的 `image/chart` 子区域裁剪后再跑一遍提取（`should_recurse_into_element`、子元素覆盖率阈值 85%）。

产品默认 **1**，与 CLI / 测试一致。

---

## 8. 迁移到其他项目时的架构建议

1. **最小闭环**：保留 `image_editability/` + `export_service.create_editable_pptx_*` + `pptx_builder` + `file_parser_service` + OCR/inpaint 适配层；用 `export_editable_pptx.py` 验证。
2. **解耦 Flask**：将 `ServiceConfig.from_defaults` 改为显式传入 `upload_folder`、`mineru_token` 等，去掉 `current_app` 依赖。
3. **解耦 AIService**：为 `generative` inpaint 与 VLM 定义接口，默认仅 `baidu` + `skip_text_styles` 可零 VLM 运行。
4. **字体增强**（若产品需要）：在 `add_text_element` 增加 `font.name` 映射表或 VLM 识别字体族——**当前源码未实现**。

---

## 9. 关键类与数据结构

| 类型 | 文件 | 说明 |
|------|------|------|
| `EditableImage` | `data_models.py` | 单页：尺寸、elements、clean_background |
| `EditableElement` | `data_models.py` | 单元素：bbox、bbox_global、content、children |
| `BBox` | `data_models.py` | x0,y0,x1,y1；`scale`/`translate` |
| `ExtractionResult` | `extractors.py` | elements + context + error |
| `TextStyleResult` | `text_attribute_extractors.py` | 颜色、粗体、segments |
| `ExportWarnings` | `export_service.py` | 导出警告聚合 |

---

## 10. 版本溯源

本包源码快照取自 AiBananaSlide 工作区；若与原仓库 `main` 有漂移，以你打包时 `packages/editable-pptx-export-kit/backend/` 内文件为准。  
摘录文件（`*_EXCERPT.py`）标注了原文件行号区间，合并上游时需 diff 对照。
