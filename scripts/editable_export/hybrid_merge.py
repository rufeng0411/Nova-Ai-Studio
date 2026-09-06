"""Hybrid merge: MinerU layout + Baidu OCR fine boxes."""

from __future__ import annotations



from typing import Any





def _area(bbox: list[float]) -> float:

    return max(0.0, bbox[2] - bbox[0]) * max(0.0, bbox[3] - bbox[1])





def _intersection_ratio(inner: list[float], outer: list[float]) -> float:

    ix0 = max(inner[0], outer[0])

    iy0 = max(inner[1], outer[1])

    ix1 = min(inner[2], outer[2])

    iy1 = min(inner[3], outer[3])

    if ix1 <= ix0 or iy1 <= iy0:

        return 0.0

    inter = (ix1 - ix0) * (iy1 - iy0)

    inner_a = _area(inner)

    return inter / inner_a if inner_a > 0 else 0.0





def _is_contained(inner: list[float], outer: list[float], threshold: float = 0.8) -> bool:

    return _intersection_ratio(inner, outer) >= threshold





def _has_intersection(a: list[float], b: list[float], min_ratio: float = 0.1) -> bool:

    ix0 = max(a[0], b[0])

    iy0 = max(a[1], b[1])

    ix1 = min(a[2], b[2])

    iy1 = min(a[3], b[3])

    if ix1 <= ix0 or iy1 <= iy0:

        return False

    inter = (ix1 - ix0) * (iy1 - iy0)

    return inter / min(_area(a), _area(b) or 1.0) >= min_ratio if min(_area(a), _area(b)) > 0 else False





IMAGE_TYPES = {"image", "figure", "chart", "diagram"}

TABLE_TYPES = {"table", "table_cell"}





def merge_hybrid_elements(

    mineru_elements: list[dict[str, Any]],

    baidu_elements: list[dict[str, Any]],

    *,

    contain_threshold: float = 0.8,

    intersection_threshold: float = 0.3,

) -> list[dict[str, Any]]:

    """Kit-aligned merge: Baidu fine boxes replace intersecting MinerU text blocks."""

    mineru = [dict(e) for e in mineru_elements]

    baidu = [dict(e) for e in baidu_elements]



    filtered_baidu: list[dict[str, Any]] = []

    for b_el in baidu:

        bb = b_el.get("bbox") or [0, 0, 0, 0]

        inside_image = False

        for m_el in mineru:

            if str(m_el.get("type") or "").lower() in IMAGE_TYPES:

                mb = m_el.get("bbox") or [0, 0, 0, 0]

                if _is_contained(bb, mb, contain_threshold):

                    inside_image = True

                    break

        if not inside_image:

            filtered_baidu.append(b_el)



    image_els: list[dict[str, Any]] = []

    table_els: list[dict[str, Any]] = []

    other_els: list[dict[str, Any]] = []

    for m_el in mineru:

        m_type = str(m_el.get("type") or "text").lower()

        if m_type in IMAGE_TYPES:

            image_els.append(m_el)

        elif m_type in TABLE_TYPES:

            table_els.append(m_el)

        else:

            other_els.append(m_el)



    result: list[dict[str, Any]] = []

    used_baidu: set[int] = set()

    tables_remove: set[int] = set()

    other_remove: set[int] = set()



    result.extend(image_els)



    for ti, t_el in enumerate(table_els):

        tb = t_el.get("bbox") or [0, 0, 0, 0]

        has_text = False

        for idx, b_el in enumerate(filtered_baidu):

            bb = b_el.get("bbox") or [0, 0, 0, 0]

            if _is_contained(bb, tb, contain_threshold):

                if idx not in used_baidu:

                    result.append(b_el)

                    used_baidu.add(idx)

                has_text = True

        if has_text:

            tables_remove.add(ti)



    for ti, t_el in enumerate(table_els):

        if ti not in tables_remove:

            result.append(t_el)



    for oi, o_el in enumerate(other_els):

        ob = o_el.get("bbox") or [0, 0, 0, 0]

        matched = False

        for idx, b_el in enumerate(filtered_baidu):

            bb = b_el.get("bbox") or [0, 0, 0, 0]

            if not _has_intersection(ob, bb, intersection_threshold):

                continue

            matched = True

            if idx not in used_baidu:

                result.append(b_el)

                used_baidu.add(idx)

        if matched:

            other_remove.add(oi)



    for oi, o_el in enumerate(other_els):

        if oi not in other_remove and str(o_el.get("text") or "").strip():

            result.append(o_el)



    for idx, b_el in enumerate(filtered_baidu):

        if idx not in used_baidu and str(b_el.get("text") or "").strip():

            result.append(b_el)



    return result

