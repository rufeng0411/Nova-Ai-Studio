"""Baidu image inpainting for text removal on slide backgrounds."""
from __future__ import annotations

import base64
import io
import json
import logging
import os
from typing import Any

import requests
from PIL import Image

from baidu_token import get_baidu_access_token

logger = logging.getLogger(__name__)


def _pil_fallback(image: Image.Image, bboxes: list[dict[str, float]]) -> Image.Image:
    import sys
    from pathlib import Path

    lib = Path(__file__).resolve().parent.parent / "lib"
    if str(lib) not in sys.path:
        sys.path.insert(0, str(lib))
    from slide_layer_inpaint import remove_text_from_image  # noqa: WPS433

    bbox_lists = [
        [box.get("x0", 0), box.get("y0", 0), box.get("x1", 0), box.get("y1", 0)]
        for box in bboxes
    ]
    return remove_text_from_image(image, bbox_lists, image.width, image.height)


def inpaint_slide(
    image: Image.Image,
    bboxes: list[dict[str, float]],
    *,
    method: str | None = None,
) -> Image.Image:
    """Remove text regions; ``method`` is ``baidu`` or ``pil_fallback``."""
    inpaint_method = (method or os.environ.get("PILOTDECK_INPAINT_METHOD") or "baidu").strip().lower()
    if inpaint_method != "baidu":
        return _pil_fallback(image, bboxes)

    buf = io.BytesIO()
    image.convert("RGB").save(buf, format="JPEG", quality=92)
    img_b64 = base64.b64encode(buf.getvalue()).decode("ascii")

    rectangles: list[dict[str, int]] = []
    w, h = image.size
    for box in bboxes:
        x0 = max(0, int(box.get("x0", box.get("left", 0))))
        y0 = max(0, int(box.get("y0", box.get("top", 0))))
        x1 = min(w, int(box.get("x1", box.get("right", x0 + box.get("width", 0)))))
        y1 = min(h, int(box.get("y1", box.get("bottom", y0 + box.get("height", 0)))))
        if x1 <= x0 or y1 <= y0:
            continue
        rectangles.append({"left": x0, "top": y0, "width": x1 - x0, "height": y1 - y0})

    if not rectangles:
        return image.copy()

    api_key = (os.environ.get("BAIDU_API_KEY") or "").strip()
    headers: dict[str, str] = {"Content-Type": "application/x-www-form-urlencoded"}
    if api_key.startswith("bce-v3/"):
        url = "https://aip.baidubce.com/rest/2.0/image-process/v1/inpaint"
        headers["Authorization"] = f"Bearer {api_key}"
    else:
        token = get_baidu_access_token()
        if not token:
            logger.warning("Baidu inpaint: no token, falling back to PIL blur")
            return _pil_fallback(image, bboxes)
        url = f"https://aip.baidubce.com/rest/2.0/image-process/v1/inpaint?access_token={token}"
    try:
        resp = requests.post(
            url,
            data={
                "image": img_b64,
                "rectangle": json.dumps(rectangles, ensure_ascii=False),
            },
            headers=headers,
            timeout=120,
        )
        resp.raise_for_status()
        body: dict[str, Any] = resp.json()
        if body.get("error_code"):
            raise RuntimeError(f"Baidu inpaint error {body.get('error_code')}: {body.get('error_msg')}")
        out_b64 = body.get("image")
        if not out_b64:
            raise RuntimeError("Baidu inpaint returned no image")
        out_bytes = base64.b64decode(out_b64)
        return Image.open(io.BytesIO(out_bytes)).convert("RGB")
    except Exception as exc:
        logger.warning("Baidu inpaint failed (%s), using PIL fallback", exc)
        return _pil_fallback(image, bboxes)
