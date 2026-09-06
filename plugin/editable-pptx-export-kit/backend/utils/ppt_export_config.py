"""可编辑 PPTX 导出性能相关配置（环境变量 + 项目字段解析）。"""
from __future__ import annotations

import os


def _env_truthy(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None or str(raw).strip() == "":
        return default
    return str(raw).strip().lower() in ("1", "true", "yes", "on")


def _env_int(name: str, default: int, min_val: int, max_val: int) -> int:
    raw = os.environ.get(name)
    if raw is None or str(raw).strip() == "":
        return default
    try:
        val = int(str(raw).strip())
    except ValueError:
        return default
    return max(min_val, min(max_val, val))


def get_ppt_export_inpaint_enhance_quality() -> bool:
    """
    hybrid inpaint 是否在百度修复后再走生成式画质提升。
    默认 False（显著提速）；需更高观感时设 PPT_EXPORT_INPAINT_ENHANCE_QUALITY=1。
    """
    return _env_truthy("PPT_EXPORT_INPAINT_ENHANCE_QUALITY", default=False)


def get_ppt_export_mineru_cache_enabled() -> bool:
    """是否缓存 MinerU 版面分析结果（同页图重复导出可跳过远程解析）。"""
    return _env_truthy("PPT_EXPORT_MINERU_CACHE", default=True)


def get_ppt_export_max_workers(default: int = 12) -> int:
    """可编辑导出页级并发上限（1–16）。"""
    return _env_int("PPT_EXPORT_MAX_WORKERS", default, 1, 16)


def resolve_effective_export_inpaint_method(project_method: str | None) -> str:
    """
    解析有效的背景修复方法。
    项目未设置时使用 PPT_EXPORT_DEFAULT_INPAINT_METHOD（默认 baidu，更快）。
    """
    fallback = (os.environ.get("PPT_EXPORT_DEFAULT_INPAINT_METHOD") or "baidu").strip().lower()
    method = (project_method or fallback or "baidu").strip().lower()
    if method not in ("hybrid", "baidu", "generative"):
        return fallback if fallback in ("hybrid", "baidu", "generative") else "baidu"
    return method


def resolve_effective_export_extractor_method(project_method: str | None) -> str:
    method = (project_method or "hybrid").strip().lower()
    return method if method in ("hybrid", "mineru") else "hybrid"
