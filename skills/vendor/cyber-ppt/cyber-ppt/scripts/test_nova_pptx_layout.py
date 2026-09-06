#!/usr/bin/env python3
"""Unit tests for nova_pptx_layout canvas clamping."""
from __future__ import annotations

import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from nova_pptx_layout import SLIDE_H_IN, SLIDE_W_IN, clamp_box_in, frac_rect, grid_cells


def test_clamp_stays_inside():
    x, y, w, h = clamp_box_in(12.0, 6.0, 5.0, 3.0)
    assert x + w <= SLIDE_W_IN + 1e-6
    assert y + h <= SLIDE_H_IN + 1e-6
    assert x >= 0 and y >= 0


def test_frac_rect_inset_inside_margins():
    x, y, w, h = frac_rect(0, 0, 1, 1, inset=True)
    assert x >= 0
    assert y >= 0
    assert x + w <= SLIDE_W_IN + 1e-6
    assert y + h <= SLIDE_H_IN + 1e-6


def test_grid_cells_fractions_sum():
    cells = grid_cells(2, 2, x0=0.1, y0=0.2, w=0.8, h=0.6)
    assert len(cells) == 4
    for fx, fy, fw, fh in cells:
        assert fx + fw <= 0.1 + 0.8 + 1e-6
        assert fy + fh <= 0.2 + 0.6 + 1e-6


def main() -> int:
    test_clamp_stays_inside()
    test_frac_rect_inset_inside_margins()
    test_grid_cells_fractions_sum()
    print("nova_pptx_layout tests: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
