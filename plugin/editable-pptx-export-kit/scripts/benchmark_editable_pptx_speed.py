#!/usr/bin/env python3
"""可编辑 PPTX 导出速度对比：旧策略 vs 新策略（均保留 MinerU 混合提取）。"""
from __future__ import annotations

import json
import os
import shutil
import sys
import time
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))


def _clear_mineru_cache_index(upload_folder: Path) -> None:
    cache_dir = upload_folder / "mineru_cache"
    if cache_dir.exists():
        shutil.rmtree(cache_dir, ignore_errors=True)


def _run_scenario(
    *,
    label: str,
    project_id: str,
    page_paths: list[str],
    inpaint_method: str,
    enhance_quality: bool,
    mineru_cache: bool,
    max_workers: int = 8,
) -> dict:
    os.environ["PPT_EXPORT_INPAINT_ENHANCE_QUALITY"] = "1" if enhance_quality else "0"
    os.environ["PPT_EXPORT_MINERU_CACHE"] = "1" if mineru_cache else "0"

    from app import create_app
    from services.export_service import ExportService

    app = create_app()
    out_dir = Path(app.config["UPLOAD_FOLDER"]) / project_id / "exports" / "_bench"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / f"{label}_{int(time.time())}.pptx"

    with app.app_context():
        t0 = time.monotonic()
        try:
            _, warnings = ExportService.create_editable_pptx_with_recursive_analysis(
                image_paths=page_paths,
                output_file=str(out_file),
                max_depth=1,
                max_workers=max_workers,
                text_attribute_extractor=None,
                export_extractor_method="hybrid",
                export_inpaint_method=inpaint_method,
                fail_fast=True,
            )
            ok = out_file.exists() and out_file.stat().st_size > 5000
            err = None
        except Exception as e:
            ok = False
            err = str(e)
            warnings = None
        elapsed = time.monotonic() - t0

    size_kb = round(out_file.stat().st_size / 1024, 1) if out_file.exists() else 0
    return {
        "label": label,
        "inpaint": inpaint_method,
        "enhance_quality": enhance_quality,
        "mineru_cache": mineru_cache,
        "pages": len(page_paths),
        "elapsed_sec": round(elapsed, 1),
        "ok": ok,
        "size_kb": size_kb,
        "error": err,
        "warnings": len(warnings.to_summary()) if warnings and hasattr(warnings, "to_summary") else 0,
        "output": str(out_file),
    }


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--project-id", default="6b43de65-a7a5-44db-84d3-a1de6b66abe7")
    parser.add_argument("--max-pages", type=int, default=3)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--skip-legacy", action="store_true", help="跳过旧策略（耗时长）")
    args = parser.parse_args()

    from app import create_app
    from models import Page
    from utils import collect_export_page_image_paths
    from services.file_service import FileService

    app = create_app()
    with app.app_context():
        pages = Page.query.filter_by(project_id=args.project_id).order_by(Page.order_index).all()
        fs = FileService(app.config["UPLOAD_FOLDER"])
        paths = collect_export_page_image_paths(pages, fs)[: max(1, args.max_pages)]

    if not paths:
        print("ERROR: 无可用页图", file=sys.stderr)
        return 1

    upload = Path(app.config["UPLOAD_FOLDER"])
    print(f"Benchmark project={args.project_id} pages={len(paths)} workers={args.workers}")
    print("-" * 60)

    results: list[dict] = []

    if not args.skip_legacy:
        _clear_mineru_cache_index(upload)
        print("[1/3] 旧策略：hybrid inpaint + 生成式画质提升 + 无 MinerU 缓存 …")
        results.append(
            _run_scenario(
                label="legacy_hybrid_enhance",
                project_id=args.project_id,
                page_paths=paths,
                inpaint_method="hybrid",
                enhance_quality=True,
                mineru_cache=False,
                max_workers=args.workers,
            )
        )
        print(json.dumps(results[-1], ensure_ascii=False, indent=2))

    _clear_mineru_cache_index(upload)
    print("[2/3] 新策略（冷启动）：hybrid 提取 + baidu inpaint + 无画质增强 …")
    results.append(
        _run_scenario(
            label="optimized_baidu_cold",
            project_id=args.project_id,
            page_paths=paths,
            inpaint_method="baidu",
            enhance_quality=False,
            mineru_cache=True,
            max_workers=args.workers,
        )
    )
    print(json.dumps(results[-1], ensure_ascii=False, indent=2))

    print("[3/3] 新策略（热缓存）：同页立即再导出一遍 …")
    results.append(
        _run_scenario(
            label="optimized_baidu_warm",
            project_id=args.project_id,
            page_paths=paths,
            inpaint_method="baidu",
            enhance_quality=False,
            mineru_cache=True,
            max_workers=args.workers,
        )
    )
    print(json.dumps(results[-1], ensure_ascii=False, indent=2))

    legacy = next((r for r in results if r["label"] == "legacy_hybrid_enhance"), None)
    cold = next((r for r in results if r["label"] == "optimized_baidu_cold"), None)
    warm = next((r for r in results if r["label"] == "optimized_baidu_warm"), None)

    print("\n" + "=" * 60)
    print("SUMMARY")
    if legacy and cold and legacy.get("ok") and cold.get("ok"):
        speedup = legacy["elapsed_sec"] / max(cold["elapsed_sec"], 0.1)
        saved = legacy["elapsed_sec"] - cold["elapsed_sec"]
        print(
            f"  旧 → 新（冷）: {legacy['elapsed_sec']}s → {cold['elapsed_sec']}s "
            f"(快 {speedup:.2f}x，省 {saved:.1f}s)"
        )
    elif cold:
        print(f"  新策略（冷）: {cold['elapsed_sec']}s")
    if cold and warm and cold.get("ok") and warm.get("ok"):
        cache_speedup = cold["elapsed_sec"] / max(warm["elapsed_sec"], 0.1)
        print(
            f"  新（冷）→ 新（热缓存）: {cold['elapsed_sec']}s → {warm['elapsed_sec']}s "
            f"(快 {cache_speedup:.2f}x)"
        )
    print("=" * 60)

    report_path = BACKEND / "scripts" / "_bench_editable_pptx_result.json"
    report_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Report: {report_path}")
    return 0 if all(r.get("ok") for r in results if r["label"] != "legacy_hybrid_enhance" or not args.skip_legacy) else 1


if __name__ == "__main__":
    raise SystemExit(main())
