"""Separate slide text from background for layered editable PPTX."""
from __future__ import annotations

import tempfile
from typing import Any

from PIL import Image, ImageDraw, ImageFilter

from mineru_bbox import bbox_to_pixels


def _scale_bbox(
    bbox: list[Any],
    img_w: int,
    img_h: int,
    ref_w: int,
    ref_h: int,
) -> tuple[int, int, int, int]:
    x0, y0, x1, y1 = bbox_to_pixels(bbox, ref_w, ref_h)
    left = max(0, int(x0 / ref_w * img_w))
    top = max(0, int(y0 / ref_h * img_h))
    right = min(img_w, int(x1 / ref_w * img_w))
    bottom = min(img_h, int(y1 / ref_h * img_h))
    if right <= left:
        right = min(img_w, left + 8)
    if bottom <= top:
        bottom = min(img_h, top + 8)
    return left, top, right, bottom


def _inpaint_pil(img: Image.Image, mask: Image.Image, radius: int = 14) -> Image.Image:
    blurred = img.filter(ImageFilter.GaussianBlur(radius=radius))
    return Image.composite(blurred, img, mask)


def _inpaint_cv2(img: Image.Image, mask: Image.Image) -> Image.Image | None:
    try:
        import cv2  # type: ignore
        import numpy as np  # type: ignore
    except ImportError:
        return None
    rgb = np.array(img.convert("RGB"))
    mask_arr = np.array(mask)
    _, mask_bin = cv2.threshold(mask_arr, 1, 255, cv2.THRESH_BINARY)
    repaired = cv2.inpaint(rgb, mask_bin, inpaintRadius=5, flags=cv2.INPAINT_TELEA)
    return Image.fromarray(repaired)


def build_text_mask(
    size: tuple[int, int],
    bboxes: list[list[Any]],
    ref_w: int,
    ref_h: int,
    *,
    padding: int = 6,
) -> Image.Image:
    w, h = size
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    for bbox in bboxes:
        if not isinstance(bbox, list) or len(bbox) < 4:
            continue
        left, top, right, bottom = _scale_bbox(bbox, w, h, ref_w, ref_h)
        left = max(0, left - padding)
        top = max(0, top - padding)
        right = min(w, right + padding)
        bottom = min(h, bottom + padding)
        draw.rectangle([left, top, right, bottom], fill=255)
    return mask


def remove_text_from_image(
    img: Image.Image,
    bboxes: list[list[Any]],
    ref_w: int,
    ref_h: int,
) -> Image.Image:
    """Inpaint text regions on an in-memory slide image."""
    base = img.convert("RGB")
    if not bboxes:
        return base
    mask = build_text_mask(base.size, bboxes, ref_w, ref_h)
    if mask.getbbox() is None:
        return base
    repaired = _inpaint_cv2(base, mask)
    if repaired is None:
        repaired = _inpaint_pil(base, mask)
    return repaired


def remove_text_from_background(
    image_path: str,
    bboxes: list[list[Any]],
    ref_w: int,
    ref_h: int,
) -> Image.Image:
    """Return raster with text regions inpainted so PPT text boxes are not duplicated."""
    with Image.open(image_path) as source:
        return remove_text_from_image(source, bboxes, ref_w, ref_h)


def estimate_text_color(img: Image.Image, bbox: list[Any], ref_w: int, ref_h: int) -> tuple[int, int, int]:
    w, h = img.size
    left, top, right, bottom = _scale_bbox(bbox, w, h, ref_w, ref_h)
    crop = img.crop((left, top, right, bottom))
    pixels = [p for p in crop.getdata() if isinstance(p, tuple) and len(p) >= 3]
    if not pixels:
        return (32, 32, 32)

    def luminance(rgb: tuple[int, ...]) -> int:
        return int(rgb[0]) + int(rgb[1]) + int(rgb[2])

    def saturation(rgb: tuple[int, ...]) -> float:
        r, g, b = (int(rgb[0]), int(rgb[1]), int(rgb[2]))
        mx = max(r, g, b)
        if mx <= 0:
            return 0.0
        mn = min(r, g, b)
        return (mx - mn) / mx

    pixels.sort(key=luminance)
    dark = pixels[max(0, len(pixels) // 12)]
    light = pixels[min(len(pixels) - 1, int(len(pixels) * 0.88))]

    # Dark slide background → pick bright / saturated foreground (neon titles)
    if luminance(dark) + 60 < luminance(light):
        bright_pool = pixels[int(len(pixels) * 0.45) :]
        if bright_pool:
            bright_pool.sort(key=lambda p: (saturation(p), luminance(p)), reverse=True)
            return (int(bright_pool[0][0]), int(bright_pool[0][1]), int(bright_pool[0][2]))
        return (int(light[0]), int(light[1]), int(light[2]))

    # Light background → darkest readable ink
    ink_pool = pixels[: max(1, len(pixels) // 3)]
    ink_pool.sort(key=luminance)
    ink = ink_pool[0]
    return (int(ink[0]), int(ink[1]), int(ink[2]))


def bbox_font_pt(bbox: list[Any], slide_h_emu: int, ref_h: int, ref_w: int = 1920) -> float:
    _, y0, _, y1 = bbox_to_pixels(bbox, ref_w, ref_h)
    height_px = max(y1 - y0, 12.0)
    # Slide height in points ≈ 7.5" for 16:9; map bbox height proportionally.
    slide_pt = slide_h_emu / 12700.0
    pt = height_px / ref_h * slide_pt * 0.82
    return max(8.0, min(72.0, pt))


def save_temp_background(img: Image.Image, suffix: str = ".png") -> str:
    handle = tempfile.NamedTemporaryFile(prefix="slide-bg-", suffix=suffix, delete=False)
    path = handle.name
    handle.close()
    img.save(path, format="PNG")
    return path
