"""Foreground text color estimation — delegates to universal_text_style."""
from __future__ import annotations

from typing import Any

from PIL import Image

from universal_text_style import extract_ink_color, parse_char_bboxes


def estimate_text_color_from_image(
    img: Image.Image,
    bbox: list[Any],
    ref_w: int,
    ref_h: int,
    *,
    text_hint: str = "",
    chars: Any = None,
) -> tuple[int, int, int]:
    _ = text_hint  # kept for API compat; color is image-derived only
    w, h = img.size
    if ref_w > 0 and ref_h > 0 and (ref_w != w or ref_h != h):
        scale_x = w / ref_w
        scale_y = h / ref_h
        scaled = [
            bbox[0] * scale_x,
            bbox[1] * scale_y,
            bbox[2] * scale_x,
            bbox[3] * scale_y,
        ]
    else:
        scaled = [float(v) for v in bbox[:4]]
    char_bboxes = parse_char_bboxes(chars) if chars else None
    if char_bboxes and ref_w > 0 and ref_h > 0 and (ref_w != w or ref_h != h):
        sx, sy = w / ref_w, h / ref_h
        char_bboxes = [
            [cb[0] * sx, cb[1] * sy, cb[2] * sx, cb[3] * sy] for cb in char_bboxes
        ]
    return extract_ink_color(img, scaled, char_bboxes=char_bboxes)
