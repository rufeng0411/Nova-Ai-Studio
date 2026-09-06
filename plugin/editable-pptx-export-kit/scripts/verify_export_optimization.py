#!/usr/bin/env python3
"""
PPT 导出优化 — 多尺寸/多结构实际验证脚本。
用法（在 backend 目录）: python scripts/verify_export_optimization.py
"""
from __future__ import annotations

import os
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace
from typing import Callable, List, Optional, Tuple

# backend 根目录入 path
_BACKEND = Path(__file__).resolve().parents[1]
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from PIL import Image, ImageDraw, ImageFont

from services.export_service import (
    ExportService,
    ExportEmbedImageCache,
    _get_page_size_inches,
    _letterbox_picture_inches,
    get_pptx_export_embed_settings,
    prepare_image_for_embed,
)
from utils.page_utils import resolve_export_page_image_abs_path


@dataclass
class CaseResult:
    name: str
    ok: bool
    detail: str


def _fake_fs(root: Path):
    class FS:
        def get_absolute_path(self, rel: str) -> str:
            return str(root / rel)

    return FS()


def make_image(path: Path, w: int, h: int, kind: str) -> None:
    if kind == "solid":
        Image.new("RGB", (w, h), (48, 96, 160)).save(path)
    elif kind == "gradient":
        im = Image.new("RGB", (w, h))
        px = im.load()
        for y in range(h):
            for x in range(w):
                px[x, y] = (x * 255 // max(w, 1), y * 255 // max(h, 1), 128)
        im.save(path)
    elif kind == "noise":
        im = Image.new("RGB", (w, h))
        px = im.load()
        step = max(1, min(w, h) // 512)
        for y in range(0, h, step):
            for x in range(0, w, step):
                px[x, y] = ((x * 17 + y * 31) % 256, (x * 13 + y * 7) % 256, (x + y) % 256)
        im.save(path)
    elif kind == "text_slide":
        im = Image.new("RGB", (w, h), (245, 245, 250))
        draw = ImageDraw.Draw(im)
        draw.rectangle([0, 0, w, h // 5], fill=(30, 64, 120))
        try:
            font = ImageFont.load_default()
        except Exception:
            font = None
        draw.text((w * 0.08, h * 0.04), "Export Verification Title", fill=(255, 255, 255), font=font)
        draw.text((w * 0.08, h * 0.28), "Body line one for editable layer check.", fill=(20, 20, 30), font=font)
        draw.text((w * 0.08, h * 0.34), "Body line two with bullet semantics.", fill=(20, 20, 30), font=font)
        im.save(path)
    elif kind == "rgba":
        im = Image.new("RGBA", (w, h), (200, 100, 50, 180))
        im.save(path)
    else:
        raise ValueError(kind)


SCENARIOS: List[Tuple[str, int, int, str, str]] = [
    ("small_16x9_solid", 800, 450, "16:9", "solid"),
    ("hd_16x9_gradient", 1920, 1080, "16:9", "gradient"),
    ("2k_16x9_noise", 2752, 1536, "16:9", "noise"),
    ("4k_16x9_noise", 3840, 2160, "16:9", "noise"),
    ("vertical_9x16_noise", 1080, 1920, "9:16", "noise"),
    ("classic_4x3_gradient", 1600, 1200, "4:3", "gradient"),
    ("2k_rgba_transparent", 2752, 1536, "16:9", "rgba"),
    ("2k_text_slide", 2752, 1536, "16:9", "text_slide"),
]


def verify_path_resolution(tmp: Path) -> List[CaseResult]:
    results: List[CaseResult] = []
    fs = _fake_fs(tmp)
    gen = tmp / "pages" / "a.png"
    gen.parent.mkdir(parents=True, exist_ok=True)
    gen.write_bytes(b"png")
    thumb = tmp / "pages" / "a_thumb.jpg"
    thumb.write_bytes(b"jpg")

    page_gen = SimpleNamespace(id="p1", generated_image_path="pages/a.png", cached_image_path="pages/a_thumb.jpg")
    got = resolve_export_page_image_abs_path(page_gen, fs)
    results.append(CaseResult("path_prefer_generated", got == str(gen), f"got={got}"))

    page_fallback = SimpleNamespace(
        id="p2",
        generated_image_path="pages/missing.png",
        cached_image_path="pages/a_thumb.jpg",
    )
    got2 = resolve_export_page_image_abs_path(page_fallback, fs)
    results.append(CaseResult("path_fallback_cached", got2 == str(thumb), f"got={got2}"))

    page_none = SimpleNamespace(id="p3", generated_image_path="pages/nope.png", cached_image_path="pages/nope2.jpg")
    got3 = resolve_export_page_image_abs_path(page_none, fs)
    results.append(CaseResult("path_all_missing", got3 is None, f"got={got3}"))
    return results


def verify_export_sizes(
    tmp: Path,
    name: str,
    w: int,
    h: int,
    aspect: str,
    kind: str,
) -> List[CaseResult]:
    results: List[CaseResult] = []
    slides: List[str] = []
    for i in range(3):
        p = tmp / f"{name}_s{i}.png"
        make_image(p, w, h, kind)
        slides.append(str(p))
    raw_total = sum(Path(s).stat().st_size for s in slides)

    pdf_c = tmp / f"{name}.pdf"
    pptx_c = tmp / f"{name}.pptx"
    ExportService.create_pdf_from_images(slides, output_file=str(pdf_c), aspect_ratio=aspect)
    ExportService.create_pptx_from_images(slides, output_file=str(pptx_c), aspect_ratio=aspect)

    os.environ["PPT_EXPORT_PDF_NO_RECOMPRESS"] = "1"
    os.environ["PPT_EXPORT_PPTX_NO_RECOMPRESS"] = "1"
    pdf_u = tmp / f"{name}_raw.pdf"
    pptx_u = tmp / f"{name}_raw.pptx"
    ExportService.create_pdf_from_images(slides, output_file=str(pdf_u), aspect_ratio=aspect)
    ExportService.create_pptx_from_images(slides, output_file=str(pptx_u), aspect_ratio=aspect)
    del os.environ["PPT_EXPORT_PDF_NO_RECOMPRESS"]
    del os.environ["PPT_EXPORT_PPTX_NO_RECOMPRESS"]

    pdf_ok = pdf_c.exists() and pdf_c.stat().st_size > 0
    pptx_ok = pptx_c.exists() and pptx_c.stat().st_size > 0
    results.append(CaseResult(f"{name}/files_exist", pdf_ok and pptx_ok, f"pdf={pdf_c.stat().st_size if pdf_ok else 0} pptx={pptx_c.stat().st_size if pptx_ok else 0}"))

    # 高熵噪声大图：压缩后 PPTX 应小于 PNG 直嵌。
    # 渐变/平滑合成图 JPEG 偶比 PNG 更大，text_slide 体积也小，不在此硬断言。
    if kind == "noise" and max(w, h) >= 3840:
        pptx_ratio = pptx_c.stat().st_size / max(pptx_u.stat().st_size, 1)
        results.append(
            CaseResult(
                f"{name}/pptx_smaller_than_raw_png_embed",
                pptx_c.stat().st_size < pptx_u.stat().st_size,
                f"compressed={pptx_c.stat().st_size} raw_png_embed={pptx_u.stat().st_size} ratio={pptx_ratio:.2f}",
            )
        )
    elif kind == "noise" and max(w, h) >= 2752:
        pptx_ratio = pptx_c.stat().st_size / max(pptx_u.stat().st_size, 1)
        results.append(
            CaseResult(
                f"{name}/pptx_not_much_larger_than_raw",
                pptx_c.stat().st_size <= pptx_u.stat().st_size * 1.35,
                f"compressed={pptx_c.stat().st_size} raw_png_embed={pptx_u.stat().st_size} ratio={pptx_ratio:.2f}",
            )
        )

    # letterbox 英寸不变（压缩不改变显示比例盒）
    embed = prepare_image_for_embed(slides[0], 1920, 82, dest_path=str(tmp / f"{name}_embed.jpg"))
    page_w, page_h = _get_page_size_inches(aspect)
    box_a = _letterbox_picture_inches(slides[0], page_w, page_h)
    box_b = _letterbox_picture_inches(embed, page_w, page_h)

    if box_a and box_b:
        same = all(abs(box_a[i] - box_b[i]) < 0.002 for i in range(4))
        results.append(CaseResult(f"{name}/letterbox_invariant", same, f"raw={box_a} embed={box_b}"))
    else:
        results.append(CaseResult(f"{name}/letterbox_invariant", False, "box is None"))

    with Image.open(embed) as im:
        max_edge = max(im.size)
    results.append(CaseResult(f"{name}/embed_max_edge", max_edge <= 1920, f"max_edge={max_edge} raw={w}x{h} raw_kb={raw_total//1024}"))

    return results


def verify_editable_smoke(tmp: Path) -> CaseResult:
    """单页可编辑 PPTX 冒烟（混合模式：MinerU 失效时可降级百度 OCR）。"""
    slide = tmp / "editable_src.png"
    make_image(slide, 1920, 1080, "text_slide")
    out = tmp / "editable_smoke.pptx"
    try:
        from app import create_app
        from config import Config
        from utils.mineru_config import apply_mineru_config_to_app

        app = create_app()
        with app.app_context():
            apply_mineru_config_to_app(
                app.config,
                db_token=None,
                db_api_base=None,
                config_token=os.environ.get("MINERU_TOKEN") or Config.MINERU_TOKEN,
                config_api_base=os.environ.get("MINERU_API_BASE") or Config.MINERU_API_BASE,
            )
            if not (app.config.get("BAIDU_API_KEY") or "").strip():
                app.config["BAIDU_API_KEY"] = (os.environ.get("BAIDU_API_KEY") or Config.BAIDU_API_KEY or "").strip()
            _, warnings = ExportService.create_editable_pptx_with_recursive_analysis(
                image_paths=[str(slide)],
                output_file=str(out),
                slide_width_pixels=1920,
                slide_height_pixels=1080,
                max_depth=1,
                max_workers=2,
                export_extractor_method="hybrid",
                export_inpaint_method="hybrid",
                fail_fast=True,
                text_attribute_extractor=None,
            )
        if not out.exists():
            return CaseResult("editable_pptx_smoke", False, "output missing")
        size = out.stat().st_size
        warn_n = len(warnings.to_summary()) if warnings else 0
        return CaseResult(
            "editable_pptx_smoke",
            size > 1000,
            f"bytes={size} warnings={warn_n}",
        )
    except Exception as e:
        return CaseResult("editable_pptx_smoke", False, f"{type(e).__name__}: {e}")


def main() -> int:
    from dotenv import load_dotenv

    load_dotenv(_BACKEND.parent / ".env", override=True)

    max_edge, quality, skip = get_pptx_export_embed_settings()
    print("=== PPT Export Optimization Verification ===")
    print(f"PPTX embed settings: max_long_edge={max_edge} quality={quality} skip_recompress={skip}")
    print(f"PDF NO_RECOMPRESS env: {os.environ.get('PPT_EXPORT_PDF_NO_RECOMPRESS', '(unset)')}")
    print(f"PPTX NO_RECOMPRESS env: {os.environ.get('PPT_EXPORT_PPTX_NO_RECOMPRESS', '(unset)')}")
    print()

    all_results: List[CaseResult] = []
    with tempfile.TemporaryDirectory(prefix="export_verify_", ignore_cleanup_errors=True) as td:
        tmp = Path(td)
        try:
            all_results.extend(verify_path_resolution(tmp))
            for name, w, h, aspect, kind in SCENARIOS:
                print(f"Running scenario: {name} ({w}x{h} {aspect} {kind})...")
                all_results.extend(verify_export_sizes(tmp, name, w, h, aspect, kind))

            print("Running editable PPTX smoke (1 page, hybrid extractor)...")
            editable_result = verify_editable_smoke(tmp)
            all_results.append(editable_result)
        except Exception as e:
            all_results.append(CaseResult("verify_runner", False, f"{type(e).__name__}: {e}"))

    passed = sum(1 for r in all_results if r.ok)
    failed = [r for r in all_results if not r.ok]
    print()
    print(f"TOTAL: {passed}/{len(all_results)} passed")
    for r in all_results:
        mark = "OK" if r.ok else "FAIL"
        print(f"  [{mark}] {r.name}: {r.detail}")
    if failed:
        print("\nFailed cases:")
        for r in failed:
            print(f"  - {r.name}: {r.detail}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
