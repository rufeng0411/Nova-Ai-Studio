#!/usr/bin/env python3
"""Compose ordered images into a PPTX (one full-bleed image per slide)."""
from __future__ import annotations

import argparse
import os
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image
from pptx import Presentation
from pptx.util import Inches

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR / "lib"))
from pptx_aspect import apply_slide_size, normalize_aspect_ratio  # noqa: E402


def add_image_slide(prs, image_path: str, slide_width, slide_height) -> None:
    blank_layout = prs.slide_layouts[6]
    slide = prs.slides.add_slide(blank_layout)
    with Image.open(image_path) as img:
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        img_width, img_height = img.size
        img_aspect = img_width / img_height if img_height else 1
        slide_aspect = float(slide_width) / float(slide_height)
        slide_width_emu = int(slide_width)
        slide_height_emu = int(slide_height)
        if img_aspect > slide_aspect:
            new_width_emu = slide_width_emu
            new_height_emu = int(slide_width_emu / img_aspect)
            left = Inches(0)
            top = Inches((slide_height_emu - new_height_emu) / 914400)
        else:
            new_height_emu = slide_height_emu
            new_width_emu = int(slide_height_emu * img_aspect)
            left = Inches((slide_width_emu - new_width_emu) / 914400)
            top = Inches(0)
        img_bytes = BytesIO()
        img.save(img_bytes, format="JPEG", quality=95)
        img_bytes.seek(0)
        slide.shapes.add_picture(
            img_bytes,
            left,
            top,
            Inches(new_width_emu / 914400),
            Inches(new_height_emu / 914400),
        )


def compose_pptx(image_paths: list[str], output_file: str, aspect_ratio: str) -> str:
    prs = Presentation()
    slide_width, slide_height = apply_slide_size(prs, normalize_aspect_ratio(aspect_ratio))
    for image_path in image_paths:
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Slide image not found: {image_path}")
        add_image_slide(prs, image_path, slide_width, slide_height)
    os.makedirs(os.path.dirname(output_file) or ".", exist_ok=True)
    prs.save(output_file)
    return f"Successfully composed {len(image_paths)} slide(s) to {output_file}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Compose images into a PPTX file")
    parser.add_argument("--output", required=True, help="Output PPTX path")
    parser.add_argument("--aspect-ratio", default="16:9", help="Slide aspect ratio")
    parser.add_argument("--images", nargs="+", required=True, help="Image paths in order")
    args = parser.parse_args()
    print(compose_pptx(args.images, args.output, args.aspect_ratio))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(1)
