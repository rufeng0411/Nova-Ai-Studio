# 可编辑 PPTX 导出 — 程序清单（FILE MANIFEST）

> 路径均相对于包根目录 `editable-pptx-export-kit/`。  
> **必迁** = 最小可编辑导出闭环；**推荐** = 生产/HTTP/测试；**摘录** = 需合并或改写后使用。

---

## 一、文档与脚本

| 路径 | 大小约 | 层级 | 职责 |
|------|--------|------|------|
| `README.md` | 2KB | 必读 | 包说明与快速开始 |
| `docs/ARCHITECTURE.zh-CN.md` | 11KB | 必读 | 架构分析（本文档姊妹篇） |
| `docs/FILE_MANIFEST.zh-CN.md` | — | 必读 | 本清单 |
| `docs/INTEGRATION.zh-CN.md` | — | 必读 | 迁入他项步骤 |
| `docs/DEPENDENCIES.md` | 2KB | 必读 | pip 与外部 API |
| `docs/ENV.example` | 1KB | 必读 | 环境变量 |
| `scripts/export_editable_pptx.py` | 13KB | **必迁** | CLI：图片目录 → 可编辑 pptx |
| `scripts/benchmark_editable_pptx_speed.py` | 7KB | 推荐 | 导出耗时基准 |
| `scripts/verify_export_optimization.py` | 12KB | 推荐 | 烟测与嵌入设置校验 |
| `frontend-reference/exportEditablePPTX.ts.snippet` | 3KB | 参考 | 前端异步导出 API |

---

## 二、核心域模块 `backend/services/image_editability/`（**必迁**，整目录）

| 文件 | 行数级 | 职责 |
|------|--------|------|
| `__init__.py` | 120 | 对外导出 Service、Factory、数据模型 |
| `service.py` | 470 | **主编排**：提取 → inpaint → 递归子图 |
| `extractors.py` | 990 | MinerU/百度表格 OCR 提取器、缓存、layout 解析 |
| `hybrid_extractor.py` | 490 | MinerU∥百度高精度 OCR 合并策略 |
| `factories.py` | 770 | `ServiceConfig.from_defaults`、提取器/inpaint/ VLM 工厂 |
| `data_models.py` | 130 | `BBox`, `EditableElement`, `EditableImage` |
| `coordinate_mapper.py` | 70 | 子图 bbox 局部↔全局 |
| `helpers.py` | 100 | 裁剪子区域、bbox 收集 |
| `inpaint_providers.py` | 610 | Baidu/Generative/Hybrid inpaint |
| `text_attribute_extractors.py` | 720 | VLM 文字样式 `CaptionModelTextAttributeExtractor` |

**模块内依赖（包内）**：`utils/mask_utils.py`、`utils/ppt_export_config.py`、`utils/mineru_config.py`（经 factories/extractors 间接）

**模块外依赖（原仓库，未打入包）**：`services/file_parser_service.py`、`services/inpainting_service.py`、`services/ai_service*`、`services/prompts.py`（可用本包 `prompts_editable_pptx_excerpt.py` 替代片段）

---

## 三、导出编排 `backend/services/`

| 文件 | 大小 | 层级 | 职责 |
|------|------|------|------|
| `export_service.py` | 78KB | **必迁** | `create_editable_pptx_with_recursive_analysis`、`_add_editable_elements_to_slide`、`_batch_extract_text_styles_hybrid`、`ExportEmbedImageCache`、快速 PPTX 等（大文件，可只保留可编辑相关函数迁出） |
| `file_parser_service.py` | 41KB | **必迁** | MinerU/MarkItDown 文件解析、`parse_file` |
| `inpainting_service.py` | 13KB | 条件必迁 | `DefaultInpaintProvider` 火山等 inpaint；仅用 `baidu` 时可弱化 |
| `prompts_editable_pptx_excerpt.py` | 7KB | 摘录 | VLM 样式 prompt 两段函数 |
| `export_editable_pptx_task_EXCERPT.py` | 15KB | 摘录 | 原 `task_manager.py` L2326–2628 异步任务 |

---

## 四、工具 `backend/utils/`

