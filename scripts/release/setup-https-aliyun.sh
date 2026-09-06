#!/usr/bin/env bash
# Nova Ai-Studio：使用阿里云 SSL 证书（Nginx pem/key）配置 HTTPS
#
# 用法:
#   sudo bash setup-https-aliyun.sh \
#     --domain www.novapage.online \
#     --cert /etc/nginx/ssl/novapage/fullchain.pem \
#     --key /etc/nginx/ssl/novapage/privkey.key \
#     --yes
#
# 证书在阿里云控制台下载后，通常有 *.pem（证书）和 *.key（私钥）。
# 若还有 chain.pem，请先合并: cat cert.pem chain.pem > fullchain.pem
set -euo pipefail

INSTALL_ROOT="${INSTALL_ROOT:-/opt/nova-ai-studio}"
ENV_FILE="${ENV_FILE:-$INSTALL_ROOT/.env}"
DOMAIN=""
APEX=""
CERT_PATH=""
KEY_PATH=""
NONINTERACTIVE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --apex) APEX="$2"; shift 2 ;;
    --cert) CERT_PATH="$2"; shift 2 ;;
    --key) KEY_PATH="$2"; shift 2 ;;
    --yes) NONINTERACTIVE=1; shift ;;
    --help|-h)
      sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "未知参数: $1"; exit 1 ;;
  esac
done

if [[ "$(id -u)" -ne 0 ]]; then
  echo "[https-aliyun] 请使用 sudo 运行"; exit 1
fi

if [[ -z "$DOMAIN" && -f "$ENV_FILE" ]]; then
  DOMAIN="$(grep -E '^DEPLOY_DOMAIN=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '\r' || true)"
fi

if [[ -z "$DOMAIN" || "$DOMAIN" == "_" ]]; then
  echo "[https-aliyun] 请指定 --domain www.example.com"; exit 1
fi

if [[ -z "$CERT_PATH" || -z "$KEY_PATH" ]]; then
  DEFAULT_CERT_DIR="/etc/nginx/ssl/novapage"
  if [[ -f "$INSTALL_ROOT/https-aliyun.env" ]]; then
    # shellcheck disable=SC1090
    source "$INSTALL_ROOT/https-aliyun.env"
    CERT_PATH="${CERT_PATH:-${SSL_CERT:-}}"
    KEY_PATH="${KEY_PATH:-${SSL_KEY:-}}"
  fi
  if [[ -z "$CERT_PATH" ]]; then
    for c in "$DEFAULT_CERT_DIR/fullchain.pem" "$DEFAULT_CERT_DIR/cert.pem"; do
      [[ -f "$c" ]] && CERT_PATH="$c" && break
    done
  fi
  if [[ -z "$KEY_PATH" ]]; then
    for k in "$DEFAULT_CERT_DIR/privkey.key" "$DEFAULT_CERT_DIR/privkey.pem" "$DEFAULT_CERT_DIR/key.pem"; do
      [[ -f "$k" ]] && KEY_PATH="$k" && break
    done
  fi
fi

if [[ -z "$CERT_PATH" || -z "$KEY_PATH" ]]; then
  echo "[https-aliyun] 请指定 --cert 与 --key（pem/key 绝对路径）"; exit 1
fi

if [[ ! -f "$CERT_PATH" ]]; then
  echo "[https-aliyun] 证书不存在: $CERT_PATH"; exit 1
fi
if [[ ! -f "$KEY_PATH" ]]; then
  echo "[https-aliyun] 私钥不存在: $KEY_PATH"; exit 1
fi

SERVER_NAMES="$DOMAIN"
[[ -n "$APEX" && "$APEX" != "$DOMAIN" ]] && SERVER_NAMES="$DOMAIN $APEX"

NGINX_CONF="/etc/nginx/conf.d/nova-ai-studio.conf"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NGINX_TEMPLATE="$INSTALL_ROOT/current/nginx-https-aliyun.conf"
[[ -f "$NGINX_TEMPLATE" ]] || NGINX_TEMPLATE="$SCRIPT_DIR/../../deploy/nginx-https-aliyun.conf"

echo "[https-aliyun] 域名: $SERVER_NAMES"
echo "[https-aliyun] 证书: $CERT_PATH"
echo "[https-aliyun] 私钥: $KEY_PATH"

if command -v dnf >/dev/null 2>&1; then
  dnf install -y nginx
elif command -v yum >/dev/null 2>&1; then
  yum install -y nginx
elif command -v apt-get >/dev/null 2>&1; then
  apt-get update && apt-get install -y nginx
fi

mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.bak 2>/dev/null || true

SCRIPT_LIB="$(cd "$(dirname "$0")" && pwd)"
OSS_BASE="${NOVA_OSS_BASE:-https://webui-media.oss-cn-beijing.aliyuncs.com/nova-ai-studio}"
NGINX_SITE="$SCRIPT_LIB/nginx-site.sh"
if [[ ! -f "$NGINX_SITE" && -f "$INSTALL_ROOT/nginx-site.sh" ]]; then
  NGINX_SITE="$INSTALL_ROOT/nginx-site.sh"
fi
if [[ ! -f "$NGINX_SITE" ]]; then
  curl -fsSL "$OSS_BASE/nginx-site.sh" -o "$SCRIPT_LIB/nginx-site.sh" 2>/dev/null || true
  NGINX_SITE="$SCRIPT_LIB/nginx-site.sh"
fi
if [[ -f "$NGINX_SITE" ]]; then
  # shellcheck source=nginx-site.sh
  source "$NGINX_SITE"
  apply_nova_nginx_cache_assets "$INSTALL_ROOT/current"
else
  mkdir -p /var/cache/nginx/nova
  [[ -f "$INSTALL_ROOT/current/nginx-cache-http.conf" ]] && cp -f "$INSTALL_ROOT/current/nginx-cache-http.conf" /etc/nginx/conf.d/00-nova-cache-http.conf
  [[ -f "$INSTALL_ROOT/current/nginx-nova-locations.conf" ]] && cp -f "$INSTALL_ROOT/current/nginx-nova-locations.conf" /etc/nginx/nova-locations.conf
fi

sed -e "s/DEPLOY_SERVER_NAMES_PLACEHOLDER/$SERVER_NAMES/g" \
    -e "s|SSL_CERT_PATH_PLACEHOLDER|$CERT_PATH|g" \
    -e "s|SSL_KEY_PATH_PLACEHOLDER|$KEY_PATH|g" \
    "$NGINX_TEMPLATE" > "$NGINX_CONF"

chmod 600 "$KEY_PATH" 2>/dev/null || true

cat > "$INSTALL_ROOT/https-aliyun.env" <<EOF
HTTPS_MODE=aliyun
SSL_CERT=$CERT_PATH
SSL_KEY=$KEY_PATH
DEPLOY_DOMAIN=$DOMAIN
DEPLOY_APEX=${APEX:-}
EOF
chmod 600 "$INSTALL_ROOT/https-aliyun.env" 2>/dev/null || true

if [[ -f "$ENV_FILE" ]]; then
  if grep -q '^DEPLOY_DOMAIN=' "$ENV_FILE"; then
    sed -i "s|^DEPLOY_DOMAIN=.*|DEPLOY_DOMAIN=$DOMAIN|" "$ENV_FILE"
  else
    echo "DEPLOY_DOMAIN=$DOMAIN" >> "$ENV_FILE"
  fi
fi

systemctl enable nginx
nginx -t
systemctl restart nginx

echo ""
echo "[https-aliyun] 完成。请确认阿里云安全组已放行 TCP 443。"
echo "  curl -sI https://$DOMAIN | head -5"
