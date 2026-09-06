# Python 与系统依赖

## pip（核心，摘自 `backend/requirements` 实际 import）

| 包 | 用途 |
|----|------|
| `python-pptx` | 写入 `.pptx` |
| `Pillow` | 图像读写、JPEG 压缩、mask |
| `img2pdf` | 页图转 PDF 供 MinerU |
| `Flask` | `ServiceConfig.from_defaults` 读 `current_app.config` |
| `python-dotenv` | CLI 脚本加载 `.env` |

## 外部 API / 服务

| 服务 | 配置键 | 用于 |
|------|--------|------|
| **MinerU** | `MINERU_TOKEN`, `MINERU_API_BASE` | 版面 `layout.json`、块 bbox |
| **百度高精度 OCR** | `BAIDU_API_KEY`, `BAIDU_SECRET_KEY` | hybrid 文字框与内容 |
| **百度表格 OCR** | 同上 | 表格类元素（可选） |
| **百度图像修复** | 同上 | `baidu` / `hybrid` inpaint 去字 |
| **生成式图像编辑** | 项目 `ai_service` | `generative` inpaint、hybrid 画质增强 |
| **VLM（CaptionModel）** | 项目 `ai_service` | 文字颜色/粗体/对齐（可 `--no-text-styles` 跳过） |

## 未包含在本包内、但完整产品链路需要的模块

迁入生产环境时通常还需原仓库中的：

- `services/ai_service.py` / `ai_service_manager.py` — 生成式 inpaint、VLM
- `services/ai_providers/image/*` — 各厂商图像编辑实现
- `app.py` / `config.py` — Flask 配置注入
- `models`（`Project`, `Page`, `Task`, `GeneratedOutput`）— 异步任务与下载
- `services/file_service.py` — 页图路径解析

最小 CLI 路径（`scripts/export_editable_pptx.py`）仍依赖 **`create_app()`** 以加载配置，不是零依赖脚本。

## 字体资源

`pptx_builder.py` 使用 `backend/fonts/NotoSansSC-Regular.ttf` 做**字号测算**（非写入 PPT 字体族）。若缺失该文件，测算回退到字符数估宽。
