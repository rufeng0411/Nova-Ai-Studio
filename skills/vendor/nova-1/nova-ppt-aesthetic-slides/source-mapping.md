# Source of Truth Mapping

Portable Skill 资产与 NovaPage 源码对照表。修改后端 prompt 时须同步本 Skill 目录。

| Skill 文件 | 源码函数 / 资产 | 路径 |
|---|---|---|
| `prompts/outline.md` | `get_outline_generation_prompt` / `get_outline_generation_prompt_markdown` | `backend/services/prompts.py` |
| `prompts/page-description.md` | `get_page_description_prompt` | `backend/services/prompts.py` |
| `prompts/image-generation.md` | `get_image_generation_prompt` | `backend/services/prompts.py` |
| `prompts/style-extraction.md` | `get_style_extraction_prompt` | `backend/services/prompts.py` |
| `prompts/style-content-separation.md` | `_template_style_text_separation_*` | `backend/services/prompts.py` |
| `presets/*.md` | `presetStylesI18n` | `frontend/src/config/presetStylesI18n.ts` |
| `presets/README.md` | `inferStyleFromContent` / `PPT_PRESET_STYLES` | `frontend/src/pages/agent/services/commandEngine.ts` |
| `playbook.md` | `create.fromIdea` 展开链 | `frontend/src/pages/agent/services/commandEngine.ts` |
| `schemas/outline-page.json` | Page outline JSON 结构 | `get_outline_generation_prompt` |
| `quality-gates.md` | 描述 prompt 优化测试 | `backend/tests/unit/test_ppt_description_prompt_optimization.py` |

## 不在 portable Skill 范围

- `backend/services/task_manager.py`（异步 worker）
- `backend/services/export_service.py`（MinerU 可编辑导出）
- `backend/ppt2/`（PPT-2 矢量链）
