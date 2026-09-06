#!/usr/bin/env python3
"""Offline regression: layered PPTX uses inpainted background, not duplicate burned-in text."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SCRIPT_DIR = Path(__file__).resolve().parent


def _make_slide_with_text(path: Path, text: str) -> None:
    img = Image.new("RGB", (1280, 720), (30, 90, 180))
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("arial.ttf", 96)
    except OSError:
        font = ImageFont.load_default()
    draw.text((120, 260), text, fill=(255, 255, 255), font=font)
    img.save(path)


def _run_builder(json_path: Path, output_path: Path, background: Path) -> None:
    script = SCRIPT_DIR / "mineru-json-to-pptx-v2.py"
    cmd = [
        sys.executable,
        str(script),
        "--json",
        str(json_path),
        "--output",
        str(output_path),
        "--background",
        str(background),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or "builder failed")


def _embedded_png_bytes(pptx_path: Path) -> bytes:
    with zipfile.ZipFile(pptx_path, "r") as archive:
        for name in archive.namelist():
            if name.startswith("ppt/media/") and name.lower().endswith(".png"):
                return archive.read(name)
    raise RuntimeError("no embedded png in pptx")


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="mineru-layer-") as tmp:
        tmp_path = Path(tmp)
        bg = tmp_path / "slide.png"
        _make_slide_with_text(bg, "LAYER TEST")

        payload = {
            "pdf_info": [
                {
                    "para_blocks": [
                        {
                            "bbox": [110, 240, 760, 380],
                            "lines": [{"spans": [{"content": "LAYER TEST"}]}],
                        }
                    ]
                }
            ]
        }
        json_path = tmp_path / "mineru.json"
        json_path.write_text(json.dumps(payload), encoding="utf-8")
        out_path = tmp_path / "deck.pptx"
        _run_builder(json_path, out_path, bg)

        if not out_path.is_file():
            print("FAIL: output missing", file=sys.stderr)
            return 1

        embedded = _embedded_png_bytes(out_path)
        with Image.open(bg) as original, Image.open(__import__("io").BytesIO(embedded)) as layered:
            # Inpainted background should differ from original where text was burned in.
            if original.tobytes() == layered.tobytes():
                print("FAIL: background was not inpainted (identical to source slide)", file=sys.stderr)
                return 1

    print("OK mineru-json-to-pptx-v2 produces layered background separate from text")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
