#!/usr/bin/env bash
# PD-SAAS-FORK: 从发布包 ssl/ 或 INSTALL_ROOT/ssl 安装证书并配置 Nginx HTTPS
#
#   sudo bash install-ssl-https.sh
#   sudo bash install-ssl-https.sh --src /opt/nova-ai-studio/ssl
set -euo pipefail

INSTALL_ROOT="${INSTALL_ROOT:-/opt/nova-ai-studio}"
ENV_FILE="${ENV_FILE:-$INSTALL_ROOT/.env}"
SSL_SRC=""
NONINTERACTIVE=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --src) SSL_SRC="$2"; shift 2 ;;
    --yes) NONINTERACTIVE=1; shift ;;
    --help|-h)
      sed -n '2,6p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "[install-ssl] 未知参数: $1"; exit 1 ;;
  esac
done

if [[ "$(id -u)" -ne 0 ]]; then
  echo "[install-ssl] 请使用 sudo 运行"; exit 1
fi

if [[ -z "$SSL_SRC" ]]; then
  for candidate in \
    "$INSTALL_ROOT/ssl" \
    "$INSTALL_ROOT/tmp/ssl" \
    "$INSTALL_ROOT/current/ssl"; do
    if [[ -d "$candidate" ]]; then
      SSL_SRC="$candidate"
      break
    fi
  done
fi

if [[ -z "$SSL_SRC" || ! -d "$SSL_SRC" ]]; then
  echo "[install-ssl] 未找到 ssl 目录（跳过 HTTPS 安装）"
  exit 0
fi

find_cert() {
  local dir="$1"
  for f in fullchain.pem www.novapage.online.pem cert.pem; do
    [[ -f "$dir/$f" ]] && { echo "$dir/$f"; return 0; }
  done
  for f in "$dir"/*.pem; do
    [[ -f "$f" ]] && { echo "$f"; return 0; }
  done
  return 1
}

find_key() {
  local dir="$1"
  for f in privkey.key www.novapage.online.key key.pem privkey.pem; do
    [[ -f "$dir/$f" ]] && { echo "$dir/$f"; return 0; }
  done
  for f in "$dir"/*.key; do
    [[ -f "$f" ]] && { echo "$f"; return 0; }
  done
  return 1
}

CERT_SRC="$(find_cert "$SSL_SRC" || true)"
KEY_SRC="$(find_key "$SSL_SRC" || true)"

if [[ -z "$CERT_SRC" || -z "$KEY_SRC" ]]; then
  echo "[install-ssl] ssl 目录缺少 pem/key: $SSL_SRC" >&2
  exit 1
fi

CERT_DIR="/etc/nginx/ssl/novapage"
mkdir -p "$CERT_DIR"
cp -f "$CERT_SRC" "$CERT_DIR/fullchain.pem"
cp -f "$KEY_SRC" "$CERT_DIR/privkey.key"
chmod 644 "$CERT_DIR/fullchain.pem"
chmod 600 "$CERT_DIR/privkey.key"

# 持久化到 INSTALL_ROOT/ssl（升级包解压后 tmp 会删）
mkdir -p "$INSTALL_ROOT/ssl"
cp -f "$CERT_DIR/fullchain.pem" "$INSTALL_ROOT/ssl/fullchain.pem"
cp -f "$CERT_DIR/privkey.key" "$INSTALL_ROOT/ssl/privkey.key"
chmod 600 "$INSTALL_ROOT/ssl/privkey.key"

DOMAIN=""
APEX=""
if [[ -f "$ENV_FILE" ]]; then
  DOMAIN="$(grep -E '^DEPLOY_DOMAIN=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '\r' || true)"
fi
DOMAIN="${DOMAIN:-www.novapage.online}"
if [[ "$DOMAIN" == www.* ]]; then
  APEX="${DOMAIN#www.}"
fi

SETUP="$INSTALL_ROOT/setup-https-aliyun.sh"
if [[ ! -f "$SETUP" && -f "$INSTALL_ROOT/tmp/setup-https-aliyun.sh" ]]; then
  cp -f "$INSTALL_ROOT/tmp/setup-https-aliyun.sh" "$SETUP"
  chmod +x "$SETUP"
fi
if [[ ! -f "$SETUP" ]]; then
  echo "[install-ssl] 缺少 setup-https-aliyun.sh，仅已复制证书到 $CERT_DIR" >&2
  exit 1
fi

APEX_ARGS=()
[[ -n "$APEX" ]] && APEX_ARGS=(--apex "$APEX")

echo "[install-ssl] 配置 HTTPS: $DOMAIN"
bash "$SETUP" \
  --domain "$DOMAIN" \
  "${APEX_ARGS[@]}" \
  --cert "$CERT_DIR/fullchain.pem" \
  --key "$CERT_DIR/privkey.key" \
  --yes

if ss -tlnp 2>/dev/null | grep -q ':443 '; then
  echo "[install-ssl] ✅ Nginx 已监听 443"
else
  echo "[install-ssl] ⚠️ 未检测到 443 — 请检查安全组与 nginx -t" >&2
  exit 1
fi

echo "[install-ssl] 完成。后续 upgrade.sh 将读取 $INSTALL_ROOT/https-aliyun.env 保留 HTTPS。"
