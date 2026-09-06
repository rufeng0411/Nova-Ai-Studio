# PD-SAAS-FORK: PPTX slide dimensions for common aspect ratios
from __future__ import annotations

from pptx.util import Inches

# width, height in inches (PowerPoint-friendly)
ASPECT_SIZES_INCHES: dict[str, tuple[float, float]] = {
    "16:9": (13.333, 7.5),
    "4:3": (10.0, 7.5),
    "1:1": (10.0, 10.0),
    "9:16": (7.5, 13.333),
    "3:4": (7.5, 10.0),
}

SUPPORTED_ASPECTS = frozenset(ASPECT_SIZES_INCHES)


def normalize_aspect_ratio(value: str | None, default: str = "16:9") -> str:
    raw = (value or "").strip()
    if raw in ASPECT_SIZES_INCHES:
        return raw
    return default if default in ASPECT_SIZES_INCHES else "16:9"


def slide_size_inches(aspect_ratio: str | None) -> tuple[float, float]:
    return ASPECT_SIZES_INCHES[normalize_aspect_ratio(aspect_ratio)]


def apply_slide_size(prs, aspect_ratio: str | None) -> tuple[int, int]:
    w_in, h_in = slide_size_inches(aspect_ratio)
    prs.slide_width = Inches(w_in)
    prs.slide_height = Inches(h_in)
    return int(prs.slide_width), int(prs.slide_height)
