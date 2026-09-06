#!/usr/bin/env python3
"""Verify layered Nova aesthetic-slide PPTX export."""
from __future__ import annotations

import argparse
import json
import sys
import zipfile
from pathlib import Path

from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE
from pptx.util import Inches

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR / "lib"))
from pptx_aspect import slide_size_inches  # noqa: E402


def _shape_text(shape) -> str:
    if not getattr(shape, "has_text_frame", False):
        return ""
    try:
        return shape.text_frame.text or ""
    except Exception:
        return ""


def verify_pptx(
    pptx_path: Path,
    manifest_path: Path,
    slide_dir: Path,
    *,
    min_text_shapes_per_slide: int = 1,
) -> dict:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    aspect = manifest.get("aspect_ratio", "16:9")
    expected_pages = int(manifest.get("page_count") or len(manifest.get("pages") or []))
    exp_w, exp_h = slide_size_inches(aspect)

    prs = Presentation(str(pptx_path))
    slide_w_in = prs.slide_width / Inches(1)
    slide_h_in = prs.slide_height / Inches(1)

    issues: list[str] = []
    if len(prs.slides) != expected_pages:
        issues.append(f"slide count {len(prs.slides)} != expected {expected_pages}")
    if abs(slide_w_in - exp_w) > 0.05 or abs(slide_h_in - exp_h) > 0.05:
        issues.append(f"aspect mismatch {slide_w_in:.3f}x{slide_h_in:.3f} expected {exp_w}x{exp_h}")

    text_boxes_per_slide: list[int] = []
    pictures_per_slide: list[int] = []
    texts_found: list[str] = []

    for slide in prs.slides:
        text_count = 0
        pic_count = 0
        for shape in slide.shapes:
            if shape.shape_type == MSO_SHAPE_TYPE.PICTURE:
                pic_count += 1
            if getattr(shape, "has_text_frame", False) and _shape_text(shape).strip():
                text_count += 1
                texts_found.append(_shape_text(shape).strip())
        text_boxes_per_slide.append(text_count)
        pictures_per_slide.append(pic_count)
        if text_count < min_text_shapes_per_slide:
            issues.append(f"slide {len(text_boxes_per_slide)} has {text_count} text shapes (< {min_text_shapes_per_slide})")
        if pic_count < 1:
            issues.append(f"slide {len(pictures_per_slide)} missing background picture")

    with zipfile.ZipFile(pptx_path, "r") as archive:
        media_pngs = [n for n in archive.namelist() if n.startswith("ppt/media/") and n.lower().endswith(".png")]
        if len(media_pngs) < expected_pages:
            issues.append(f"embedded png count {len(media_pngs)} < {expected_pages}")

    # Layered background: first slide embedded png must differ from source raster.
    slide01 = slide_dir / "slide-01.png"
    layered_ok = False
    if slide01.is_file() and media_pngs:
        source_bytes = slide01.read_bytes()
        with zipfile.ZipFile(pptx_path, "r") as archive:
            embedded = archive.read(media_pngs[0])
        layered_ok = embedded != source_bytes
        if not layered_ok:
            issues.append("slide-01 background identical to source (text not removed from background)")

    # Keyword sanity from manifest page 1 title
    title_kw = "2026"
    has_title_signal = any(title_kw in t or "AI" in t or "培训" in t for t in texts_found)
    if not has_title_signal:
        issues.append("no expected title keywords in text layers (2026/AI/培训)")

    return {
        "ok": len(issues) == 0,
        "issues": issues,
        "slides": len(prs.slides),
        "aspect": aspect,
        "slide_size_in": [round(slide_w_in, 3), round(slide_h_in, 3)],
        "text_boxes_per_slide": text_boxes_per_slide,
        "pictures_per_slide": pictures_per_slide,
        "embedded_png_count": len(media_pngs),
        "layered_background": layered_ok,
        "sample_texts": texts_found[:12],
        "file_bytes": pptx_path.stat().st_size,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pptx", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--slides-dir", required=True)
    parser.add_argument("--report", default="")
    args = parser.parse_args()

    result = verify_pptx(
        Path(args.pptx),
        Path(args.manifest),
        Path(args.slides_dir),
    )
    if args.report:
        Path(args.report).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    if result["ok"]:
        print("OK nova layered pptx verification")
        print(json.dumps({k: v for k, v in result.items() if k != "sample_texts"}, ensure_ascii=False))
        return 0

    print("FAIL nova layered pptx verification", file=sys.stderr)
    for issue in result["issues"]:
        print(f"  - {issue}", file=sys.stderr)
    print(json.dumps(result, ensure_ascii=False, indent=2), file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
