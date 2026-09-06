#!/usr/bin/env bash
# Nova Ai-Studio：为已部署站点配置 HTTPS（Let's Encrypt + Nginx 反代 127.0.0.1:3001）
#
# 用法:
#   sudo bash setup-https.sh --domain www.novapage.online --email you@example.com --yes
#   sudo bash setup-https.sh --domain www.novapage.online --apex novapage.online --email you@example.com --yes
#
# 前置: 域名 DNS 已指向本机；安全组放行 80/443；Nova 在 127.0.0.1:3001 正常。
set -euo pipefail

INSTALL_ROOT="${INSTALL_ROOT:-/opt/nova-ai-studio}"
ENV_FILE="${ENV_FILE:-$INSTALL_ROOT/.env}"
DOMAIN=""
APEX=""
EMAIL=""
NONINTERACTIVE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --apex) APEX="$2"; shift 2 ;;
    --email) EMAIL="$2"; shift 2 ;;
    --yes) NONINTERACTIVE=1; shift ;;
    --help|-h)
      sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "未知参数: $1"; exit 1 ;;
  esac
done

if [[ "$(id -u)" -ne 0 ]]; then
  echo "[https] 请使用 sudo 运行"; exit 1
fi

if [[ -z "$DOMAIN" && -f "$ENV_FILE" ]]; then
  DOMAIN="$(grep -E '^DEPLOY_DOMAIN=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '\r' || true)"
fi

if [[ -z "$DOMAIN" || "$DOMAIN" == "_" ]]; then
  echo "[https] 请指定 --domain www.example.com"; exit 1
fi

SERVER_NAMES="$DOMAIN"
[[ -n "$APEX" && "$APEX" != "$DOMAIN" ]] && SERVER_NAMES="$DOMAIN $APEX"

CERTBOT_EXTRA=()
if [[ -n "$EMAIL" ]]; then
  CERTBOT_EXTRA=(--email "$EMAIL")
else
  CERTBOT_EXTRA=(--register-unsafely-without-email)
fi
[[ "$NONINTERACTIVE" -eq 1 ]] && CERTBOT_EXTRA+=(--agree-tos --non-interactive) || CERTBOT_EXTRA+=(--agree-tos)

NGINX_CONF="/etc/nginx/conf.d/nova-ai-studio.conf"
NGINX_HTTP_TEMPLATE="$INSTALL_ROOT/current/nginx.conf.cached"
NGINX_HTTPS_TEMPLATE="$INSTALL_ROOT/current/nginx-https.conf.cached"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
[[ -f "$NGINX_HTTP_TEMPLATE" ]] || NGINX_HTTP_TEMPLATE="$INSTALL_ROOT/current/nginx.conf"
[[ -f "$NGINX_HTTP_TEMPLATE" ]] || NGINX_HTTP_TEMPLATE="$SCRIPT_DIR/../../deploy/nginx.conf.cached"
[[ -f "$NGINX_HTTP_TEMPLATE" ]] || NGINX_HTTP_TEMPLATE="$SCRIPT_DIR/../../deploy/nginx.conf"
[[ -f "$NGINX_HTTPS_TEMPLATE" ]] || NGINX_HTTPS_TEMPLATE="$INSTALL_ROOT/current/nginx-https.conf"
[[ -f "$NGINX_HTTPS_TEMPLATE" ]] || NGINX_HTTPS_TEMPLATE="$SCRIPT_DIR/../../deploy/nginx-https.conf.cached"
[[ -f "$NGINX_HTTPS_TEMPLATE" ]] || NGINX_HTTPS_TEMPLATE="$SCRIPT_DIR/../../deploy/nginx-https.conf"

install_nginx_cache_assets() {
  local base="$INSTALL_ROOT/current"
  [[ -d "$base" ]] || base="$SCRIPT_DIR/../../deploy"
  mkdir -p /var/cache/nginx/nova
  chown -R nginx:nginx /var/cache/nginx/nova 2>/dev/null || chown -R www-data:www-data /var/cache/nginx/nova 2>/dev/null || true
  [[ -f "$base/nginx-cache-http.conf" ]] && cp -f "$base/nginx-cache-http.conf" /etc/nginx/conf.d/00-nova-cache-http.conf
  [[ -f "$base/nginx-nova-locations.conf" ]] && cp -f "$base/nginx-nova-locations.conf" /etc/nginx/nova-locations.conf
}

echo "[https] 域名: $SERVER_NAMES"

if [[ -f "$ENV_FILE" ]]; then
  if grep -q '^DEPLOY_DOMAIN=' "$ENV_FILE"; then
    sed -i "s|^DEPLOY_DOMAIN=.*|DEPLOY_DOMAIN=$DOMAIN|" "$ENV_FILE"
  else
    echo "DEPLOY_DOMAIN=$DOMAIN" >> "$ENV_FILE"
  fi
fi

echo "[https] 安装 Nginx / Certbot..."
if command -v dnf >/dev/null 2>&1; then
  dnf install -y nginx certbot python3-certbot-nginx
elif command -v yum >/dev/null 2>&1; then
  yum install -y nginx certbot python3-certbot-nginx
elif command -v apt-get >/dev/null 2>&1; then
  apt-get update && apt-get install -y nginx certbot python3-certbot-nginx
fi

mkdir -p /var/www/certbot
mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.bak 2>/dev/null || true

install_nginx_cache_assets
sed "s/DEPLOY_DOMAIN_PLACEHOLDER/$DOMAIN/g" "$NGINX_HTTP_TEMPLATE" > "$NGINX_CONF"
systemctl enable nginx
systemctl restart nginx
nginx -t

CERT_DOMAINS=(-d "$DOMAIN")
[[ -n "$APEX" && "$APEX" != "$DOMAIN" ]] && CERT_DOMAINS+=(-d "$APEX")

if certbot certificates 2>/dev/null | grep -q "Domains:.*$DOMAIN"; then
  echo "[https] 证书已存在，跳过签发"
else
  echo "[https] 申请 Let's Encrypt 证书..."
  certbot certonly --nginx "${CERT_DOMAINS[@]}" "${CERTBOT_EXTRA[@]}"
fi

echo "[https] 写入 HTTPS 反代配置..."
install_nginx_cache_assets
sed -e "s/DEPLOY_DOMAIN_PLACEHOLDER/$DOMAIN/g" \
    -e "s/DEPLOY_SERVER_NAMES_PLACEHOLDER/$SERVER_NAMES/g" \
    "$NGINX_HTTPS_TEMPLATE" > "$NGINX_CONF"
nginx -t && systemctl reload nginx

echo "[https] 配置证书自动续期..."
(systemctl enable certbot-renew.timer 2>/dev/null && systemctl start certbot-renew.timer) || true

echo ""
echo "[https] 完成。请确认阿里云安全组已放行 443。"
echo "  curl -sI https://$DOMAIN | head -5"
