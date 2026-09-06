# 可编辑 PPTX 导出技术包（Editable PPTX Export Kit）

从 **NovaPage / AiBananaSlide** 仓库抽取的「幻灯片页图 → 可编辑 `.pptx`」完整实现与文档，便于迁移到其他项目。

**生成日期**：2026-06-14  
**源仓库路径**：`f:/AiBananaSlide`（公开 canonical：`https://github.com/rufeng0411/novapage`）

---

## 包里有什么

| 目录/文件 | 说明 |
|-----------|------|
| `docs/ARCHITECTURE.zh-CN.md` | 技术架构分析（数据流、坐标/字体/速度策略、局限） |
| `docs/FILE_MANIFEST.zh-CN.md` | **程序清单**：每个源文件职责、依赖、是否必迁 |
| `docs/INTEGRATION.zh-CN.md` | 迁入其他项目的步骤、耦合点、最小可运行路径 |
| `docs/ENV.example` | 环境变量模板 |
| `docs/DEPENDENCIES.md` | Python 依赖与外部 API |
| `backend/` | 核心 Python 源码（保持与原仓库相同的相对路径） |
| `scripts/export_editable_pptx.py` | **推荐**：无业务库、仅页图列表即可导出的 CLI |
| `scripts/benchmark_editable_pptx_speed.py` | 速度对比基准 |
| `scripts/verify_export_optimization.py` | 导出烟测 |
| `frontend-reference/` | 前端 `exportEditablePPTX` API 片段 |
| `backend/services/*_EXCERPT.py` | 从巨型文件摘录的任务/路由/Prompt（带行号注释） |

---

## 最快验证（在本包所在 monorepo 根目录）

```bash
# 在 AiBananaSlide 项目根（有 backend/ 与 .env）
python scripts/export_editable_pptx.py path/to/slide.png -o out.pptx --inpaint baidu --no-text-styles
```

迁入其他项目时，将 `backend/` 合并到你的服务目录，并阅读 `docs/INTEGRATION.zh-CN.md`。

---

## 核心能力一句话

**MinerU 版面 + 百度 OCR（hybrid）→ 文本 bbox → inpaint 去字底图 → python-pptx 叠可编辑文本框**；可选 VLM 提取颜色/粗体等样式。

---

## 许可与归属

- `PPTXBuilder` 注释标明参考 OpenDCAI/DataFlow-Agent 思路。
- MinerU、百度 OCR、生成式 inpaint 等需各自 API 合规与计费。
- 本包为源码快照，不单独授权；遵循原仓库开源协议。
