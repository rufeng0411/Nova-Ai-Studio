"""MinerU bbox helpers (pixel vs normalized 0–1)."""
from __future__ import annotations

from typing import Any


def bbox_is_normalized(bbox: list[Any]) -> bool:
    try:
        vals = [abs(float(v)) for v in bbox[:4]]
    except (TypeError, ValueError):
        return False
    return max(vals) <= 1.5


def bbox_to_pixels(bbox: list[Any], ref_w: int, ref_h: int) -> tuple[float, float, float, float]:
    x0, y0, x1, y1 = [float(v) for v in bbox[:4]]
    if bbox_is_normalized(bbox):
        return x0 * ref_w, y0 * ref_h, x1 * ref_w, y1 * ref_h
    return x0, y0, x1, y1


def block_text(block: dict[str, Any]) -> str:
    if str(block.get("type") or "").lower() == "ocr_text":
        return ""
    return str(block.get("text") or block.get("content") or "").strip()


def scale_bbox_to_target(
    bbox: list[Any],
    page_size: tuple[float, float],
    target_w: int,
    target_h: int,
) -> tuple[float, float, float, float]:
    """Scale MinerU layout bbox from page_size to target image pixels."""
    src_w, src_h = page_size
    if src_w <= 0 or src_h <= 0:
        return bbox_to_pixels(bbox, target_w, target_h)
    x0, y0, x1, y1 = [float(v) for v in bbox[:4]]
    if bbox_is_normalized(bbox):
        x0, y0, x1, y1 = bbox_to_pixels(bbox, int(src_w), int(src_h))
    scale_x = target_w / src_w
    scale_y = target_h / src_h
    return x0 * scale_x, y0 * scale_y, x1 * scale_x, y1 * scale_y


def block_usable_for_layer(block: dict[str, Any]) -> bool:
    if not isinstance(block, dict):
        return False
    if str(block.get("type") or "").lower() == "ocr_text":
        return False
    return bool(block_text(block))
