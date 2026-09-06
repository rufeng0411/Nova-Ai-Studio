#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Validate acceptance manifests and optionally emit placeholder PNGs for CI."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ACCEPTANCE = Path(__file__).resolve().parent

STYLE_POLLUTION = re.compile(
    r"赛博朋克|水墨|Octane Render|渐变活力|霓虹|#0B0F19|磨砂玻璃",
    re.I,
)

THEMES = [
    "enterprise-ai-training-2026",
    "new-consumer-brand-pitch",
]


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_outline(outline: dict) -> list[str]:
    errors: list[str] = []
    pages = outline.get("pages") or []
    if len(pages) < 6:
        errors.append(f"outline pages {len(pages)} < 6")
    for p in pages:
        for pt in p.get("points") or []:
            if STYLE_POLLUTION.search(pt):
                errors.append(f"style pollution in outline page {p.get('page_index')}: {pt[:40]}")
    return errors


def validate_manifest(manifest: dict, theme_dir: Path) -> list[str]:
    errors: list[str] = []
    pages = manifest.get("pages") or []
    if len(pages) < 6:
        errors.append("manifest pages < 6")
    if manifest.get("page_count") != len(pages):
        errors.append("page_count mismatch pages length")
    indices = [p["page_index"] for p in pages]
    if indices != list(range(1, len(pages) + 1)):
        errors.append(f"non-contiguous page_index: {indices}")
    cover = pages[0]
    if len(cover.get("page_description", "")) >= max(
        len(p.get("page_description", "")) for p in pages[1:]
    ):
        errors.append("cover description should be shorter than inner pages")
    for p in pages:
        desc = p.get("page_description", "")
        if "#" in desc or desc.strip().startswith("*"):
            errors.append(f"markdown symbols in page_description page {p['page_index']}")
        for pt in p.get("points") or []:
            if STYLE_POLLUTION.search(pt):
                errors.append(f"style pollution in manifest points page {p['page_index']}")
        img = p.get("image_path")
        if p.get("status") == "completed" and img:
            if not (theme_dir / img).is_file():
                errors.append(f"missing image {img}")
    preset = manifest.get("preset_id")
    if preset and not (ROOT / "presets" / f"{preset}.md").is_file():
        errors.append(f"unknown preset_id {preset}")
    return errors


def generate_placeholders(theme_dir: Path, manifest: dict) -> None:
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        print("PIL not installed; skip placeholder PNG generation", file=sys.stderr)
        return

    w, h = 1920, 1080
    preset = manifest.get("preset_id", "default")
    bg = (11, 15, 25) if preset == "tech-modern" else (37, 99, 235)
    for p in manifest.get("pages", []):
        if p.get("status") != "completed":
            continue
        img_path = theme_dir / p["image_path"]
        im = Image.new("RGB", (w, h), bg)
        draw = ImageDraw.Draw(im)
        title = p.get("title", f"Slide {p['page_index']}")
        draw.text((80, 80), title, fill=(255, 255, 255))
        draw.text((80, 160), p.get("page_description", "")[:120] + "…", fill=(200, 200, 220))
        draw.text((80, h - 60), f"acceptance-placeholder · {preset}", fill=(150, 150, 170))
        im.save(img_path, "PNG")


def main() -> int:
    gen = "--generate-png" in sys.argv
    all_errors: list[str] = []
    for theme in THEMES:
        td = ACCEPTANCE / theme
        outline = load_json(td / "outline.json")
        manifest = load_json(td / "slide-manifest.json")
        all_errors.extend(f"{theme}: {e}" for e in validate_outline(outline))
        if gen:
            generate_placeholders(td, manifest)
        all_errors.extend(f"{theme}: {e}" for e in validate_manifest(manifest, td))
    if all_errors:
        for e in all_errors:
            print("FAIL", e)
        return 1
    print("OK", len(THEMES), "themes validated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
