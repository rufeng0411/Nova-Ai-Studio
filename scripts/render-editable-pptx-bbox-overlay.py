#!/usr/bin/env python3
"""Render MinerU/OCR bbox overlays on slide images for visual alignment QA."""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR / "lib"))
sys.path.insert(0, str(SCRIPT_DIR / "editable_export"))

REPO = SCRIPT_DIR.parent
DECK = (
    REPO
    / "skills/vendor/nova-1/nova-ppt-aesthetic-slides/acceptance/enterprise-ai-training-2026"
)
OUT = REPO / "artifacts/document-smoke/bbox-overlays"


def _load_elements(image_path: str, extractor_method: str) -> list[dict]:
    from pd_pipeline import analyze_slide_elements  # noqa: WPS433

    return analyze_slide_elements(image_path, extractor_method=extractor_method)


def render_overlay(image_path: Path, elements: list[dict], output_path: Path) -> None:
    with Image.open(image_path) as im:
        base = im.convert("RGBA")
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for idx, el in enumerate(elements):
        bbox = el.get("bbox") or [0, 0, 0, 0]
        if len(bbox) < 4:
            continue
        x0, y0, x1, y1 = [int(v) for v in bbox[:4]]
        color = (255, 64, 64, 180) if el.get("source") == "baidu" else (64, 128, 255, 160)
        draw.rectangle([x0, y0, x1, y1], outline=color, width=2)
        label = str(el.get("text") or el.get("content") or "")[:24]
        if label:
            draw.text((x0 + 2, max(0, y0 - 14)), label, fill=color)
    merged = Image.alpha_composite(base, overlay)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    merged.convert("RGB").save(output_path)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--deck-dir", default=str(DECK))
    parser.add_argument("--output-dir", default=str(OUT))
    parser.add_argument("--extractor", default=os.environ.get("PILOTDECK_DOCUMENT_EXTRACTOR_METHOD", "hybrid"))
    parser.add_argument("--report", default="")
    args = parser.parse_args()

    deck = Path(args.deck_dir)
    slides = sorted(deck.glob("slide-*.png"))
    if not slides:
        print("no slides found", file=sys.stderr)
        return 1

    report_rows: list[dict] = []
    for slide in slides:
        elements = _load_elements(str(slide), args.extractor)
        out = Path(args.output_dir) / f"{slide.stem}-bbox.png"
        render_overlay(slide, elements, out)
        report_rows.append({"slide": slide.name, "elements": len(elements), "overlay": str(out)})
        print(f"OK {slide.name} -> {out} ({len(elements)} boxes)")

    if args.report:
        Path(args.report).write_text(json.dumps(report_rows, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
