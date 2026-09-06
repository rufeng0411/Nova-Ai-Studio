"""Slide-oriented hybrid merge: Baidu line OCR primary, MinerU for layout typing."""
from __future__ import annotations

from typing import Any

from hybrid_merge import IMAGE_TYPES, _has_intersection, _is_contained


def _char_center_y(ch: dict[str, Any]) -> float | None:
    bb = ch.get("bbox")
    if isinstance(bb, list) and len(bb) >= 4:
        return (float(bb[1]) + float(bb[3])) / 2
    loc = ch.get("location")
    if isinstance(loc, dict):
        top = float(loc.get("top", 0))
        height = float(loc.get("height", 0))
        return top + height / 2
    return None


def _chars_for_line(chars: list[Any], y0: float, y1: float) -> list[Any]:
    if not chars:
        return []
    mid = (y0 + y1) / 2
    picked: list[Any] = []
    for ch in chars:
        if not isinstance(ch, dict):
            continue
        cy = _char_center_y(ch)
        if cy is None:
            continue
        if y0 - 2 <= cy <= y1 + 2 or abs(cy - mid) <= (y1 - y0) * 0.6:
            picked.append(ch)
    return picked


def _split_multiline_element(el: dict[str, Any]) -> list[dict[str, Any]]:
    text = str(el.get("text") or "").strip()
    bbox = el.get("bbox") or [0, 0, 0, 0]
    if not text or len(bbox) < 4:
        return []
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if len(lines) <= 1:
        return [el]
    x0, y0, x1, y1 = bbox
    h = max(y1 - y0, 1.0)
    line_h = h / len(lines)
    chars = el.get("chars") or []
    out: list[dict[str, Any]] = []
    for i, line in enumerate(lines):
        ly0 = y0 + i * line_h
        ly1 = y0 + (i + 1) * line_h
        item = {**el, "text": line, "bbox": [x0, ly0, x1, ly1]}
        line_chars = _chars_for_line(chars, ly0, ly1)
        if line_chars:
            item["chars"] = line_chars
        elif "chars" in item:
            item.pop("chars", None)
        out.append(item)
    return out


def _inside_any(bbox: list[float], regions: list[list[float]], threshold: float = 0.65) -> bool:
    for rb in regions:
        if _is_contained(bbox, rb, threshold):
            return True
    return False


def _inherit_type(baidu_el: dict[str, Any], mineru_blocks: list[dict[str, Any]]) -> dict[str, Any]:
    bb = baidu_el.get("bbox") or [0, 0, 0, 0]
    item = dict(baidu_el)
    for block in mineru_blocks:
        mb = block.get("bbox") or [0, 0, 0, 0]
        bt = str(block.get("type") or "text").lower()
        if not _has_intersection(bb, mb, 0.15) and not _is_contained(bb, mb, 0.45):
            continue
        if bt in ("title", "heading", "header"):
            item["type"] = "title"
            break
        if bt in ("text", "title", "paragraph", "list"):
            item.setdefault("type", bt)
    item.setdefault("type", "text")
    return item


def merge_slide_text_elements(
    mineru_elements: list[dict[str, Any]],
    baidu_elements: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Keep every Baidu text line; use MinerU only for images + typing + fallback blocks."""
    images = [e for e in mineru_elements if str(e.get("type") or "").lower() in IMAGE_TYPES]
    image_boxes = [e.get("bbox") or [0, 0, 0, 0] for e in images]
    mineru_text_blocks = [
        e for e in mineru_elements
        if str(e.get("text") or "").strip() and str(e.get("type") or "").lower() not in IMAGE_TYPES
    ]

    result: list[dict[str, Any]] = list(images)
    used_baidu = 0

    for b_el in baidu_elements:
        bb = b_el.get("bbox") or [0, 0, 0, 0]
        if _inside_any(bb, image_boxes):
            continue
        result.append(_inherit_type(b_el, mineru_text_blocks))
        used_baidu += 1

    if used_baidu == 0:
        for block in mineru_text_blocks:
            result.extend(_split_multiline_element(block))
        return result

    # MinerU paragraphs Baidu missed (rare): split and add if not overlapping existing lines
    for block in mineru_text_blocks:
        for line_el in _split_multiline_element(block):
            lb = line_el.get("bbox") or [0, 0, 0, 0]
            if _inside_any(lb, image_boxes):
                continue
            dup = False
            for existing in result:
                if not str(existing.get("text") or "").strip():
                    continue
                eb = existing.get("bbox") or [0, 0, 0, 0]
                if _has_intersection(lb, eb, 0.35):
                    dup = True
                    break
            if not dup:
                result.append(line_el)

    return result
