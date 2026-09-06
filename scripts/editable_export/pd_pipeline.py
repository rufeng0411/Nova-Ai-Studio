"""PilotDeck editable PPTX pipeline (Kit-aligned coordinates + hybrid OCR)."""
from __future__ import annotations

import json
import logging
import os
import shutil
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Callable

from PIL import Image

SCRIPT_DIR = Path(__file__).resolve().parent.parent
LIB_DIR = SCRIPT_DIR / "lib"
if str(LIB_DIR) not in sys.path:
    sys.path.insert(0, str(LIB_DIR))
if str(Path(__file__).resolve().parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent))

from mineru_cache import cache_key_for_files, load_cached_mineru, save_cached_mineru  # noqa: E402
from mineru_cloud import (  # noqa: E402
    MinerUCloudError,
    find_layout_json,
    run_mineru_extract_dir,
)
from pptx_builder import PPTXBuilder  # noqa: E402

from baidu_accurate_ocr import create_baidu_accurate_ocr_provider  # noqa: E402
from baidu_inpaint import inpaint_slide  # noqa: E402
from slide_text_merge import merge_slide_text_elements  # noqa: E402
from mineru_elements import elements_from_layout_dir  # noqa: E402
from dedupe_elements import dedupe_text_elements  # noqa: E402
from text_style import attach_text_styles  # noqa: E402

logger = logging.getLogger(__name__)

ProgressFn = Callable[[str, int, int, int], None]


def _noop_progress(_stage: str, _pct: int, _page: int = 0, _page_total: int = 0) -> None:
    pass


def _image_to_single_page_pdf(image_path: str) -> str:
    import subprocess

    out = os.path.join(tempfile.gettempdir(), f"pd-slide-{os.getpid()}-{int(time.time() * 1000)}.pdf")
    script = SCRIPT_DIR / "compose-images-document.mjs"
    node = os.environ.get("NODE", "node")
    proc = subprocess.run(
        [node, str(script), "--output", out, "--images", image_path],
        capture_output=True,
        text=True,
        cwd=str(SCRIPT_DIR.parent),
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "Failed to build single-page PDF for MinerU")
    return out


def _mineru_result_dir_for_image(
    image_path: str,
    *,
    token: str,
    api_url: str,
    mode: str,
) -> Path:
    cache_key = cache_key_for_files([image_path], extra="layout-v1")
    cached = load_cached_mineru(cache_key)
    if cached and isinstance(cached, dict) and cached.get("mineru_dir"):
        cached_dir = Path(str(cached["mineru_dir"]))
        if cached_dir.is_dir() and (cached_dir / "layout.json").is_file():
            return cached_dir

    pdf_path = _image_to_single_page_pdf(image_path)
    try:
        extract_root = Path(tempfile.mkdtemp(prefix="mineru-layout-"))
        run_mineru_extract_dir(pdf_path, token, api_url, mode, str(extract_root))
        if find_layout_json(extract_root) is None and not list(extract_root.glob("*.json")):
            raise MinerUCloudError("MinerU result missing layout.json")
        save_cached_mineru(cache_key, {"mineru_dir": str(extract_root)})
        return extract_root
    finally:
        if os.path.isfile(pdf_path):
            os.remove(pdf_path)


