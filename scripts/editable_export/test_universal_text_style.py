"""Unit tests for universal ink color + font hints."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from universal_text_style import (  # noqa: E402
    build_typography_context,
    extract_ink_color,
    extract_universal_text_style,
    guess_font_name,
    synthesize_char_bboxes,
)


def _delta(rgb1: tuple[int, int, int], rgb2: tuple[int, int, int]) -> float:
    return sum((a - b) ** 2 for a, b in zip(rgb1, rgb2)) ** 0.5


def test_dark_on_white():
    img = Image.new("RGB", (400, 120), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((20, 30), "Hello World", fill=(30, 30, 30))
    bbox = [15, 20, 280, 90]
    rgb = extract_ink_color(img, bbox)
    assert _delta(rgb, (30, 30, 30)) < 40, rgb


def test_white_on_dark():
    img = Image.new("RGB", (400, 120), (25, 30, 45))
    draw = ImageDraw.Draw(img)
    draw.text((20, 30), "Bullet point text", fill=(245, 245, 245))
    bbox = [15, 20, 350, 90]
    rgb = extract_ink_color(img, bbox)
    assert _delta(rgb, (245, 245, 245)) < 45, rgb


def test_brown_on_cream_traditional_font():
    img = Image.new("RGB", (500, 140), (245, 238, 220))
    draw = ImageDraw.Draw(img)
    draw.text((30, 40), "国风标题", fill=(55, 42, 30))
    bbox = [25, 30, 220, 110]
    ctx = build_typography_context(img, [{"bbox": bbox, "text": "国风标题"}])
    assert ctx.cream_traditional
    font = guess_font_name("国风标题", "title", ctx)
    assert font == "KaiTi"
    style = extract_universal_text_style(img, bbox, "国风标题", typography=ctx)
    assert _delta(style.font_color_rgb, (55, 42, 30)) < 80


def test_char_boxes_improve_color():
    img = Image.new("RGB", (300, 80), (200, 180, 120))
    draw = ImageDraw.Draw(img)
    # Simulate two chars with dark ink on gold card
    draw.rectangle((30, 20, 55, 60), fill=(40, 35, 25))
    draw.rectangle((60, 20, 85, 60), fill=(40, 35, 25))
    bbox = [25, 15, 90, 65]
    chars = [
        {"bbox": [30, 20, 55, 60]},
        {"bbox": [60, 20, 85, 60]},
    ]
    rgb = extract_ink_color(img, bbox, char_bboxes=[[30, 20, 55, 60], [60, 20, 85, 60]])
    assert _delta(rgb, (40, 35, 25)) < 35, rgb


def test_synthetic_char_boxes_on_line():
    img = Image.new("RGB", (320, 80), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((24, 18), "ABCDE", fill=(20, 20, 20))
    bbox = [20, 12, 220, 62]
    rgb = extract_ink_color(img, bbox, char_bboxes=synthesize_char_bboxes("ABCDE", bbox))
    assert _delta(rgb, (20, 20, 20)) < 45, rgb


def test_accent_on_dark_panel():
    img = Image.new("RGB", (200, 80), (30, 35, 50))
    draw = ImageDraw.Draw(img)
    draw.text((20, 22), "优势", fill=(102, 187, 106))
    bbox = [15, 15, 90, 65]
    rgb = extract_ink_color(img, bbox, char_bboxes=synthesize_char_bboxes("优势", bbox))
    assert rgb[1] > rgb[0] and rgb[1] > rgb[2], rgb


if __name__ == "__main__":
    test_dark_on_white()
    test_white_on_dark()
    test_brown_on_cream_traditional_font()
    test_char_boxes_improve_color()
    test_synthetic_char_boxes_on_line()
    test_accent_on_dark_panel()
    print("OK universal_text_style tests passed")
