#!/usr/bin/env python3
"""Convert MinerU JSON (+ optional source image) into editable PPTX text boxes."""
from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any

from pptx import Presentation
from pptx.util import Inches, Pt


def _collect_lines(payload: dict[str, Any] | list[Any]) -> list[str]:
    lines: list[str] = []
    if isinstance(payload, list):
        for item in payload:
            if not isinstance(item, dict):
                continue
            text = str(item.get("text") or item.get("content") or "").strip()
            if text:
                lines.append(text)
        return lines
    if isinstance(payload, dict):
        for page in payload.get("pdf_info") or []:
            if not isinstance(page, dict):
                continue
            for block in page.get("para_blocks") or page.get("preproc_blocks") or []:
                if not isinstance(block, dict):
                    continue
                for line in block.get("lines") or [block]:
                    if not isinstance(line, dict):
                        continue
                    parts = []
                    for span in line.get("spans") or []:
                        if isinstance(span, dict):
                            part = str(span.get("content") or span.get("text") or "").strip()
                            if part:
                                parts.append(part)
                    merged = "".join(parts).strip() or str(line.get("text") or "").strip()
                    if merged:
                        lines.append(merged)
        if lines:
            return lines
        for key in ("content_list", "pages", "data"):
            nested = payload.get(key)
            if isinstance(nested, list):
                return _collect_lines(nested)
    return lines


def build_pptx_from_text(lines: list[str], output_file: str, title: str | None = None) -> str:
    prs = Presentation()
    blank = prs.slide_layouts[6]
    chunk_size = 12
    chunks = [lines[i : i + chunk_size] for i in range(0, max(len(lines), 1), chunk_size)] or [[]]
    if title:
        slide = prs.slides.add_slide(blank)
        box = slide.shapes.add_textbox(Inches(0.6), Inches(0.5), Inches(12), Inches(1.2))
        box.text_frame.text = title
        box.text_frame.paragraphs[0].font.size = Pt(28)
    for chunk in chunks:
        slide = prs.slides.add_slide(blank)
        body = slide.shapes.add_textbox(Inches(0.6), Inches(0.8), Inches(12), Inches(6.2))
        tf = body.text_frame
        tf.clear()
        if not chunk:
            tf.text = "(empty)"
            continue
        tf.text = chunk[0]
        for line in chunk[1:]:
            p = tf.add_paragraph()
            p.text = line
            p.level = 0
            p.font.size = Pt(18)
        tf.paragraphs[0].font.size = Pt(18)
    os.makedirs(os.path.dirname(output_file) or ".", exist_ok=True)
    prs.save(output_file)
    return output_file


def main() -> int:
    parser = argparse.ArgumentParser(description="MinerU JSON to editable PPTX")
    parser.add_argument("--json", required=True, help="Path to MinerU JSON file")
    parser.add_argument("--output", required=True, help="Output PPTX path")
    parser.add_argument("--title", default="", help="Optional title slide")
    args = parser.parse_args()
    with open(args.json, "r", encoding="utf-8") as handle:
        payload = json.load(handle)
    lines = _collect_lines(payload)
    build_pptx_from_text(lines, args.output, args.title.strip() or None)
    print(f"Wrote editable PPTX with {len(lines)} text block(s) to {args.output}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(1)