def _baidu_elements_from_image(image_path: str) -> list[dict[str, Any]]:
    provider = create_baidu_accurate_ocr_provider()
    if provider is None:
        return []
    try:
        result = provider.recognize(
            image_path,
            recognize_granularity="small",
            probability=True,
        )
    except Exception as exc:
        logger.warning("Baidu OCR failed for %s: %s", image_path, exc)
        return []

    elements: list[dict[str, Any]] = []
    text_lines = result.get("text_lines") or []
    for line in text_lines:
        if not isinstance(line, dict):
            continue
        text = str(line.get("text") or "").strip()
        bbox = line.get("bbox")
        if not text or not bbox or len(bbox) < 4:
            continue
        entry: dict[str, Any] = {
            "bbox": [float(v) for v in bbox[:4]],
            "type": "text",
            "text": text,
            "source": "baidu",
        }
        if line.get("chars"):
            entry["chars"] = line["chars"]
        elements.append(entry)
    if elements:
        return elements

    # Fallback: legacy words_result shape
    words = result.get("words_result") or []
    for item in words:
        if not isinstance(item, dict):
            continue
        text = str(item.get("words") or item.get("text") or "").strip()
        loc = item.get("location") or item.get("bbox")
        if isinstance(loc, dict):
            x0 = float(loc.get("left", loc.get("x0", 0)))
            y0 = float(loc.get("top", loc.get("y0", 0)))
            w = float(loc.get("width", 0))
            h = float(loc.get("height", 0))
            bbox = [x0, y0, x0 + w, y0 + h]
        elif isinstance(loc, list) and len(loc) >= 4:
            bbox = [float(v) for v in loc[:4]]
        else:
            continue
        if not text:
            continue
        elements.append({"bbox": bbox, "type": "text", "text": text, "source": "baidu"})
    return elements


def analyze_slide_elements(
    image_path: str,
    *,
    extractor_method: str | None = None,
    mineru_dir: str | Path | None = None,
) -> list[dict[str, Any]]:
    """Return text/image elements in pixel coordinates for overlay QA."""
    method = (
        extractor_method
        or os.environ.get("PILOTDECK_DOCUMENT_EXTRACTOR_METHOD")
        or "hybrid"
    ).strip().lower()

    with Image.open(image_path) as im:
        w, h = im.size

    mineru_elements: list[dict[str, Any]] = []
    if mineru_dir:
        mineru_elements = elements_from_layout_dir(mineru_dir, w, h, 0)
    elif method != "baidu":
        token = os.environ.get("MINERU_API_TOKEN") or os.environ.get("PILOTDECK_DOCUMENT_OCR_API_KEY") or ""
        api_url = os.environ.get("PILOTDECK_DOCUMENT_OCR_API_URL", "https://mineru.net/api/v4")
        mode = os.environ.get("PILOTDECK_DOCUMENT_OCR_MODE", "cloud")
        if token or mode == "local":
            try:
                result_dir = _mineru_result_dir_for_image(image_path, token=token, api_url=api_url, mode=mode)
                mineru_elements = elements_from_layout_dir(result_dir, w, h, 0)
            except Exception as exc:
                logger.warning("MinerU layout failed for %s: %s", image_path, exc)

    if method == "mineru":
        return dedupe_text_elements(
            [e for e in mineru_elements if e.get("text") or str(e.get("type")) in ("image", "figure")]
        )

    baidu_elements = _baidu_elements_from_image(image_path)
    if method == "baidu":
        return dedupe_text_elements(baidu_elements)
    if not baidu_elements:
        return mineru_elements
    if not mineru_elements:
        return baidu_elements
    merged = merge_slide_text_elements(mineru_elements, baidu_elements)
    return dedupe_text_elements(merged)


def make_slide_editable(
    image_path: str,
    *,
    extractor_method: str | None = None,
    inpaint_method: str | None = None,
) -> tuple[Image.Image, list[dict[str, Any]], int, int]:
    """Return clean background, text elements, width, height."""
    elements = analyze_slide_elements(image_path, extractor_method=extractor_method)
    text_elements = [e for e in elements if str(e.get("text") or "").strip()]
    with Image.open(image_path) as im:
        base = im.convert("RGB")
        w, h = base.size
        text_elements = attach_text_styles(base, text_elements)

    mask_boxes = [{"x0": b["bbox"][0], "y0": b["bbox"][1], "x1": b["bbox"][2], "y1": b["bbox"][3]} for b in text_elements if b.get("bbox")]
    clean = inpaint_slide(base, mask_boxes, method=inpaint_method)
    return clean, text_elements, w, h


