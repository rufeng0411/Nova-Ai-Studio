#!/usr/bin/env python3
"""Nova Cyber PPT — safe 16:9 canvas helpers for python-pptx.

All coordinates in **inches**. Slide canvas is fixed 13.333 × 7.5 in (16:9).
Every public helper clamps shapes inside the slide so PowerPoint does not distort
or clip content unpredictably.
"""
from __future__ import annotations

from typing import Iterable

EMU_PER_INCH = 914400

# Standard widescreen 16:9 (matches validate_pptx / ppt-production.md)
SLIDE_W_IN = 13.333
SLIDE_H_IN = 7.5

# Safe content inset — decorative full-bleed bg may use (0,0,SW,SH); text/cards stay inside.
MARGIN_X_IN = 0.55
MARGIN_Y_IN = 0.45

CONTENT_W_IN = SLIDE_W_IN - 2 * MARGIN_X_IN
CONTENT_H_IN = SLIDE_H_IN - 2 * MARGIN_Y_IN


def slide_emu_size() -> tuple[int, int]:
    return int(round(SLIDE_W_IN * EMU_PER_INCH)), int(round(SLIDE_H_IN * EMU_PER_INCH))


def clamp_box_in(x: float, y: float, w: float, h: float) -> tuple[float, float, float, float]:
    """Clamp (x,y,w,h) in inches to stay fully inside the slide canvas."""
    w = max(0.05, min(float(w), SLIDE_W_IN))
    h = max(0.05, min(float(h), SLIDE_H_IN))
    x = max(0.0, min(float(x), SLIDE_W_IN - w))
    y = max(0.0, min(float(y), SLIDE_H_IN - h))
    return x, y, w, h


def frac_rect(fx: float, fy: float, fw: float, fh: float, *, inset: bool = True) -> tuple[float, float, float, float]:
    """Map 0..1 fractions to inches. inset=True uses safe content margins."""
    fx, fy, fw, fh = float(fx), float(fy), float(fw), float(fh)
    fw = max(0.0, min(fw, 1.0))
    fh = max(0.0, min(fh, 1.0))
    fx = max(0.0, min(fx, 1.0 - fw))
    fy = max(0.0, min(fy, 1.0 - fh))
    if inset:
        x = MARGIN_X_IN + fx * CONTENT_W_IN
        y = MARGIN_Y_IN + fy * CONTENT_H_IN
        w = fw * CONTENT_W_IN
        h = fh * CONTENT_H_IN
    else:
        x = fx * SLIDE_W_IN
        y = fy * SLIDE_H_IN
        w = fw * SLIDE_W_IN
        h = fh * SLIDE_H_IN
    return clamp_box_in(x, y, w, h)


def grid_cells(
    cols: int,
    rows: int,
    *,
    x0: float = 0.0,
    y0: float = 0.0,
    w: float = 1.0,
    h: float = 1.0,
    gap_frac: float = 0.03,
) -> list[tuple[float, float, float, float]]:
    """Return fraction rects for a cols×rows grid inside (x0,y0,w,h), with gaps."""
    cols = max(1, int(cols))
    rows = max(1, int(rows))
    gap = max(0.0, min(gap_frac, 0.15))
    cell_w = (w - gap * (cols - 1)) / cols
    cell_h = (h - gap * (rows - 1)) / rows
    out: list[tuple[float, float, float, float]] = []
    for r in range(rows):
        for c in range(cols):
            fx = x0 + c * (cell_w + gap)
            fy = y0 + r * (cell_h + gap)
            out.append((fx, fy, cell_w, cell_h))
    return out


