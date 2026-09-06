#!/usr/bin/env python3
"""Build a clamped 16:9 pptx from slide_manifest.json (Nova Cyber fast path).

Usage (from task artifact dir):
  python nova_build_from_manifest.py slide_manifest.json presentation.pptx

Requires: python-pptx
All layout uses nova_pptx_layout frac_rect / clamp — shapes must not exceed canvas.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Allow running from task dir when nova_pptx_layout.py is copied alongside.
SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from nova_pptx_layout import (  # noqa: E402
    SLIDE_H_IN,
    SLIDE_W_IN,
    add_clamped_shape,
    add_clamped_table,
    add_clamped_textbox,
    apply_slide_size,
    clamp_box_in,
    frac_rect,
    grid_cells,
    hex_to_rgb,
    validate_no_overflow_pptx,
)


def _blank_slide(prs):
    layout = prs.slide_layouts[6]  # blank
    return prs.slides.add_slide(layout)


def _tokens(manifest: dict) -> dict:
    return manifest.get("design_tokens") or manifest.get("deck", {}).get("design_tokens") or {}


def _slides(manifest: dict) -> list[dict]:
    if isinstance(manifest.get("slides"), list):
        return manifest["slides"]
    pages = manifest.get("pages")
    if isinstance(pages, list):
        return pages
    return []


def _block_text(block) -> str:
    if block is None:
        return ""
    if isinstance(block, str):
        return block.strip()
    if isinstance(block, dict):
        for key in ("text", "value", "content", "body", "title", "label"):
            if block.get(key):
                return str(block[key]).strip()
        parts = []
        if block.get("label"):
            parts.append(str(block["label"]))
        if block.get("value"):
            parts.append(str(block["value"]))
        return "\n".join(parts).strip()
    return str(block).strip()


def _draw_header(slide, title: str, tokens: dict, *, subtitle: str = ""):
    from pptx.enum.shapes import MSO_SHAPE

    bg = hex_to_rgb(tokens.get("background", "#0A0A0A"))
    accent = hex_to_rgb(tokens.get("accent_primary", "#44D62C"))
    title_font = tokens.get("title_font", "Arial Black")
    body_font = tokens.get("body_font", "Calibri")

    x, y, w, h = frac_rect(0, 0, 1, 1, inset=False)
    add_clamped_shape(slide, MSO_SHAPE.RECTANGLE, x, y, w, h, fill_rgb=bg)

    bx, by, bw, bh = frac_rect(0, 0, 1, 0.012, inset=False)
    add_clamped_shape(slide, MSO_SHAPE.RECTANGLE, bx, by, bw, bh, fill_rgb=accent)

    tx, ty, tw, th = frac_rect(0, 0.02, 0.92, 0.11)
    add_clamped_textbox(
        slide, tx, ty, tw, th, title or " ",
        font_name=title_font,
        font_pt=22,
        bold=True,
        color_rgb=(255, 255, 255),
    )
    if subtitle:
        sx, sy, sw, sh = frac_rect(0, 0.12, 0.9, 0.06)
        add_clamped_textbox(
            slide, sx, sy, sw, sh, subtitle,
            font_name=body_font,
            font_pt=12,
            color_rgb=(180, 180, 190),
        )


def _layout_full_bleed_title(slide, page: dict, tokens: dict):
    bg = hex_to_rgb(tokens.get("background", "#0A0A0A"))
    accent = hex_to_rgb(tokens.get("accent_primary", "#44D62C"))
    title_font = tokens.get("title_font", "Arial Black")
    body_font = tokens.get("body_font", "Calibri")
    from pptx.enum.shapes import MSO_SHAPE

    x, y, w, h = frac_rect(0, 0, 1, 1, inset=False)
    add_clamped_shape(slide, MSO_SHAPE.RECTANGLE, x, y, w, h, fill_rgb=bg)
    bx, by, bw, bh = frac_rect(0, 0.88, 1, 0.12, inset=False)
    add_clamped_shape(slide, MSO_SHAPE.RECTANGLE, bx, by, bw, bh, fill_rgb=accent)

    title = page.get("title") or _block_text(page.get("content_blocks", [""])[0] if page.get("content_blocks") else "")
    subtitle = page.get("subtitle") or ""
    blocks = page.get("content_blocks") or []
    if not subtitle and len(blocks) > 1:
        subtitle = _block_text(blocks[1])

    tx, ty, tw, th = frac_rect(0.06, 0.28, 0.88, 0.22)
    add_clamped_textbox(slide, tx, ty, tw, th, title, font_name=title_font, font_pt=36, bold=True, color_rgb=(255, 255, 255))
    if subtitle:
        sx, sy, sw, sh = frac_rect(0.08, 0.52, 0.84, 0.14)
        add_clamped_textbox(slide, sx, sy, sw, sh, subtitle, font_name=body_font, font_pt=16, color_rgb=(230, 230, 235))


def _layout_grid_kpi(slide, page: dict, tokens: dict):
    _draw_header(slide, page.get("title", ""), tokens)
    accent = hex_to_rgb(tokens.get("accent_primary", "#44D62C"))
    card = hex_to_rgb(tokens.get("card", "#15151E"))
    body_font = tokens.get("body_font", "Calibri")
    from pptx.enum.shapes import MSO_SHAPE

    blocks = page.get("content_blocks") or []
    cells = grid_cells(2, 2, x0=0.0, y0=0.18, w=1.0, h=0.72, gap_frac=0.04)
    for i, (fx, fy, fw, fh) in enumerate(cells):
        if i >= len(blocks):
            break
        block = blocks[i]
        cx, cy, cw, ch = frac_rect(fx, fy, fw, fh)
        add_clamped_shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, cx, cy, cw, ch, fill_rgb=card, line_rgb=accent)
        label, value = "", _block_text(block)
        if isinstance(block, dict):
            label = str(block.get("label") or block.get("title") or "")
            value = str(block.get("value") or block.get("text") or value)
        body = f"{label}\n{value}".strip() if label else value
        add_clamped_textbox(
            slide, cx + 0.08, cy + 0.08, cw - 0.16, ch - 0.16, body,
            font_name=body_font, font_pt=14, color_rgb=(240, 240, 245), align="left",
        )


def _layout_bullets(slide, page: dict, tokens: dict):
    _draw_header(slide, page.get("title", ""), tokens)
    body_font = tokens.get("body_font", "Calibri")
    blocks = page.get("content_blocks") or []
    lines = []
    for b in blocks:
        t = _block_text(b)
        if t:
            lines.append(f"• {t}" if not t.startswith("•") else t)
    body = "\n".join(lines) or "• "
    bx, by, bw, bh = frac_rect(0, 0.2, 1, 0.68)
    add_clamped_textbox(slide, bx, by, bw, bh, body, font_name=body_font, font_pt=14, color_rgb=(225, 225, 230))


def _layout_table(slide, page: dict, tokens: dict, *, cols: int = 3):
    from pptx.dml.color import RGBColor
    from pptx.util import Pt

    _draw_header(slide, page.get("title", ""), tokens)
    body_font = tokens.get("body_font", "Calibri")
    accent = hex_to_rgb(tokens.get("accent_primary", "#44D62C"))
    blocks = page.get("content_blocks") or []
    rows_data: list[list[str]] = []
    for b in blocks:
        if isinstance(b, dict) and isinstance(b.get("rows"), list):
            rows_data = [[str(c) for c in row] for row in b["rows"]]
            break
        if isinstance(b, dict) and b.get("cells"):
            rows_data.append([str(c) for c in b["cells"]])
        else:
            text = _block_text(b)
            if "|" in text:
                rows_data.append([c.strip() for c in text.split("|")])
            elif text:
                rows_data.append([text])

    if not rows_data:
        rows_data = [["—", "—", "—"]]

    cols = max(cols, max(len(r) for r in rows_data))
    rows = min(len(rows_data), 8)
    tx, ty, tw, th = frac_rect(0, 0.2, 1, 0.68)
    table = add_clamped_table(slide, tx, ty, tw, th, rows, cols)
    col_w = tw / cols
    for c in range(cols):
        table.columns[c].width = int(col_w * 914400)
    for r in range(rows):
        for c in range(cols):
            cell = table.cell(r, c)
            val = rows_data[r][c] if c < len(rows_data[r]) else ""
            cell.text = val[:120]
            for p in cell.text_frame.paragraphs:
                for run in p.runs:
                    run.font.name = body_font
                    run.font.size = Pt(11)
                    if r == 0:
                        run.font.bold = True
                        run.font.color.rgb = RGBColor(*accent)


def _layout_so_what(slide, page: dict, tokens: dict):
    _layout_bullets(slide, page, tokens)
    so = page.get("so_what") or page.get("soWhat")
    if not so:
        for b in page.get("content_blocks") or []:
            if isinstance(b, dict) and b.get("type") in ("so_what", "sowhat", "insight"):
                so = _block_text(b)
                break
    if so:
        accent = hex_to_rgb(tokens.get("accent_primary", "#44D62C"))
        body_font = tokens.get("body_font", "Calibri")
        from pptx.enum.shapes import MSO_SHAPE

        sx, sy, sw, sh = frac_rect(0, 0.82, 1, 0.12)
        add_clamped_shape(slide, MSO_SHAPE.RECTANGLE, sx, sy, sw, sh, fill_rgb=accent)
        add_clamped_textbox(
            slide, sx + 0.08, sy + 0.02, sw - 0.16, sh - 0.04,
            f"SO WHAT  {so}",
            font_name=body_font, font_pt=12, bold=True, color_rgb=(10, 10, 10),
        )


LAYOUT_BUILDERS = {
    "full_bleed_title": _layout_full_bleed_title,
    "grid_2x2_kpi": _layout_grid_kpi,
    "grid_kpi": _layout_grid_kpi,
    "pain_point_grid": _layout_grid_kpi,
    "two_column_chart": _layout_bullets,
    "competitive_matrix": lambda s, p, t: _layout_table(s, p, t, cols=4),
    "spec_table": lambda s, p, t: _layout_table(s, p, t, cols=3),
    "value_proposition_pyramid": _layout_bullets,
    "gtm_timeline": _layout_bullets,
    "next_steps_cta": _layout_so_what,
    "default": _layout_bullets,
}


def build_deck(manifest: dict, out_path: Path) -> None:
    from pptx import Presentation

    tokens = _tokens(manifest)
    pages = _slides(manifest)
    if not pages:
        raise SystemExit("manifest has no slides/pages")

    prs = Presentation()
    apply_slide_size(prs)

    for idx, page in enumerate(pages):
        slide = _blank_slide(prs)
        layout = (page.get("layout") or page.get("type") or "default").strip()
        builder = LAYOUT_BUILDERS.get(layout) or LAYOUT_BUILDERS["default"]
        builder(slide, page, tokens)

        # page number footer — clamped
        body_font = tokens.get("body_font", "Calibri")
        num = str(page.get("index") or idx + 1)
        fx, fy, fw, fh = frac_rect(0.92, 0.94, 0.06, 0.04)
        add_clamped_textbox(
            slide, fx, fy, fw, fh, num,
            font_name=body_font, font_pt=9, color_rgb=(140, 140, 150), align="right",
        )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    prs.save(str(out_path))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build clamped 16:9 pptx from slide_manifest.json")
    parser.add_argument("manifest", type=Path, help="slide_manifest.json path")
    parser.add_argument("output", type=Path, help="output .pptx path")
    parser.add_argument("--skip-validate", action="store_true", help="skip overflow check")
    args = parser.parse_args(argv)

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    build_deck(manifest, args.output)
    print(f"Wrote {args.output} ({SLIDE_W_IN}×{SLIDE_H_IN} in)")

    if not args.skip_validate:
        errs = validate_no_overflow_pptx(str(args.output))
        if errs:
            print("CANVAS_OVERFLOW:", file=sys.stderr)
            for e in errs[:20]:
                print(f"  - {e}", file=sys.stderr)
            return 1
        print("Canvas validation: OK (no shape exceeds slide bounds)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
