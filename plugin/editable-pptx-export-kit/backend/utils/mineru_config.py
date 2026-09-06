"""
MinerU Token / API Base 统一解析：.env(Config) 与 settings 表对齐。

规则：
- 空字符串与 None 均视为「未配置」
- DB 有非空值时优先；否则回退 Config/.env
- 可选将 .env 有效 Token 回填 DB（仅当 DB 为空时）
"""
from __future__ import annotations

import base64
import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional, Tuple

logger = logging.getLogger(__name__)

DEFAULT_MINERU_API_BASE = "https://mineru.net"


def strip_or_none(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    s = str(value).strip()
    return s or None


def effective_mineru_token(
    db_token: Optional[str] = None,
    config_token: Optional[str] = None,
) -> str:
    """解析当前应使用的 MinerU Token（DB 非空优先，否则 Config/.env）。"""
    return strip_or_none(db_token) or strip_or_none(config_token) or ""


def effective_mineru_api_base(
    db_base: Optional[str] = None,
    config_base: Optional[str] = None,
) -> str:
    return (
        strip_or_none(db_base)
        or strip_or_none(config_base)
        or DEFAULT_MINERU_API_BASE
    )


def decode_jwt_payload(token: str) -> Optional[dict[str, Any]]:
    """无签名校验地解析 JWT payload（仅用于 exp 诊断）。"""
    token = strip_or_none(token) or ""
    parts = token.split(".")
    if len(parts) < 2:
        return None
    payload_b64 = parts[1]
    padding = "=" * (-len(payload_b64) % 4)
    try:
        raw = base64.urlsafe_b64decode(payload_b64 + padding)
        return json.loads(raw.decode("utf-8"))
    except Exception:
        return None


def mineru_token_expiry_utc(token: str) -> Optional[datetime]:
    payload = decode_jwt_payload(token)
    if not payload:
        return None
    exp = payload.get("exp")
    if not isinstance(exp, (int, float)):
        return None
    return datetime.fromtimestamp(exp, tz=timezone.utc)


def is_mineru_token_expired(token: str, *, now: Optional[datetime] = None) -> bool:
    exp = mineru_token_expiry_utc(token)
    if exp is None:
        return False
    now = now or datetime.now(timezone.utc)
    return now >= exp


def probe_mineru_token(
    token: str,
    api_base: Optional[str] = None,
    *,
    timeout: float = 15.0,
) -> Tuple[bool, str]:
    """
    探测 MinerU Token 是否可用（调用 batch 上传地址接口）。

    Returns:
        (ok, message)
    """
    token = strip_or_none(token) or ""
    if not token:
        return False, "未配置 MINERU_TOKEN"

    exp = mineru_token_expiry_utc(token)
    if exp is not None and datetime.now(timezone.utc) >= exp:
        return False, f"Token 已过期（exp={exp.isoformat()}）"

    base = (api_base or DEFAULT_MINERU_API_BASE).rstrip("/")
    url = f"{base}/api/v4/file-urls/batch"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }
    body = {"files": [{"name": "diagnostic.pdf"}], "model_version": "vlm"}

    try:
        import requests
    except ImportError:
        return False, "缺少 requests 依赖"

    try:
        r = requests.post(url, headers=headers, json=body, timeout=timeout)
    except Exception as e:
        return False, f"网络请求失败: {e}"

    try:
        data = r.json()
    except Exception:
        data = {}

    if r.status_code == 401:
        return False, "Token 无效或已过期（401 user authenticate failed）"
    if r.status_code == 403:
        return False, "无权限（403）"
    if r.status_code != 200 or data.get("code") != 0:
        msg = data.get("msg") or data.get("message") or r.text[:200]
        return False, f"MinerU API 错误 HTTP {r.status_code}: {msg}"

    batch_id = (data.get("data") or {}).get("batch_id")
    if not batch_id:
        return False, "响应无 batch_id"
    return True, "MinerU Token 有效"


def apply_mineru_config_to_app(
    app_config: dict,
    *,
    db_token: Optional[str],
    db_api_base: Optional[str],
    config_token: Optional[str],
    config_api_base: Optional[str],
) -> str:
    """写入 app.config 并返回最终 Token。"""
    token = effective_mineru_token(db_token, config_token)
    api_base = effective_mineru_api_base(db_api_base, config_api_base)
    app_config["MINERU_TOKEN"] = token
    app_config["MINERU_API_BASE"] = api_base
    return token


def maybe_sync_mineru_token_to_settings(settings_row, config_token: Optional[str]) -> bool:
    """
    DB 中 mineru_token 为空且 .env 有值时，回填 settings 表（对齐管理端展示）。
    Returns True if persisted.
    """
    from models import db

    db_val = strip_or_none(getattr(settings_row, "mineru_token", None))
    env_val = strip_or_none(config_token)
    if db_val or not env_val:
        return False
    settings_row.mineru_token = env_val
    try:
        db.session.commit()
        logger.info("已将 .env 中的 MINERU_TOKEN 同步写入 settings 表（DB 原为空）")
        return True
    except Exception as e:
        db.session.rollback()
        logger.warning("MINERU_TOKEN 回填 settings 失败: %s", e)
        return False


def log_mineru_token_status(token: str) -> None:
    """启动时记录 Token 长度与 JWT 过期时间（不打印完整 Token）。"""
    if not token:
        logger.info("MINERU_TOKEN 未配置，MinerU 解析/可编辑导出将依赖百度 OCR 降级或 MarkItDown")
        return
    exp = mineru_token_expiry_utc(token)
    if exp is None:
        logger.info("MINERU_TOKEN 已加载（长度=%s）", len(token))
        return
    now = datetime.now(timezone.utc)
    if now >= exp:
        logger.warning(
            "MINERU_TOKEN 已过期（exp=%s），MinerU API 将 401；混合提取仍可用百度 OCR 降级",
            exp.isoformat(),
        )
    else:
        logger.info("MINERU_TOKEN 已加载（长度=%s，exp=%s）", len(token), exp.isoformat())