def build_editable_pptx(
    image_paths: list[str],
    output_path: str,
    *,
    extractor_method: str | None = None,
    inpaint_method: str | None = None,
    max_workers: int | None = None,
    progress: ProgressFn | None = None,
) -> dict[str, Any]:
    """Build layered editable PPTX from slide images."""
    report_progress = progress or _noop_progress
    workers = max_workers or int(os.environ.get("PPT_EXPORT_MAX_WORKERS", "4") or "4")
    workers = max(1, min(workers, 16))

    slide_data: list[tuple[Image.Image, list[dict[str, Any]], int, int] | None] = [None] * len(image_paths)

    def _process(idx: int, path: str) -> tuple[int, Image.Image, list[dict[str, Any]], int, int]:
        clean, elements, w, h = make_slide_editable(
            path,
            extractor_method=extractor_method,
            inpaint_method=inpaint_method,
        )
        return idx, clean, elements, w, h

    report_progress("layout", 10, 0, len(image_paths))
    if workers == 1 or len(image_paths) == 1:
        for i, p in enumerate(image_paths):
            report_progress("layout", 10 + int(30 * i / len(image_paths)), i + 1, len(image_paths))
            _, clean, elements, w, h = _process(i, p)
            slide_data[i] = (clean, elements, w, h)
            report_progress("layout", 10 + int(30 * (i + 1) / len(image_paths)), i + 1, len(image_paths))
    else:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(_process, i, p) for i, p in enumerate(image_paths)]
            done = 0
            for fut in as_completed(futures):
                idx, clean, elements, w, h = fut.result()
                slide_data[idx] = (clean, elements, w, h)
                done += 1
                report_progress("layout", 10 + int(30 * done / len(image_paths)), done, len(image_paths))

    report_progress("build", 75, 0, len(image_paths))
    builder = PPTXBuilder()
    builder.create_presentation()
    first_w, first_h = slide_data[0][2], slide_data[0][3] if slide_data[0] else (1920, 1080)
    builder.setup_presentation_size(first_w, first_h)
    slide_w_px, slide_h_px = first_w, first_h

    for i, item in enumerate(slide_data):
        if item is None:
            continue
        clean, elements, w, h = item
        report_progress("build", 75 + int(20 * i / len(slide_data)), i + 1, len(slide_data))
        if i == 0:
            slide = builder.add_blank_slide()
        else:
            if w != slide_w_px or h != slide_h_px:
                builder.setup_presentation_size(w, h)
                slide_w_px, slide_h_px = w, h
            slide = builder.add_blank_slide()

        tmp_bg = os.path.join(tempfile.gettempdir(), f"pd-bg-{os.getpid()}-{i}.jpg")
        clean.save(tmp_bg, format="JPEG", quality=92)
        try:
            slide.shapes.add_picture(
                tmp_bg,
                left=0,
                top=0,
                width=builder.prs.slide_width,
                height=builder.prs.slide_height,
            )
        except Exception as exc:
            logger.error("Failed to add background for slide %s: %s", i, exc)

        scale_x = slide_w_px / w if w else 1.0
        scale_y = slide_h_px / h if h else 1.0
        for el in elements:
            text = str(el.get("text") or "").strip()
            bbox = el.get("bbox")
            if not text or not bbox or len(bbox) < 4:
                continue
            scaled = [
                int(float(bbox[0]) * scale_x),
                int(float(bbox[1]) * scale_y),
                int(float(bbox[2]) * scale_x),
                int(float(bbox[3]) * scale_y),
            ]
            item_type = str(el.get("type") or "text")
            level = "title" if item_type in ("title", "heading", "header") else "default"
            text_style = el.get("text_style")
            builder.add_text_element(
                slide=slide,
                text=text,
                bbox=scaled,
                text_level=level,
                align=str(getattr(text_style, "text_alignment", None) or "left"),
                text_style=text_style,
            )
        if os.path.isfile(tmp_bg):
            os.remove(tmp_bg)
        report_progress("build", 75 + int(20 * (i + 1) / len(slide_data)), i + 1, len(slide_data))

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    builder.save(output_path)
    report_progress("done", 100, len(image_paths), len(image_paths))
    return {
        "slides": len(image_paths),
        "output": output_path,
        "text_boxes": sum(len(s[1]) for s in slide_data if s),
    }
