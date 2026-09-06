"""Universal ink color + font hints from OCR boxes (no slide-layout hardcoding)."""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Sequence

from PIL import Image

# ---------------------------------------------------------------------------
# Color space helpers
# ---------------------------------------------------------------------------


def _lum(rgb: tuple[int, ...]) -> float:
    return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]


def _sat(rgb: tuple[int, ...]) -> float:
    r, g, b = (int(rgb[0]), int(rgb[1]), int(rgb[2]))
    mx = max(r, g, b)
    if mx <= 0:
        return 0.0
    return (mx - min(r, g, b)) / mx


def _rgb_to_lab(rgb: tuple[int, ...]) -> tuple[float, float, float]:
    r, g, b = rgb[0] / 255.0, rgb[1] / 255.0, rgb[2] / 255.0

    def _f(u: float) -> float:
        return u ** (1 / 3) if u > 0.008856 else (7.787 * u + 16 / 116)

    r = ((r + 0.055) / 1.055) ** 2.4 if r > 0.04045 else r / 12.92
    g = ((g + 0.055) / 1.055) ** 2.4 if g > 0.04045 else g / 12.92
    b = ((b + 0.055) / 1.055) ** 2.4 if b > 0.04045 else b / 12.92
    x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375
    y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750
    z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041
    x, y, z = x / 0.95047, y / 1.0, z / 1.08883
    fx, fy, fz = _f(x), _f(y), _f(z)
    L = 116 * fy - 16
    a = 500 * (fx - fy)
    b2 = 200 * (fy - fz)
    return (L, a, b2)


def _delta_e(c1: tuple[int, ...], c2: tuple[int, ...]) -> float:
    L1, a1, b1 = _rgb_to_lab(c1)
    L2, a2, b2 = _rgb_to_lab(c2)
    return math.sqrt((L1 - L2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2)


def _median_rgb(pixels: Sequence[tuple[int, ...]]) -> tuple[int, int, int]:
    if not pixels:
        return (0, 0, 0)
    rs = sorted(p[0] for p in pixels)
    gs = sorted(p[1] for p in pixels)
    bs = sorted(p[2] for p in pixels)
    mid = len(pixels) // 2
    return (rs[mid], gs[mid], bs[mid])


def _border_pixels(crop: Image.Image, ratio: float = 0.14) -> list[tuple[int, ...]]:
    w, h = crop.size
    if w < 3 or h < 3:
        return [p[:3] for p in crop.convert("RGB").getdata()]
    bx = max(1, int(w * ratio))
    by = max(1, int(h * ratio))
    pts: list[tuple[int, ...]] = []
    px = crop.load()
    for y in range(h):
        for x in range(w):
            if x < bx or x >= w - bx or y < by or y >= h - by:
                pts.append(px[x, y][:3])
    return pts


def _shrink_bbox(bbox: list[float], margin: float = 0.2) -> tuple[int, int, int, int]:
    x0, y0, x1, y1 = bbox
    w = max(x1 - x0, 1.0)
    h = max(y1 - y0, 1.0)
    mx = w * margin
    my = h * margin
    return (
        int(x0 + mx),
        int(y0 + my),
        int(x1 - mx),
        int(y1 - my),
    )


def _sample_center_pixels(
    image: Image.Image,
    bbox: list[float],
    *,
    grid: int = 3,
) -> list[tuple[int, ...]]:
    x0, y0, x1, y1 = _shrink_bbox(bbox, margin=0.15)
    if x1 <= x0 or y1 <= y0:
        return []
    crop = image.crop((x0, y0, x1, y1))
    w, h = crop.size
    if w < 1 or h < 1:
        return []
    px = crop.load()
    pts: list[tuple[int, ...]] = []
    for gy in range(grid):
        for gx in range(grid):
            cx = int((gx + 0.5) / grid * (w - 1))
            cy = int((gy + 0.5) / grid * (h - 1))
            pts.append(px[cx, cy][:3])
    return pts


def _kmeans2_lab(pixels: list[tuple[int, ...]], iterations: int = 12) -> tuple[tuple[int, int, int], tuple[int, int, int]]:
    if len(pixels) < 2:
        c = pixels[0] if pixels else (128, 128, 128)
        return c, c
    labs = [_rgb_to_lab(p) for p in pixels]
    c0 = pixels[0]
    c1 = pixels[-1]
    for _ in range(iterations):
        g0: list[tuple[int, ...]] = []
        g1: list[tuple[int, ...]] = []
        l0 = _rgb_to_lab(c0)
        l1 = _rgb_to_lab(c1)
        for p, lab in zip(pixels, labs):
            d0 = (lab[0] - l0[0]) ** 2 + (lab[1] - l0[1]) ** 2 + (lab[2] - l0[2]) ** 2
            d1 = (lab[0] - l1[0]) ** 2 + (lab[1] - l1[1]) ** 2 + (lab[2] - l1[2]) ** 2
            (g0 if d0 <= d1 else g1).append(p)
        if g0:
            c0 = _median_rgb(g0)
        if g1:
            c1 = _median_rgb(g1)
    return c0, c1


def estimate_background_rgb(crop: Image.Image) -> tuple[int, int, int]:
    border = _border_pixels(crop)
    if border:
        return _median_rgb(border)
    pixels = [p[:3] for p in crop.convert("RGB").getdata()]
    return _median_rgb(pixels)


def estimate_local_background_rgb(image: Image.Image, bbox: list[float]) -> tuple[int, int, int]:
    """Sample slide background in a ring around the text box (avoids ink inside tight crops)."""
    w, h = image.size
    x0, y0, x1, y1 = (float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3]))
    bw = max(x1 - x0, 4.0)
    bh = max(y1 - y0, 4.0)
    pad_x = bw * 0.5
    pad_y = bh * 0.6
    ox0 = max(0, int(x0 - pad_x))
    oy0 = max(0, int(y0 - pad_y))
    ox1 = min(w, int(x1 + pad_x))
    oy1 = min(h, int(y1 + pad_y))
    ix0 = max(ox0, int(x0 + bw * 0.08))
    iy0 = max(oy0, int(y0 + bh * 0.08))
    ix1 = min(ox1, int(x1 - bw * 0.08))
    iy1 = min(oy1, int(y1 - bh * 0.08))

    px = image.load()
    ring: list[tuple[int, ...]] = []
    for y in range(oy0, oy1):
        for x in range(ox0, ox1):
            if ix0 <= x < ix1 and iy0 <= y < iy1:
                continue
            ring.append(px[x, y][:3])
    if len(ring) >= 8:
        return _median_rgb(ring)

    crop = image.crop((max(0, int(x0)), max(0, int(y0)), min(w, int(x1)), min(h, int(y1))))
    return estimate_background_rgb(crop)