| 文件 | 层级 | 职责 |
|------|------|------|
| `pptx_builder.py` | **必迁** | python-pptx 写入：文本框、字号拟合、图片块 |
| `mask_utils.py` | **必迁** | bbox → inpaint mask |
| `latex_utils.py` | **必迁** | MinerU 行内公式转纯文本 |
| `mineru_config.py` | **必迁** | Token/API Base 解析、过期检测 |
| `ppt_export_config.py` | **必迁** | 缓存、workers、inpaint 默认、画质增强开关 |
| `export_filename.py` | 推荐 | 导出文件名与下载路径（HTTP 任务用） |
| `page_utils.py` | 推荐 | `get_filtered_pages`、`resolve_export_page_image_abs_path` |

---

## 五、OCR 适配 `backend/services/ai_providers/ocr/`

| 文件 | 层级 | 职责 |
|------|------|------|
| `__init__.py` | **必迁** | `create_baidu_accurate_ocr_provider` 等工厂 |
| `baidu_accurate_ocr_provider.py` | **必迁** | hybrid 文字定位 |
| `baidu_table_ocr_provider.py` | 推荐 | 表格元素 |

---

## 六、HTTP 层摘录 `backend/controllers/`

| 文件 | 层级 | 职责 |
|------|------|------|
| `export_editable_pptx_route_EXCERPT.py` | 摘录 | `POST .../export/editable-pptx` 创建 `EXPORT_EDITABLE_PPTX` 任务 |

---

## 七、原仓库相关但未复制入包（迁移时按需拷贝）

| 原路径 | 说明 |
|--------|------|
| `backend/services/ai_service.py` | 生成式 inpaint、VLM 调用中枢 |
| `backend/services/ai_service_manager.py` | `get_ai_service()` |
| `backend/services/ai_providers/image/*` | 各厂商图像编辑 |
| `backend/services/task_manager.py` | 完整任务调度（本包仅摘录导出函数） |
| `backend/controllers/export_controller.py` | 完整导出控制器 |
| `backend/models/project.py` 等 | ORM |
| `backend/services/file_service.py` | 上传路径 |
| `backend/fonts/NotoSansSC-Regular.ttf` | 字号测算字体（仓库内可能未跟踪，需自备 CJK 字体） |
| `frontend/src/api/endpoints.ts` | 完整前端 API |
| `frontend/src/pages/agent/components/PptExportPanel.tsx` | 导出 UI |

---

## 八、原仓库测试（回归参考，未复制）

| 路径 | 覆盖点 |
|------|--------|
| `backend/tests/unit/test_ppt_export_config.py` | 导出配置 |
| `backend/tests/unit/test_mineru_export_cache.py` | MinerU 缓存 |
| `backend/tests/unit/test_export_filename.py` | 文件名 |
| `backend/tests/unit/test_export_page_image_paths.py` | 页图路径 |
| `backend/tests/unit/test_export_letterbox.py` | 快速 PPTX 嵌入 |
| `backend/scripts/diagnose_mineru.py` | MinerU 探活 |

---

## 九、调用关系简图（便于对照清单）

```
export_editable_pptx.py / export_controller / task_EXCERPT
    └── ExportService.create_editable_pptx_with_recursive_analysis
            ├── ImageEditabilityService.make_image_editable  [每页]
            │       ├── HybridElementExtractor / MinerUElementExtractor
            │       │       ├── FileParserService (MinerU)
            │       │       └── baidu_accurate_ocr_provider
            │       └── InpaintProvider (baidu/generative/hybrid)
            ├── _batch_extract_text_styles_hybrid  [可选]
            │       └── CaptionModelTextAttributeExtractor → ai_service
            └── PPTXBuilder + _add_editable_elements_to_slide
                    └── ExportEmbedImageCache (JPEG)
```

---

## 十、按迁移场景打包建议

| 场景 | 最少文件集 |
|------|------------|
| **离线 CLI 验证** | `image_editability/*` + `export_service.py` + `file_parser_service.py` + `utils/pptx_builder|mask|latex|mineru|ppt_export` + `ocr/*` + `scripts/export_editable_pptx.py` |
| **仅 baidu、无 VLM** | 上表 + 不配 `ai_service`；`--no-text-styles`；`inpaint=baidu` |
| **完整产品 HTTP** | 上表 + `task_EXCERPT` + `route_EXCERPT` + `page_utils` + `export_filename` + 原仓库 models/task_manager 胶水 |

---

## 十一、文件统计（本包）

- **Python 源文件**：约 22 个（含 3 个摘录）
- **文档**：5 个
- **脚本**：3 个
- **总体积**：约 450KB（无 `__pycache__`）

打包 zip 文件名：`editable-pptx-export-kit-20260614.zip`（位于 `packages/`）。
