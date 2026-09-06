"""PPT/PDF 导出文件名：优先项目主题或首页标题，保留中文，避免 presentation_{uuid} 临时名。"""
from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable, Optional, Tuple

from urllib.parse import quote
from werkzeug.utils import secure_filename

_DEFAULT_STEM = "未命名演示"


def _sanitize_export_stem(raw: str, fallback_id: str = "") -> str:
    raw = (raw or "").strip()
    ascii_name = secure_filename(raw)
    if ascii_name and len(ascii_name) >= 2:
        stem = ascii_name[:80]
    elif raw:
        stem = re.sub(r'[\x00-\x1f<>:"/\\|?*]', "", raw).strip()[:80]
    else:
        stem = ""
    if not stem:
        fid = (fallback_id or "export").replace("/", "_")[:8]
        stem = f"presentation_{fid}" if fid else _DEFAULT_STEM
    low = stem.lower()
    for suf in (".pptx", ".pdf", ".zip", ".png", ".jpg", ".jpeg"):
        if low.endswith(suf):
            stem = stem[: -len(suf)]
            break
    return stem or _DEFAULT_STEM


def _page_outline_title(page: Any) -> str:
    if page is None:
        return ""
    oc = getattr(page, "outline_content", None)
    if not oc:
        getter = getattr(page, "get_outline_content", None)
        if callable(getter):
            try:
                oc = getter()
            except Exception:
                oc = None
    if isinstance(oc, str):
        try:
            oc = json.loads(oc)
        except Exception:
            return oc.strip()[:80]
    if isinstance(oc, dict):
        return (oc.get("title") or "").strip()[:80]
    return ""


def resolve_project_export_stem(
    project: Any,
    *,
    pages: Optional[Iterable[Any]] = None,
    fallback_id: str = "",
) -> str:
    """解析导出文件主名（无扩展名）：优先第一页大纲标题，再 idea_prompt。"""
    page_list = list(pages) if pages is not None else []
    if not page_list and project is not None:
        rel = getattr(project, "pages", None)
        if rel is not None:
            try:
                page_list = list(rel)
            except Exception:
                page_list = []

    if page_list:
        page_list = sorted(page_list, key=lambda p: getattr(p, "order_index", 0) or 0)
        for page in page_list:
            title = _page_outline_title(page)
            if title:
                return _sanitize_export_stem(title, fallback_id)

    idea = (getattr(project, "idea_prompt", None) or "").strip()
    if idea:
        first_line = idea.splitlines()[0].strip()
        if first_line:
            return _sanitize_export_stem(first_line[:120], fallback_id)

    return _sanitize_export_stem("", fallback_id)


def is_default_export_filename(name: Optional[str], project_id: str = "") -> bool:
    n = (name or "").strip().lower()
    if not n:
        return True
    pid = (project_id or "").strip().lower()
    if pid and n in (f"presentation_{pid}.pptx", f"presentation_{pid}.pdf"):
        return True
    if n.startswith("presentation_") and (not pid or pid in n):
        return True
    return False


def build_project_export_filename(
    project: Any,
    ext: str,
    *,
    explicit: Optional[str] = None,
    fallback_id: str = "",
    pages: Optional[Iterable[Any]] = None,
) -> str:
    ext = ext if ext.startswith(".") else f".{ext}"
    explicit = (explicit or "").strip()
    if explicit and not is_default_export_filename(explicit, fallback_id):
        stem = _sanitize_export_stem(explicit, fallback_id)
        return f"{stem}{ext}"

    stem = resolve_project_export_stem(project, pages=pages, fallback_id=fallback_id)
    return f"{stem}{ext}"


def build_export_download_path(project_id: str, filename: str) -> str:
    """构建带 URL 编码文件名的下载路径（支持中文）。"""
    pid = (project_id or "").strip()
    name = (filename or "").strip()
    return f"/files/{pid}/exports/{quote(name, safe='.')}"


def resolve_project_export_display_name(
    project: Any,
    *,
    pages: Optional[Iterable[Any]] = None,
    fallback_id: str = "",
) -> str:
    return resolve_project_export_stem(project, pages=pages, fallback_id=fallback_id)


_GENERIC_CONTRACT_TITLES = frozenset(
    {"未命名合同", "上传文档", "合同", "合同文书", "contract", "upload"}
)


def _stem_from_original_filename(name: str) -> str:
    name = (name or "").strip()
    if not name:
        return ""
    p = Path(name)
    raw = p.stem if p.suffix else name
    return _sanitize_export_stem(raw)


def resolve_contract_export_stem(doc: Any, *, fallback_id: str = "") -> str:
    """合同导出主文件名（无扩展名）：优先 snapshot.original_filename，再 title/模板名。"""
    doc_id = (getattr(doc, "id", None) or fallback_id or "").strip()
    snap: dict = {}
    if hasattr(doc, "template_snapshot"):
        try:
            raw = doc.template_snapshot()
            snap = raw if isinstance(raw, dict) else {}
        except Exception:
            snap = {}

    original = (snap.get("original_filename") or "").strip()
    if original:
        stem = _stem_from_original_filename(original)
        if stem:
            return stem

    title = (getattr(doc, "title", None) or "").strip()
    if title and title.lower() not in _GENERIC_CONTRACT_TITLES:
        return _sanitize_export_stem(title, doc_id)

    snap_name = (snap.get("name") or "").strip()
    if snap_name and snap_name.lower() not in _GENERIC_CONTRACT_TITLES:
        return _sanitize_export_stem(snap_name, doc_id)

    if title:
        return _sanitize_export_stem(title, doc_id)
    return _sanitize_export_stem(snap_name or "合同文书", doc_id)


def build_contract_export_filename(doc: Any, ext: str, *, fallback_id: str = "") -> str:
    ext_norm = ext if str(ext).startswith(".") else f".{ext}"
    stem = resolve_contract_export_stem(doc, fallback_id=fallback_id)
    return f"{stem}{ext_norm.lower()}"


def allocate_unique_export_path(exports_dir: str | Path, filename: str) -> Tuple[str, str]:
    """若目标已存在，追加 UTC 时间戳后缀，返回 (最终文件名, 绝对路径)。"""
    exports_dir = Path(exports_dir)
    exports_dir.mkdir(parents=True, exist_ok=True)
    filename = (filename or "").strip()
    output_path = exports_dir / filename
    if not output_path.exists():
        return filename, str(output_path)
    if "." in filename:
        base, ext = filename.rsplit(".", 1)
        ext = f".{ext}"
    else:
        base, ext = filename, ""
    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    final = f"{base}_{stamp}{ext}"
    return final, str(exports_dir / final)
