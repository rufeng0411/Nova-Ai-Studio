#!/usr/bin/env python3
"""Benchmark editable PPTX export speed (Kit pipeline)."""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR / "lib"))
sys.path.insert(0, str(SCRIPT_DIR / "editable_export"))

from pd_pipeline import build_editable_pptx  # noqa: E402

DECK = (
    SCRIPT_DIR.parent
    / "skills/vendor/nova-1/nova-ppt-aesthetic-slides/acceptance/enterprise-ai-training-2026"
)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--deck-dir", default=str(DECK))
    parser.add_argument("--output", default="artifacts/document-smoke/benchmark-editable.pptx")
    parser.add_argument("--runs", type=int, default=1)
    args = parser.parse_args()

    slides = sorted(Path(args.deck_dir).glob("slide-*.png"))
    if not slides:
        print("no slides", file=sys.stderr)
        return 1

    images = [str(p) for p in slides]
    out = str(SCRIPT_DIR.parent / args.output)
    timings: list[float] = []
    for run in range(args.runs):
        t0 = time.perf_counter()
        build_editable_pptx(images, out)
        elapsed = time.perf_counter() - t0
        timings.append(elapsed)
        print(f"run {run + 1}: {elapsed:.2f}s")

    report = {
        "slides": len(images),
        "runs": args.runs,
        "seconds": timings,
        "avg_seconds": sum(timings) / len(timings),
        "output": out,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
