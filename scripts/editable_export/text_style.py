"""Extract font color / weight / family hints from slide crops (no VLM)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from PIL import Image

from universal_text_style import (  # noqa: E402
    build_typography_context,
    extract_universal_text_style,
    infer_text_role,
    parse_char_bboxes,
)


@dataclass
class SimpleTextStyle:
    font_color_rgb: tuple[int, int, int]
    is_bold: bool = False
    is_italic: bool = False
    is_underline: bool = False
    text_alignment: str | None = None
    font_name: str | None = None
    colored_segments: list[Any] | None = None


def extract_text_style(
    image: Image.Image,
    bbox: list[float],
    text: str,
    *,
    element_type: str = "text",
    ref_w: int | None = None,
    ref_h: int | None = None,
    char_bboxes: list[list[float]] | None = None,
    chars: Any = None,
    typography: Any | None = None,
) -> SimpleTextStyle:
    _ = ref_w, ref_h  # bbox already in image pixel coords from OCR
    uni = extract_universal_text_style(
        image,
        bbox,
        text,
        element_type=element_type,
        char_bboxes=char_bboxes,
        chars=chars,
        typography=typography,
    )
    return SimpleTextStyle(
        font_color_rgb=uni.font_color_rgb,
        is_bold=uni.is_bold,
        is_italic=uni.is_italic,
        is_underline=uni.is_underline,
        text_alignment=uni.text_alignment,
        font_name=uni.font_name,
        colored_segments=uni.colored_segments,
    )


def classify_slide_roles(
    elements: list[dict[str, Any]],
    img_w: int,
    img_h: int,
    *,
    image: Image.Image | None = None,
) -> list[dict[str, Any]]:
    """Assign title/heading roles from relative bbox height (no layout heuristics)."""
    ctx = build_typography_context(image, elements) if image else None
    if ctx is None:
        from universal_text_style import SlideTypographyContext

        heights = sorted(
            max(0.0, float(e["bbox"][3]) - float(e["bbox"][1]))
            for e in elements
            if e.get("bbox") and len(e["bbox"]) >= 4
        )
        if not heights:
            ctx = SlideTypographyContext(0.0, 0.0, False)
        else:
            p90 = heights[min(len(heights) - 1, int(0.9 * (len(heights) - 1)))]
            p65 = heights[min(len(heights) - 1, int(0.65 * (len(heights) - 1)))]
            ctx = SlideTypographyContext(p90, p65, False)

    out: list[dict[str, Any]] = []
    for el in elements:
        item = dict(el)
        text = str(item.get("text") or "").strip()
        bbox = item.get("bbox") or [0, 0, 0, 0]
        if text and len(bbox) >= 4:
            role = infer_text_role(bbox, text, str(item.get("type") or "text"), ctx, img_w)
            if role == "title":
                item["type"] = "title"
            elif role == "heading" and str(item.get("type") or "").lower() != "title":
                item["type"] = "heading"
        out.append(item)
    return out


def attach_text_styles(
    image: Image.Image,
    elements: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Annotate each text element with a SimpleTextStyle for PPTXBuilder."""
    w, h = image.size
    ctx = build_typography_context(image, elements)
    out: list[dict[str, Any]] = []
    for el in elements:
        item = dict(el)
        text = str(item.get("text") or "").strip()
        bbox = item.get("bbox")
        if text and isinstance(bbox, list) and len(bbox) >= 4:
            role = infer_text_role(
                bbox,
                text,
                str(item.get("type") or "text"),
                ctx,
                w,
            )
            if role == "title":
                item["type"] = "title"
            elif role == "heading" and str(item.get("type") or "").lower() != "title":
                item["type"] = "heading"
            char_bboxes = parse_char_bboxes(item.get("chars"))
            item["text_style"] = extract_text_style(
                image,
                bbox,
                text,
                element_type=str(item.get("type") or "text"),
                char_bboxes=char_bboxes or None,
                chars=item.get("chars"),
                typography=ctx,
            )
        out.append(item)
    return out