def synthesize_char_bboxes(text: str, bbox: list[float]) -> list[list[float]]:
    """Evenly split a line bbox into per-glyph boxes when OCR chars are missing."""
    glyphs = [c for c in (text or "") if not c.isspace()]
    if len(glyphs) < 2 or len(bbox) < 4:
        return []
    x0, y0, x1, y1 = (float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3]))
    step = (x1 - x0) / len(glyphs)
    if step <= 0:
        return []
    return [[x0 + i * step, y0, x0 + (i + 1) * step, y1] for i in range(len(glyphs))]


def _midline_ink_pixels(crop: Image.Image, bg: tuple[int, int, int], *, min_de: float = 10.0) -> list[tuple[int, ...]]:
    """Sample pixels along glyph midlines — less background than full-crop k-means."""
    w, h = crop.size
    if w < 2 or h < 2:
        return []
    px = crop.load()
    ys = sorted({max(0, min(h - 1, int(h * f))) for f in (0.35, 0.5, 0.65)})
    samples: list[tuple[int, ...]] = []
    for y in ys:
        for x in range(max(1, w // 20), w - max(1, w // 20), max(1, w // 40)):
            pt = px[x, y][:3]
            if _delta_e(pt, bg) >= min_de:
                samples.append(pt)
    return samples


def extract_ink_color(
    image: Image.Image,
    bbox: list[float],
    *,
    char_bboxes: list[list[float]] | None = None,
    bg: tuple[int, int, int] | None = None,
) -> tuple[int, int, int]:
    """Foreground ink RGB from line bbox + optional per-char OCR boxes."""
    w, h = image.size
    x0 = max(0, int(bbox[0]))
    y0 = max(0, int(bbox[1]))
    x1 = min(w, int(bbox[2]))
    y1 = min(h, int(bbox[3]))
    if x1 <= x0 or y1 <= y0:
        return (32, 32, 32)

    crop = image.crop((x0, y0, x1, y1))
    if bg is None:
        bg = estimate_local_background_rgb(image, bbox)
    bg_lum = _lum(bg)

    ink_samples: list[tuple[int, ...]] = []
    min_de = 10.0

    boxes = char_bboxes or []
    if boxes:
        for cb in boxes:
            if len(cb) < 4:
                continue
            local_bg = estimate_local_background_rgb(image, cb)
            for pt in _sample_center_pixels(image, cb, grid=4):
                if _delta_e(pt, local_bg) >= min_de:
                    ink_samples.append(pt)

    if len(ink_samples) >= 2:
        if bg_lum >= 140:
            return _median_rgb(sorted(ink_samples, key=_lum)[: max(1, len(ink_samples) // 2)])
        accent = [p for p in ink_samples if _sat(p) >= 0.25]
        if accent:
            return _median_rgb(sorted(accent, key=lambda p: (_sat(p), _lum(p)), reverse=True)[: max(1, len(accent) // 2)])
        bright = sorted(ink_samples, key=lambda p: (_lum(p), _sat(p)), reverse=True)
        low_sat = [p for p in bright if _sat(p) <= 0.42]
        return _median_rgb(low_sat[: max(1, len(low_sat) // 2)] or bright[: max(1, len(bright) // 3)])

    midline = _midline_ink_pixels(crop, bg)
    if len(midline) >= 2:
        if bg_lum >= 140:
            return _median_rgb(sorted(midline, key=_lum)[: max(1, len(midline) // 2)])
        accent = [p for p in midline if _sat(p) >= 0.25]
        if accent:
            return _median_rgb(sorted(accent, key=lambda p: (_sat(p), _lum(p)), reverse=True)[: max(1, len(accent) // 2)])
        return _median_rgb(sorted(midline, key=_lum, reverse=True)[: max(1, len(midline) // 2)])

    pixels = [p[:3] for p in crop.convert("RGB").getdata()]
    contrasting = [p for p in pixels if _delta_e(p, bg) >= 14]
    if contrasting:
        if bg_lum >= 140:
            pool = sorted(contrasting, key=_lum)[: max(1, len(contrasting) // 4)]
        else:
            pool = sorted(contrasting, key=_lum, reverse=True)[: max(1, len(contrasting) // 4)]
        return _median_rgb(pool)

    if len(pixels) > 500:
        step = max(1, len(pixels) // 500)
        pixels = pixels[::step]

    c0, c1 = _kmeans2_lab(pixels)
    d0 = _delta_e(c0, bg)
    d1 = _delta_e(c1, bg)
    ink = c0 if d0 >= d1 else c1

    if bg_lum >= 140:
        darker = c0 if _lum(c0) < _lum(c1) else c1
        if _delta_e(darker, bg) >= 8:
            return darker
        pool = sorted(pixels, key=_lum)[: max(1, len(pixels) // 5)]
        return _median_rgb(pool)

    brighter = c0 if _lum(c0) > _lum(c1) else c1
    if _delta_e(brighter, bg) >= 8:
        if _sat(brighter) >= 0.18:
            return brighter
        pool = sorted(pixels, key=_lum, reverse=True)
        low_sat = [p for p in pool[: max(3, len(pool) // 4)] if _sat(p) <= 0.35]
        if low_sat:
            return _median_rgb(low_sat)
        return brighter

    return ink


# ---------------------------------------------------------------------------
# Font / weight hints
# ---------------------------------------------------------------------------


def _cjk_ratio(text: str) -> float:
    if not text:
        return 0.0
    cjk = sum(1 for c in text if "\u4e00" <= c <= "\u9fff")
    return cjk / len(text)


def _bbox_height(bbox: list[float]) -> float:
    return max(0.0, float(bbox[3]) - float(bbox[1]))


def _ink_fill_ratio(image: Image.Image, bbox: list[float], bg: tuple[int, int, int]) -> float:
    x0, y0, x1, y1 = _shrink_bbox(bbox, margin=0.1)
    if x1 <= x0 or y1 <= y0:
        return 0.0
    crop = image.crop((x0, y0, x1, y1)).convert("L")
    px = list(crop.getdata())
    if not px:
        return 0.0
    bg_l = _lum(bg)
    threshold = bg_l - 35 if bg_l > 128 else bg_l + 35
    if bg_l > 128:
        dark = sum(1 for v in px if v < threshold)
    else:
        dark = sum(1 for v in px if v > threshold)
    return dark / len(px)


@dataclass
class TypographicMetrics:
    stroke_ratio: float = 0.0
    avg_aspect: float = 1.0
    char_height: float = 0.0


def measure_typographic_metrics(
    image: Image.Image,
    char_bboxes: list[list[float]],
    bg: tuple[int, int, int],
) -> TypographicMetrics | None:
    if not char_bboxes:
        return None
    aspects: list[float] = []
    strokes: list[float] = []
    heights: list[float] = []
    for cb in char_bboxes:
        if len(cb) < 4:
            continue
        w = max(float(cb[2]) - float(cb[0]), 1.0)
        h = max(float(cb[3]) - float(cb[1]), 1.0)
        aspects.append(w / h)
        heights.append(h)
        strokes.append(_ink_fill_ratio(image, cb, bg))
    if not aspects:
        return None
    return TypographicMetrics(
        stroke_ratio=sum(strokes) / len(strokes),
        avg_aspect=sum(aspects) / len(aspects),
        char_height=sum(heights) / len(heights),
    )


@dataclass
class SlideTypographyContext:
    """Per-slide stats for relative role assignment."""
    height_p90: float
    height_p65: float
    cream_traditional: bool


def build_typography_context(image: Image.Image, elements: list[dict[str, Any]]) -> SlideTypographyContext:
    heights = [_bbox_height(e["bbox"]) for e in elements if e.get("bbox") and len(e["bbox"]) >= 4]
    heights.sort()
    if not heights:
        return SlideTypographyContext(height_p90=0.0, height_p65=0.0, cream_traditional=False)

    def pct(p: float) -> float:
        idx = min(len(heights) - 1, int(p * (len(heights) - 1)))
        return heights[idx]

    w, h = image.size
    sample_pts: list[tuple[int, ...]] = []
    step_x = max(1, w // 8)
    step_y = max(1, h // 8)
    px = image.load()
    for y in range(step_y, h - step_y, step_y):
        for x in range(step_x, w - step_x, step_x):
            sample_pts.append(px[x, y][:3])
    bg = _median_rgb(sample_pts)
    cream = _lum(bg) >= 175 and _sat(bg) < 0.22
    return SlideTypographyContext(
        height_p90=pct(0.9),
        height_p65=pct(0.65),
        cream_traditional=cream,
    )


def infer_text_role(
    bbox: list[float],
    text: str,
    element_type: str,
    ctx: SlideTypographyContext,
    img_w: int,
) -> str:
    et = str(element_type or "text").lower()
    if et in ("title", "heading", "header"):
        return "title"
    h = _bbox_height(bbox)
    width = float(bbox[2]) - float(bbox[0])
    if ctx.height_p90 > 0 and h >= ctx.height_p90 * 0.92 and width / max(img_w, 1) > 0.18:
        return "title"
    if ctx.height_p65 > 0 and h >= ctx.height_p65 * 0.95:
        return "heading"
    if len(text.strip()) <= 4 and h >= ctx.height_p65 * 0.85:
        return "heading"
    return "body"


def infer_bold(
    image: Image.Image,
    bbox: list[float],
    text: str,
    role: str,
    *,
    char_bboxes: list[list[float]] | None = None,
    bg: tuple[int, int, int] | None = None,
    metrics: TypographicMetrics | None = None,
) -> bool:
    if bg is None:
        bg = estimate_local_background_rgb(image, bbox)
    if metrics is not None:
        if metrics.stroke_ratio >= 0.30:
            return True
        if role in ("title", "heading") and metrics.stroke_ratio >= 0.22:
            return True
        if role == "body" and metrics.stroke_ratio >= 0.28:
            return True
        return False
    crop_box = bbox
    if char_bboxes:
        ratios = [_ink_fill_ratio(image, cb, bg) for cb in char_bboxes if len(cb) >= 4]
        if ratios:
            avg = sum(ratios) / len(ratios)
            if avg >= 0.30:
                return True
            if role in ("title", "heading") and avg >= 0.22:
                return True
            return avg >= 0.28
    ratio = _ink_fill_ratio(image, crop_box, bg)
    if role == "heading":
        return ratio >= 0.24
    if role == "title":
        return ratio >= 0.20
    if len(text) <= 6:
        return ratio >= 0.26
    return ratio >= 0.32


def guess_font_name(
    text: str,
    role: str,
    ctx: SlideTypographyContext,
    metrics: TypographicMetrics | None = None,
) -> str:
    mostly_cjk = _cjk_ratio(text) >= 0.25
    heavy = metrics is not None and metrics.stroke_ratio >= 0.28
    thin = metrics is not None and metrics.stroke_ratio < 0.20
    if mostly_cjk:
        if ctx.cream_traditional:
            if role == "title" or thin:
                return "KaiTi"
            if role == "heading" or heavy:
                return "SimHei" if heavy else "SimSun"
            return "SimSun"
        if role == "title" or heavy:
            return "Microsoft YaHei UI"
        if role == "heading":
            return "Microsoft YaHei"
        return "Microsoft YaHei"
    if role == "title":
        return "Calibri Light"
    if heavy:
        return "Arial"
    if role == "heading":
        return "Calibri"
    return "Calibri"


def guess_alignment(bbox: list[float], img_w: int, img_h: int, role: str) -> str:
    if img_w <= 0 or img_h <= 0 or len(bbox) < 4:
        return "left"
    x0, y0, x1, y1 = bbox
    width_ratio = (x1 - x0) / img_w
    center_x = (x0 + x1) / 2 / img_w
    if role == "title" and y0 / img_h < 0.2 and width_ratio > 0.5:
        return "center"
    if width_ratio > 0.55 and 0.35 < center_x < 0.65:
        return "center"
    return "left"


def parse_char_bboxes(chars: Any) -> list[list[float]]:
    out: list[list[float]] = []
    if not isinstance(chars, list):
        return out
    for ch in chars:
        if not isinstance(ch, dict):
            continue
        bb = ch.get("bbox")
        if isinstance(bb, list) and len(bb) >= 4:
            out.append([float(v) for v in bb[:4]])
            continue
        loc = ch.get("location")
        if isinstance(loc, dict):
            left = float(loc.get("left", 0))
            top = float(loc.get("top", 0))
            width = float(loc.get("width", 0))
            height = float(loc.get("height", 0))
            out.append([left, top, left + width, top + height])
    return out


@dataclass
class ColorSegment:
    text: str
    color_rgb: tuple[int, int, int]


@dataclass
class UniversalTextStyle:
    font_color_rgb: tuple[int, int, int]
    is_bold: bool = False
    is_italic: bool = False
    is_underline: bool = False
    text_alignment: str | None = None
    font_name: str | None = None
    colored_segments: list[ColorSegment] | None = None


def _merge_color_segments(segments: list[ColorSegment]) -> list[ColorSegment]:
    if not segments:
        return []
    merged: list[ColorSegment] = [segments[0]]
    for seg in segments[1:]:
        prev = merged[-1]
        if prev.color_rgb == seg.color_rgb:
            merged[-1] = ColorSegment(text=prev.text + seg.text, color_rgb=prev.color_rgb)
        else:
            merged.append(seg)
    return merged


def _segments_from_chars(image: Image.Image, chars: Any) -> list[ColorSegment] | None:
    if not isinstance(chars, list) or len(chars) < 2:
        return None
    segments: list[ColorSegment] = []
    colors: list[tuple[int, int, int]] = []
    for ch in chars:
        if not isinstance(ch, dict):
            continue
        label = str(ch.get("char") or "")
        bb = ch.get("bbox")
        if not label or not isinstance(bb, list) or len(bb) < 4:
            continue
        rgb = extract_ink_color(image, bb, char_bboxes=[[float(v) for v in bb[:4]]])
        segments.append(ColorSegment(text=label, color_rgb=rgb))
        colors.append(rgb)
    if len(segments) < 2:
        return None
    spread = max(_delta_e(a, b) for i, a in enumerate(colors) for b in colors[i + 1 :])
    if spread < 18:
        return None
    return _merge_color_segments(segments)


def extract_universal_text_style(
    image: Image.Image,
    bbox: list[float],
    text: str,
    *,
    element_type: str = "text",
    char_bboxes: list[list[float]] | None = None,
    chars: Any = None,
    typography: SlideTypographyContext | None = None,
) -> UniversalTextStyle:
    w, h = image.size
    ctx = typography or SlideTypographyContext(0.0, 0.0, False)
    role = infer_text_role(bbox, text, element_type, ctx, w)
    bg = estimate_local_background_rgb(image, bbox)

    effective_chars = char_bboxes
    if not effective_chars:
        effective_chars = synthesize_char_bboxes(text, bbox) or None

    metrics = measure_typographic_metrics(image, effective_chars or [], bg)
    rgb = extract_ink_color(image, bbox, char_bboxes=effective_chars, bg=bg)
    colored_segments = _segments_from_chars(image, chars)
    if colored_segments:
        rgb = colored_segments[0].color_rgb
    bold = infer_bold(
        image, bbox, text, role, char_bboxes=effective_chars, bg=bg, metrics=metrics
    )
    font_name = guess_font_name(text, role, ctx, metrics)
    align = guess_alignment(bbox, w, h, role)
    return UniversalTextStyle(
        font_color_rgb=rgb,
        is_bold=bold,
        font_name=font_name,
        text_alignment=align,
        colored_segments=colored_segments,
    )
