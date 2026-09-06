"""Cache MinerU JSON payloads to skip repeat cloud parses."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any


def _cache_dir(workspace_root: str | None) -> Path:
    root = Path(workspace_root or os.getcwd())
    return root / "artifacts" / ".export-cache" / "mineru"


def cache_key_for_files(paths: list[str], *, extra: str = "") -> str:
    digest = hashlib.sha256()
    if extra:
        digest.update(extra.encode("utf-8"))
    for path in sorted(paths):
        abs_path = os.path.abspath(path)
        stat = os.stat(abs_path)
        digest.update(abs_path.encode("utf-8"))
        digest.update(str(stat.st_mtime_ns).encode("ascii"))
        digest.update(str(stat.st_size).encode("ascii"))
    return digest.hexdigest()[:40]


def load_cached_mineru(key: str, workspace_root: str | None = None) -> dict[str, Any] | list[Any] | None:
    path = _cache_dir(workspace_root) / f"{key}.json"
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def save_cached_mineru(
    key: str,
    payload: dict[str, Any] | list[Any],
    workspace_root: str | None = None,
) -> None:
    folder = _cache_dir(workspace_root)
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{key}.json"
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
