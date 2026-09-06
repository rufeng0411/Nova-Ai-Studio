# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(r"F:/Ai-pilotdeck/docs/code-restore-points-registry.zh-CN.md")
text = p.read_text(encoding="utf-8")

old_head = (
    "**当前 HEAD**：`d0145ae8`  \n"
    "**最新可用还原点**：`restore-point/post-partial-showcase-upload-20260804063414`"
    "（★ **部分案例上传** — Showcase 案例上架与预览 UX）"
)
new_head = (
    "**当前 HEAD**：`54da83ce`  \n"
    "**最新可用还原点**：`restore-point/pre-workbench-yield-align-20260805093545`"
    "（**工作台良品率对齐展示策略执行前**）"
)
if old_head not in text:
    raise SystemExit("head block not found")
text = text.replace(old_head, new_head, 1)

row = (
    "| 0 | `restore-point/pre-workbench-yield-align-20260805093545` | `54da83ce` | "
    "2026-08-05 09:35:45 | **工作台良品率对齐展示策略执行前** — 深度分析+落地计划前基线"
    "（含 Showcase 打包同步） | "
    "[`workbench-yield-align-restore-point-20260805093545.md`]"
    "(./workbench-yield-align-restore-point-20260805093545.md) |\n"
)
marker = (
    "| # | 标签 | 提交 | 时间 | 说明 | 详细文档 |\n"
    "|---|------|------|------|------|----------|\n"
)
if marker not in text:
    raise SystemExit("table header not found")
old0 = "| 0 | `restore-point/post-partial-showcase-upload-20260804063414`"
if old0 not in text:
    raise SystemExit("row 0 not found")
text = text.replace(marker, marker + row, 1)
text = text.replace(
    old0,
    "| 1 | `restore-point/post-partial-showcase-upload-20260804063414`",
    1,
)
p.write_text(text, encoding="utf-8")
print("registry updated OK")