def estimate_lines(text: str, chars_per_line: int) -> int:
    text = (text or "").strip()
    if not text:
        return 1
    chars_per_line = max(8, int(chars_per_line))
    total = 0
    for para in text.split("\n"):
        para = para.strip()
        if not para:
            total += 1
            continue
        total += max(1, (len(para) + chars_per_line - 1) // chars_per_line)
    return max(1, total)


def fit_font_pt(
    text: str,
    box_w_in: float,
    box_h_in: float,
    *,
    max_pt: float = 28.0,
    min_pt: float = 9.0,
    line_height_ratio: float = 1.25,
) -> float:
    """Heuristic font size so text likely fits the box (word_wrap assumed)."""
    box_w_in = max(0.5, float(box_w_in))
    box_h_in = max(0.2, float(box_h_in))
    # ~0.09 in per char at 12pt for Latin; CJK needs more width
    cpl = max(12, int(box_w_in / 0.095))
    lines = estimate_lines(text, cpl)
    max_by_height = (box_h_in * 72.0) / (lines * line_height_ratio)
    size = min(max_pt, max_by_height)
    return max(min_pt, size)


def apply_slide_size(prs) -> None:
    from pptx.util import Emu

    w, h = slide_emu_size()
    prs.slide_width = Emu(w)
    prs.slide_height = Emu(h)


def add_clamped_textbox(
    slide,
    x: float,
    y: float,
    w: float,
    h: float,
    text: str,
    *,
    font_name: str = "Calibri",
    font_pt: float | None = None,
    bold: bool = False,
    color_rgb: tuple[int, int, int] | None = None,
    align: str = "left",
    valign: str = "top",
    word_wrap: bool = True,
):
    from pptx.util import Inches, Pt
    from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
    from pptx.dml.color import RGBColor

    x, y, w, h = clamp_box_in(x, y, w, h)
    if font_pt is None:
        font_pt = fit_font_pt(text, w, h, max_pt=24.0 if bold else 18.0)
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = word_wrap
    tf.clear()
    p = tf.paragraphs[0]
    p.text = (text or "").strip()
    align_map = {
        "left": PP_ALIGN.LEFT,
        "center": PP_ALIGN.CENTER,
        "right": PP_ALIGN.RIGHT,
    }
    p.alignment = align_map.get(align, PP_ALIGN.LEFT)
    tf.vertical_anchor = {
        "top": MSO_ANCHOR.TOP,
        "middle": MSO_ANCHOR.MIDDLE,
        "bottom": MSO_ANCHOR.BOTTOM,
    }.get(valign, MSO_ANCHOR.TOP)
    run = p.runs[0] if p.runs else p.add_run()
    run.text = p.text
    run.font.name = font_name
    run.font.size = Pt(font_pt)
    run.font.bold = bold
    if color_rgb:
        run.font.color.rgb = RGBColor(*color_rgb)
    return box


def add_clamped_shape(
    slide,
    shape_kind,
    x: float,
    y: float,
    w: float,
    h: float,
    *,
    fill_rgb: tuple[int, int, int] | None = None,
    line_rgb: tuple[int, int, int] | None = None,
):
    from pptx.util import Inches
    from pptx.dml.color import RGBColor

    x, y, w, h = clamp_box_in(x, y, w, h)
    shape = slide.shapes.add_shape(shape_kind, Inches(x), Inches(y), Inches(w), Inches(h))
    if fill_rgb:
        shape.fill.solid()
        shape.fill.fore_color.rgb = RGBColor(*fill_rgb)
    else:
        shape.fill.background()
    if line_rgb:
        shape.line.color.rgb = RGBColor(*line_rgb)
    else:
        shape.line.fill.background()
    return shape


def add_clamped_table(
    slide,
    x: float,
    y: float,
    w: float,
    h: float,
    rows: int,
    cols: int,
):
    from pptx.util import Inches

    x, y, w, h = clamp_box_in(x, y, w, h)
    rows = max(1, min(int(rows), 20))
    cols = max(1, min(int(cols), 8))
    return slide.shapes.add_table(rows, cols, Inches(x), Inches(y), Inches(w), Inches(h)).table


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    v = (value or "").strip().lstrip("#")
    if len(v) == 3:
        v = "".join(ch * 2 for ch in v)
    if len(v) != 6:
        return (20, 20, 30)
    return (int(v[0:2], 16), int(v[2:4], 16), int(v[4:6], 16))


def validate_no_overflow_pptx(path: str) -> list[str]:
    """Return human-readable errors if any shape exceeds slide EMU canvas."""
    import zipfile
    import xml.etree.ElementTree as ET

    NS = {"p": "http://schemas.openxmlformats.org/presentationml/2006/main", "a": "http://schemas.openxmlformats.org/drawingml/2006/main"}
    sw, sh = slide_emu_size()
    errors: list[str] = []
    with zipfile.ZipFile(path) as zf:
        for name in zf.namelist():
            if not name.startswith("ppt/slides/slide") or not name.endswith(".xml"):
                continue
            root = ET.fromstring(zf.read(name))
            for sp in root.findall(".//p:sp", NS):
                off = sp.find(".//a:off", NS)
                ext = sp.find(".//a:ext", NS)
                if off is None or ext is None:
                    continue
                x = int(off.get("x", "0"))
                y = int(off.get("y", "0"))
                cx = int(ext.get("cx", "0"))
                cy = int(ext.get("cy", "0"))
                if x < 0 or y < 0 or x + cx > sw or y + cy > sh:
                    errors.append(f"{name}: shape at ({x},{y}) size ({cx},{cy}) exceeds {sw}×{sh} EMU")
    return errors
