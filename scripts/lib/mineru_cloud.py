"""MinerU cloud API client (batch upload + poll)."""
from __future__ import annotations

import json
import os
import time
import zipfile
from io import BytesIO
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests


class MinerUCloudError(RuntimeError):
    pass


def _headers(token: str) -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }


def _api_root(api_url: str) -> str:
    return api_url.rstrip("/")


def _request_with_retry(method: str, url: str, **kwargs: Any) -> requests.Response:
    last_exc: Exception | None = None
    for attempt in range(6):
        try:
            if method == "get":
                resp = requests.get(url, **kwargs)
            elif method == "post":
                resp = requests.post(url, **kwargs)
            elif method == "put":
                resp = requests.put(url, **kwargs)
            else:
                raise ValueError(f"unsupported method {method}")
            resp.raise_for_status()
            return resp
        except (requests.exceptions.SSLError, requests.exceptions.ConnectionError) as exc:
            last_exc = exc
            time.sleep(min(2 ** attempt, 20))
        except requests.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else 0
            if status in (429, 500, 502, 503, 504) and attempt < 5:
                last_exc = exc
                time.sleep(min(2 ** attempt, 20))
                continue
            raise MinerUCloudError(str(exc)) from exc
    raise MinerUCloudError(str(last_exc or "MinerU request failed"))


def parse_file(file_path: str, token: str, api_url: str, *, timeout_sec: int = 600) -> dict[str, Any]:
    root = _api_root(api_url)
    file_name = os.path.basename(file_path)
    data = {
        "files": [{"name": file_name, "data_id": Path(file_path).stem[:120]}],
        "model_version": "vlm",
        "language": "ch",
    }
    resp = _request_with_retry("post", f"{root}/file-urls/batch", headers=_headers(token), json=data, timeout=60)
    payload = resp.json()
    if payload.get("code") != 0:
        raise MinerUCloudError(payload.get("msg") or "MinerU batch upload URL request failed")
    batch_id = payload["data"]["batch_id"]
    upload_urls = payload["data"]["file_urls"]
    with open(file_path, "rb") as handle:
        put = _request_with_retry("put", upload_urls[0], data=handle, timeout=300)
    if put.status_code not in (200, 201):
        raise MinerUCloudError(f"MinerU file upload failed with status {put.status_code}")

    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        poll = _request_with_retry(
            "get",
            f"{root}/extract-results/batch/{batch_id}",
            headers=_headers(token),
            timeout=60,
        )
        body = poll.json()
        if body.get("code") != 0:
            raise MinerUCloudError(body.get("msg") or "MinerU batch poll failed")
        results = body.get("data", {}).get("extract_result") or []
        if not results:
            time.sleep(2)
            continue
        item = results[0]
        state = item.get("state")
        if state == "failed":
            raise MinerUCloudError(item.get("err_msg") or "MinerU parse failed")
        if state != "done":
            time.sleep(2)
            continue
        zip_url = item.get("full_zip_url")
        if not zip_url:
            raise MinerUCloudError("MinerU result missing full_zip_url")
        return {"full_zip_url": zip_url, "batch_id": batch_id}

    raise MinerUCloudError("MinerU parse timed out")


def parse_file_local(file_path: str, api_url: str, *, timeout_sec: int = 600) -> dict[str, Any]:
    root = _api_root(api_url)
    with open(file_path, "rb") as handle:
        resp = requests.post(
            f"{root}/file_parse",
            files={"files": (os.path.basename(file_path), handle)},
            data={"return_md": "false"},
            timeout=timeout_sec,
        )
    resp.raise_for_status()
    payload = resp.json()
    if isinstance(payload, dict) and payload.get("error"):
        raise MinerUCloudError(str(payload.get("error")))
    return payload if isinstance(payload, dict) else {"raw": payload}


def download_zip_bundle(zip_url: str, extract_dir: str) -> Path:
    """Download MinerU zip and extract all files; return extract directory."""
    resp = _request_with_retry("get", zip_url, timeout=300)
    root = Path(extract_dir)
    root.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(BytesIO(resp.content)) as archive:
        archive.extractall(root)
    return root


def find_layout_json(extract_dir: Path) -> Path | None:
    for path in extract_dir.rglob("layout.json"):
        return path
    return None


def find_content_list_json(extract_dir: Path) -> Path | None:
    for path in extract_dir.rglob("*_content_list.json"):
        return path
    for path in extract_dir.rglob("content_list.json"):
        return path
    return None


def download_zip_json(zip_url: str) -> dict[str, Any] | list[Any]:
    resp = _request_with_retry("get", zip_url, timeout=300)
    with zipfile.ZipFile(BytesIO(resp.content)) as archive:
        names = archive.namelist()
        for candidate in names:
            lower = candidate.lower()
            if lower.endswith("middle.json") or lower.endswith("content_list.json") or lower.endswith("_model.json"):
                with archive.open(candidate) as handle:
                    return json.loads(handle.read().decode("utf-8"))
        for candidate in names:
            if candidate.lower().endswith(".json"):
                with archive.open(candidate) as handle:
                    return json.loads(handle.read().decode("utf-8"))
    raise MinerUCloudError("MinerU zip did not contain JSON output")


def extract_text_blocks(payload: dict[str, Any]) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    for key in ("pdf_info", "content_list", "pages", "data"):
        value = payload.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
    return []


def run_mineru(file_path: str, token: str, api_url: str, mode: str) -> dict[str, Any] | list[Any]:
    if mode == "local":
        return parse_file_local(file_path, api_url)
    if not token:
        raise MinerUCloudError("MinerU token is required for cloud mode")
    result = parse_file(file_path, token, api_url)
    if isinstance(result, dict) and result.get("full_zip_url"):
        return download_zip_json(str(result["full_zip_url"]))
    return result


def run_mineru_extract_dir(file_path: str, token: str, api_url: str, mode: str, extract_dir: str) -> Path:
    """Run MinerU and extract full zip to ``extract_dir`` (for layout.json pipeline)."""
    if mode == "local":
        payload = parse_file_local(file_path, api_url)
        root = Path(extract_dir)
        root.mkdir(parents=True, exist_ok=True)
        (root / "content_list.json").write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        return root
    if not token:
        raise MinerUCloudError("MinerU token is required for cloud mode")
    result = parse_file(file_path, token, api_url)
    if isinstance(result, dict) and result.get("full_zip_url"):
        return download_zip_bundle(str(result["full_zip_url"]), extract_dir)
    root = Path(extract_dir)
    root.mkdir(parents=True, exist_ok=True)
    (root / "content_list.json").write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    return root
