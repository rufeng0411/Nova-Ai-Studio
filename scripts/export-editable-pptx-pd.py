#!/usr/bin/env python3
# PD-SAAS-FORK: Kit-aligned editable PPTX export (hybrid OCR + Baidu inpaint + page concurrency).
"""Export layered editable PPTX from slide images using editable-pptx-export-kit pipeline."""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR / "lib"))
sys.path.insert(0, str(SCRIPT_DIR / "editable_export"))

from pd_pipeline import build_editable_pptx  # noqa: E402

RASTER_IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"}


def is_raster(path: str) -> bool:
    return Path(path).suffix.lower() in RASTER_IMAGE_EXT


def emit_progress(stage: str, percent: int, page: int = 0, page_total: int = 0) -> None:
    payload: dict[str, object] = {"type": "progress", "stage": stage, "percent": percent}
    if page > 0 and page_total > 0:
        payload["page"] = page
        payload["pageTotal"] = page_total
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Export editable PPTX (Kit pipeline)")
    parser.add_argument("--output", required=True, help="Output .pptx path")
    parser.add_argument("--images", nargs="+", required=True, help="Slide image paths")
    parser.add_argument("--extractor", default="", help="mineru | hybrid | baidu")
    parser.add_argument("--inpaint", default="", help="baidu | pil_fallback")
    parser.add_argument("--workers", type=int, default=0, help="Page-level concurrency (1-16)")
    args = parser.parse_args()

    images = [p for p in args.images if is_raster(p) and os.path.isfile(p)]
    if not images:
        print("No valid slide images", file=sys.stderr)
        return 1

    extractor = args.extractor or os.environ.get("PILOTDECK_DOCUMENT_EXTRACTOR_METHOD", "hybrid")
    inpaint = args.inpaint or os.environ.get("PILOTDECK_INPAINT_METHOD", "baidu")
    workers = args.workers or int(os.environ.get("PPT_EXPORT_MAX_WORKERS", "4") or "4")

    legacy = os.environ.get("PILOTDECK_EDITABLE_PPTX_ENGINE", "").strip().lower() == "legacy"
    if legacy:
        import subprocess

        ocr_script = SCRIPT_DIR / "ocr-to-editable-pptx.py"
        cmd = [sys.executable, str(ocr_script), "--output", args.output, "--inputs", *images]
        proc = subprocess.run(cmd, env=os.environ)
        return proc.returncode

    report = build_editable_pptx(
        images,
        args.output,
        extractor_method=extractor,
        inpaint_method=inpaint,
        max_workers=workers,
        progress=emit_progress,
    )
    print(json.dumps({"type": "result", **report}, ensure_ascii=False))
    print(f"Wrote editable PPTX ({report.get('slides', len(images))} slides) -> {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
