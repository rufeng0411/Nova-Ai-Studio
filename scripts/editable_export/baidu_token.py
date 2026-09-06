"""Baidu AI Cloud OAuth token helper (API Key + Secret Key)."""
from __future__ import annotations

import os
import time
from typing import Optional

import requests

_token_cache: dict[str, tuple[str, float]] = {}


def get_baidu_access_token(
    api_key: Optional[str] = None,
    secret_key: Optional[str] = None,
) -> Optional[str]:
    key = (api_key or os.environ.get("BAIDU_API_KEY") or "").strip()
    if key.startswith("bce-v3/"):
        return key
    secret = (secret_key or os.environ.get("BAIDU_SECRET_KEY") or "").strip()
    if not key or not secret:
        return None
    cache_key = f"{key[:8]}:{secret[:8]}"
    cached = _token_cache.get(cache_key)
    if cached and cached[1] > time.time():
        return cached[0]
    resp = requests.get(
        "https://aip.baidubce.com/oauth/2.0/token",
        params={
            "grant_type": "client_credentials",
            "client_id": key,
            "client_secret": secret,
        },
        timeout=30,
    )
    resp.raise_for_status()
    body = resp.json()
    token = body.get("access_token")
    if not token:
        return None
    expires = time.time() + float(body.get("expires_in", 2592000)) - 300
    _token_cache[cache_key] = (token, expires)
    return token
