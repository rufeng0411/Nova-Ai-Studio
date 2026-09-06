# 迁入其他项目 — 集成指南

## 1. 推荐路径（由易到难）

### 路径 A：CLI 验证（1–2 小时）

1. 将本包 `backend/` 合并到你项目的 `backend/`（保持 `services/`、`utils/` 相对路径）。
2. 从原 NovaPage 仓库复制 **`app.py`/`create_app` 最小子集** 或改写 `scripts/export_editable_pptx.py` 的 `setup_flask_app()`，改为读取你的配置对象。
3. 配置 `docs/ENV.example` 中的 `MINERU_TOKEN`；hybrid 模式还需百度 Key。
4. 运行：
   ```bash
   python scripts/export_editable_pptx.py ./slides/ -o demo.pptx --inpaint baidu --no-text-styles
   ```

### 路径 B：嵌入现有后端服务

1. 暴露与 NovaPage 等价的 API：
   - `POST /api/projects/{id}/export/editable-pptx`
   - 返回 `{ task_id }`，后台跑 `export_editable_pptx_with_recursive_analysis_task`（见 `export_editable_pptx_task_EXCERPT.py`）。
2. 实现 **页图解析**：等价于 `page_utils.resolve_export_page_image_abs_path`（读你的存储/DB 字段）。
3. 任务表字段：`task_type=EXPORT_EDITABLE_PPTX`，`progress` JSON 含 `percent`、`messages`、`download_url`。
4. 前端轮询任务状态后下载（参考 `frontend-reference/exportEditablePPTX.ts.snippet`）。

### 路径 C：库化（长期）

- 将 `image_editability` + `create_editable_pptx_with_recursive_analysis` 抽成独立 Python 包，定义 `ExportConfig` dataclass，去掉 Flask `current_app`。
- inpaint/VLM 通过 Protocol 注入，默认实现仅 MinerU+百度+python-pptx。

---

## 2. 必改耦合点清单

| 耦合 | 现实现 | 迁移动作 |
|------|--------|----------|
| Flask config | `ServiceConfig.from_defaults` 读 `current_app.config` | 传入 `upload_folder`, `MINERU_TOKEN` 或改工厂签名 |
| AI 网关 | `get_ai_service()` | generative/hybrid 增强/VLM 需要；可关闭 |
| 上传目录 | `UPLOAD_FOLDER/mineru_files`、`mineru_cache` | 需可写目录 |
| Prompt import | `from services.prompts import get_text_attribute_*` | 改为 `prompts_editable_pptx_excerpt` 或内联 |
| 项目 ORM | `Project.export_skip_text_styles` 等 | 映射为你项目的导出设置表或请求体字段 |

---

## 3. `text_attribute_extractors.py` 迁移提示

原 import：

```python
from services.prompts import get_text_attribute_extraction_prompt
```

可改为：

```python
from services.prompts_editable_pptx_excerpt import get_text_attribute_extraction_prompt, get_batch_text_attribute_extraction_prompt
```

并在 `get_batch_text_attribute_extraction_prompt` 可用前，确认摘录文件包含该函数（本包已摘录 L1222–1348 一段）。

---

## 4. 生产推荐配置（速度优先）

```env
PPT_EXPORT_MINERU_CACHE=1
PPT_EXPORT_DEFAULT_INPAINT_METHOD=baidu
PPT_EXPORT_INPAINT_ENHANCE_QUALITY=0
# 请求体或项目默认 skip_text_styles=true
```

提取器：`export_extractor_method=hybrid`（MinerU 失效时百度 OCR 可降级）。

---

## 5. 生产推荐配置（质量优先）

```env
PPT_EXPORT_DEFAULT_INPAINT_METHOD=hybrid
PPT_EXPORT_INPAINT_ENHANCE_QUALITY=1
# skip_text_styles=false，启用 CaptionModel
```

注意 API 成本与耗时显著上升。

---

## 6. 常见问题

**Q: 导出 pptx 只有整页图、没有文字框？**  
A: 版面分析 0 文本层。查 `MINERU_TOKEN`、hybrid 是否启用、百度 OCR 是否配置；看日志 `no_text_layers`。

**Q: 文字位置偏了？**  
A: 检查页图与 `slide_width_pixels/height` 是否一致；是否混用不同宽高比页面；递归深度与子图 `bbox_global`。

**Q: 字体和原图不一样？**  
A: 预期行为。当前未写入 `font.name`，字号为 bbox 拟合。见 `ARCHITECTURE.zh-CN.md` §3.2。

**Q: 能否不依赖 Flask？**  
A: 可以，但需改写 `ServiceConfig.from_defaults` 与 `export_editable_pptx.py` 的 `create_app()`；核心算法不依赖 Flask。

---

## 7. 与原仓库同步

本包为**时间点快照**。若 NovaPage 上游更新导出逻辑，建议 diff 下列文件优先：

1. `image_editability/extractors.py`（MinerU 解析）
2. `export_service.py`（`create_editable_pptx_*`）
3. `pptx_builder.py`（字号/文本框）
4. `ppt_export_config.py`（性能开关）

---

## 8. 联系与溯源

- 源仓库：`https://github.com/rufeng0411/novapage`
- 本包路径：`packages/editable-pptx-export-kit/`
- 架构详解：`docs/ARCHITECTURE.zh-CN.md`
- 程序清单：`docs/FILE_MANIFEST.zh-CN.md`
