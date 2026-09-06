"""Parse MinerU layout.json / content_list into pixel-space text elements."""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

SCRIPT_LIB = Path(__file__).resolve().parent.parent / "lib"
if str(SCRIPT_LIB) not in sys.path:
    sys.path.insert(0, str(SCRIPT_LIB))

from latex_utils import latex_to_text  # noqa: E402
from mineru_bbox import bbox_is_normalized, bbox_to_pixels  # noqa: E402


def _extract_text_from_lines(lines: list[dict[str, Any]]) -> str:
    line_texts: list[str] = []
    for line in lines:
        span_texts: list[str] = []
        for span in line.get("spans") or []:
            span_type = span.get("type", "")
            span_content = str(span.get("content") or "").strip()
            if span_type == "text" and span_content:
                span_texts.append(span_content)
            elif span_type == "inline_equation" and span_content:
                span_texts.append(latex_to_text(span_content))
        if span_texts:
            line_texts.append("".join(span_texts))
    return "\n".join(line_texts).strip()


def _process_block(
    block: dict[str, Any],
    scale_x: float,
    scale_y: float,
) -> dict[str, Any] | None:
    bbox = block.get("bbox")
    block_type = str(block.get("type") or "text").lower()
    if not bbox or len(bbox) < 4:
        return None
    if block_type == "ocr_text":
        return None

    if block_type in ("header", "footer") and block.get("lines"):
        combined = _extract_text_from_lines(block["lines"])
        if combined.strip() == "#":
            return None

    scaled = [
        float(bbox[0]) * scale_x,
        float(bbox[1]) * scale_y,
        float(bbox[2]) * scale_x,
        float(bbox[3]) * scale_y,
    ]

    actual_type = block_type
    if block_type in ("header", "footer"):
        has_image = any(
            str(sb.get("type") or "") == "image_body" for sb in (block.get("blocks") or [])
        )
        has_text = bool(_extract_text_from_lines(block.get("lines") or []))
        if has_image and not has_text:
            actual_type = "image"
        else:
            actual_type = "text"

    if actual_type in ("image", "figure", "chart", "diagram"):
        return {"bbox": scaled, "type": actual_type, "text": "", "source": "mineru"}

    content = ""
    if actual_type in ("text", "title", "table_caption", "image_caption"):
        content = _extract_text_from_lines(block.get("lines") or [])
    elif actual_type == "list":
        parts: list[str] = []
        for sub in block.get("blocks") or []:
            t = _extract_text_from_lines(sub.get("lines") or [])
            if t:
                parts.append(t)
        content = "\n".join(parts).strip()
    elif block.get("lines"):
        content = _extract_text_from_lines(block["lines"])
    else:
        content = str(block.get("text") or block.get("content") or "").strip()

    if not content:
        return None
    return {"bbox": scaled, "type": actual_type, "text": content, "source": "mineru"}


def _iter_blocks(page_info: dict[str, Any]) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    for key in ("para_blocks", "preproc_blocks", "discarded_blocks"):
        for block in page_info.get(key) or []:
            if isinstance(block, dict):
                blocks.append(block)
    return blocks


def elements_from_layout_dir(
    mineru_dir: str | Path,
    target_w: int,
    target_h: int,
    page_index: int = 0,
) -> list[dict[str, Any]]:
    root = Path(mineru_dir)
    layout_file = root / "layout.json"
    if not layout_file.is_file():
        content_lists = list(root.glob("*_content_list.json")) or list(root.glob("content_list.json"))
        if not content_lists:
            return []
        with open(content_lists[0], encoding="utf-8") as handle:
            raw = json.load(handle)
        return _elements_from_flat_list(raw, target_w, target_h, page_index)

    with open(layout_file, encoding="utf-8") as handle:
        layout_data = json.load(handle)

    pdf_info = layout_data.get("pdf_info") or []
    if not pdf_info:
        return []
    page_info = pdf_info[min(page_index, len(pdf_info) - 1)]
    page_size = page_info.get("page_size") or [target_w, target_h]
    src_w, src_h = float(page_size[0]), float(page_size[1])
    if src_w <= 0 or src_h <= 0:
        src_w, src_h = float(target_w), float(target_h)
    scale_x = target_w / src_w
    scale_y = target_h / src_h

    elements: list[dict[str, Any]] = []
    for block in _iter_blocks(page_info):
        el = _process_block(block, scale_x, scale_y)
        if el:
            elements.append(el)
    return elements


def _elements_from_flat_list(
    raw: Any,
    target_w: int,
    target_h: int,
    page_index: int,
) -> list[dict[str, Any]]:
    pages: list[Any]
    if isinstance(raw, list) and raw and isinstance(raw[0], list):
        pages = raw
    elif isinstance(raw, list):
        pages = [raw]
    elif isinstance(raw, dict):
        pages = [raw.get("content_list") or raw.get("pdf_info") or raw]
    else:
        return []

    page_blocks = pages[min(page_index, len(pages) - 1)] if pages else []
    if not isinstance(page_blocks, list):
        return []

    elements: list[dict[str, Any]] = []
    for block in page_blocks:
        if not isinstance(block, dict):
            continue
        bbox = block.get("bbox")
        if not bbox or len(bbox) < 4:
            continue
        x0, y0, x1, y1 = bbox_to_pixels(list(bbox), target_w, target_h)
        text = str(block.get("text") or block.get("content") or "").strip()
        if not text or str(block.get("type") or "").lower() == "ocr_text":
            continue
        elements.append(
            {
                "bbox": [x0, y0, x1, y1],
                "type": str(block.get("type") or "text"),
                "text": text,
                "source": "mineru",
            }
        )
    return elements
