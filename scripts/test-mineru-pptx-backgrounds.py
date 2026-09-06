#!/usr/bin/env python3
"""Offline regression: MinerU JSON → PPTX must embed per-slide raster backgrounds."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent


def _make_png(path: Path, rgb: tuple[int, int, int]) -> None:
    from PIL import Image

    Image.new("RGB", (640, 360), rgb).save(path)


def _run_builder(json_path: Path, output_path: Path, backgrounds: list[Path]) -> None:
    script = SCRIPT_DIR / "mineru-json-to-pptx-v2.py"
    cmd = [
        sys.executable,
        str(script),
        "--json",
        str(json_path),
        "--output",
        str(output_path),
        "--backgrounds",
        *[str(p) for p in backgrounds],
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or "builder failed")


def _media_count(pptx_path: Path) -> int:
    with zipfile.ZipFile(pptx_path, "r") as archive:
        return sum(1 for name in archive.namelist() if name.startswith("ppt/media/"))


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="mineru-pptx-bg-") as tmp:
        tmp_path = Path(tmp)
        bg1 = tmp_path / "slide-1.png"
        bg2 = tmp_path / "slide-2.png"
        _make_png(bg1, (220, 40, 40))
        _make_png(bg2, (40, 120, 220))

        payload = {
            "pdf_info": [
                {
                    "para_blocks": [
                        {
                            "bbox": [80, 80, 400, 140],
                            "lines": [{"spans": [{"content": "Slide one title"}]}],
                        }
                    ]
                },
                {
                    "para_blocks": [
                        {
                            "bbox": [80, 80, 400, 140],
                            "lines": [{"spans": [{"content": "Slide two title"}]}],
                        }
                    ]
                },
            ]
        }
        json_path = tmp_path / "mineru.json"
        json_path.write_text(json.dumps(payload), encoding="utf-8")
        out_path = tmp_path / "deck.pptx"
        _run_builder(json_path, out_path, [bg1, bg2])

        if not out_path.is_file():
            print("FAIL: output PPTX missing", file=sys.stderr)
            return 1
        media = _media_count(out_path)
        if media < 2:
            print(f"FAIL: expected >=2 embedded images, got {media}", file=sys.stderr)
            return 1

        # PDF must not be used as a picture background.
        pdf_bg = tmp_path / "bundle.pdf"
        pdf_bg.write_bytes(b"%PDF-1.4\n% invalid test pdf\n")
        out_pdf = tmp_path / "deck-pdf-bg.pptx"
        proc = subprocess.run(
            [
                sys.executable,
                str(SCRIPT_DIR / "mineru-json-to-pptx-v2.py"),
                "--json",
                str(json_path),
                "--output",
                str(out_pdf),
                "--background",
                str(pdf_bg),
            ],
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            print(f"FAIL: pdf background run failed: {proc.stderr}", file=sys.stderr)
            return 1
        if _media_count(out_pdf) != 0:
            print("FAIL: non-raster PDF was incorrectly embedded as slide background", file=sys.stderr)
            return 1

    print("OK mineru-json-to-pptx-v2 embeds per-slide raster backgrounds")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
