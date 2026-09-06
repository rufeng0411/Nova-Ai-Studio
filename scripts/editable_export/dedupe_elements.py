"""Remove overlapping duplicate text boxes after hybrid OCR merge."""
from __future__ import annotations

import re
import unicodedata
from typing import Any


def _area(bbox: list[float]) -> float:
    return max(0.0, bbox[2] - bbox[0]) * max(0.0, bbox[3] - bbox[1])


def _iou(a: list[float], b: list[float]) -> float:
    ix0 = max(a[0], b[0])
    iy0 = max(a[1], b[1])
    ix1 = min(a[2], b[2])
    iy1 = min(a[3], b[3])
    if ix1 <= ix0 or iy1 <= iy0:
        return 0.0
    inter = (ix1 - ix0) * (iy1 - iy0)
    union = _area(a) + _area(b) - inter
    return inter / union if union > 0 else 0.0


def _center_distance(a: list[float], b: list[float]) -> float:
    ax = (a[0] + a[2]) / 2
    ay = (a[1] + a[3]) / 2
    bx = (b[0] + b[2]) / 2
    by = (b[1] + b[3]) / 2
    return ((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5


def _norm_text(text: str) -> str:
    t = unicodedata.normalize("NFKC", text or "")
    t = re.sub(r"\s+", "", t)
    return t.lower()


def _text_similar(a: str, b: str) -> bool:
    na, nb = _norm_text(a), _norm_text(b)
    if not na or not nb:
        return False
    if na == nb:
        return True
    if len(na) >= 4 and len(nb) >= 4 and (na in nb or nb in na):
        return True
    # loose match for OCR punctuation drift
    if len(na) >= 6 and len(nb) >= 6:
        common = sum(1 for ca, cb in zip(na, nb) if ca == cb)
        return common / max(len(na), len(nb)) >= 0.92
    return False


def _score_element(el: dict[str, Any]) -> float:
  """Prefer Baidu fine boxes with per-char OCR, then smaller tighter boxes."""
  source = str(el.get("source") or "")
  bbox = el.get("bbox") or [0, 0, 0, 0]
  area = _area(bbox)
  score = 0.0
  if source == "baidu":
    score += 1000
  if el.get("chars"):
    score += 500
  score -= area * 0.01
  score += len(str(el.get("text") or "")) * 0.1
  return score


def dedupe_text_elements(
    elements: list[dict[str, Any]],
    *,
    iou_threshold: float = 0.45,
    center_ratio: float = 0.35,
) -> list[dict[str, Any]]:
    """Drop duplicate text layers that share position and similar content."""
    non_text = [e for e in elements if not str(e.get("text") or "").strip()]
    text_els = [e for e in elements if str(e.get("text") or "").strip()]

    ordered = sorted(text_els, key=_score_element, reverse=True)
    kept: list[dict[str, Any]] = []

    for el in ordered:
        bbox = el.get("bbox") or [0, 0, 0, 0]
        text = str(el.get("text") or "")
        if len(bbox) < 4:
            continue
        diag = max(((bbox[2] - bbox[0]) ** 2 + (bbox[3] - bbox[1]) ** 2) ** 0.5, 1.0)
        dup = False
        for other in kept:
            ob = other.get("bbox") or [0, 0, 0, 0]
            if len(ob) < 4:
                continue
            iou = _iou(bbox, ob)
            near = _center_distance(bbox, ob) <= diag * center_ratio
            if (iou >= iou_threshold or near) and _text_similar(text, str(other.get("text") or "")):
                dup = True
                break
        if not dup:
            kept.append(el)

    return non_text + kept
