#!/usr/bin/env bash
# PD-SAAS-FORK: ECS 一键恢复阿里云 HTTPS（可从 OSS curl 后直接 sudo bash）
#
#   curl -fsSL "https://webui-media.oss-cn-beijing.aliyuncs.com/nova-ai-studio/recover-https-aliyun.sh" | sudo bash -s --
#   curl -fsSL ".../recover-https-aliyun.sh" | sudo bash -s -- --cert /path/fullchain.pem --key /path/privkey.key
#
# 会做：拉取 setup/nginx 模板 → 写 https-aliyun.env → 配置 443 → 验证监听
set -euo pipefail

INSTALL_ROOT="${INSTALL_ROOT:-/opt/nova-ai-studio}"
OSS_BASE="${NOVA_OSS_BASE:-https://webui-media.oss-cn-beijing.aliyuncs.com/nova-ai-studio}"
ENV_FILE="${ENV_FILE:-$INSTALL_ROOT/.env}"
DOMAIN=""
APEX=""
CERT_PATH=""
KEY_PATH=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --apex) APEX="$2"; shift 2 ;;
    --cert) CERT_PATH="$2"; shift 2 ;;
    --key) KEY_PATH="$2"; shift 2 ;;
    --help|-h)
      sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "[recover-https] 未知参数: $1"; exit 1 ;;
  esac
done

if [[ "$(id -u)" -ne 0 ]]; then
  echo "[recover-https] 请使用 sudo 运行"; exit 1
fi

if [[ -z "$DOMAIN" && -f "$ENV_FILE" ]]; then
  DOMAIN="$(grep -E '^DEPLOY_DOMAIN=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '\r' || true)"
fi
DOMAIN="${DOMAIN:-www.novapage.online}"
if [[ -z "$APEX" && "$DOMAIN" == www.* ]]; then
  APEX="${DOMAIN#www.}"
fi

fetch_oss() {
  local name="$1"
  local dest="$2"
  if curl -fsSL "$OSS_BASE/$name" -o "$dest" 2>/dev/null; then
    chmod +x "$dest" 2>/dev/null || true
    return 0
  fi
  echo "[recover-https] 警告: 无法从 OSS 下载 $name" >&2
  return 1
}

mkdir -p "$INSTALL_ROOT"
WORK="$INSTALL_ROOT/.https-recover"
mkdir -p "$WORK"

fetch_oss "setup-https-aliyun.sh" "$WORK/setup-https-aliyun.sh" || true
fetch_oss "nginx-site.sh" "$WORK/nginx-site.sh" || true

# 发布包内模板优先
NGINX_TEMPLATE="$INSTALL_ROOT/current/nginx-https-aliyun.conf"
if [[ ! -f "$NGINX_TEMPLATE" ]]; then
  fetch_oss "nginx-https-aliyun.conf" "$WORK/nginx-https-aliyun.conf" && NGINX_TEMPLATE="$WORK/nginx-https-aliyun.conf"
fi
if [[ ! -f "$NGINX_TEMPLATE" ]]; then
  NGINX_TEMPLATE="$WORK/nginx-https-aliyun.conf"
  cat > "$NGINX_TEMPLATE" <<'NGINX_EOF'
# PD-SAAS-FORK: 内嵌 HTTPS 模板（OSS/发布包不可用时）
server {
    listen 80;
    listen [::]:80;
    server_name DEPLOY_SERVER_NAMES_PLACEHOLDER;
    location / { return 301 https://$host$request_uri; }
}
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name DEPLOY_SERVER_NAMES_PLACEHOLDER;
    ssl_certificate SSL_CERT_PATH_PLACEHOLDER;
    ssl_certificate_key SSL_KEY_PATH_PLACEHOLDER;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    client_max_body_size 200m;
    include /etc/nginx/nova-locations.conf;
}
NGINX_EOF
fi

for aux in nginx-nova-locations.conf nginx-cache-http.conf nginx-https-aliyun.conf; do
  if [[ ! -f "$INSTALL_ROOT/current/$aux" ]]; then
    fetch_oss "$aux" "$WORK/$aux" 2>/dev/null || true
    if [[ -f "$WORK/$aux" && -d "$INSTALL_ROOT/current" ]]; then
      cp -f "$WORK/$aux" "$INSTALL_ROOT/current/$aux" 2>/dev/null || true
    fi
  fi
done

# 自动探测证书
if [[ -z "$CERT_PATH" || -z "$KEY_PATH" ]]; then
  if [[ -f "$INSTALL_ROOT/https-aliyun.env" ]]; then
    # shellcheck disable=SC1090
    source "$INSTALL_ROOT/https-aliyun.env"
    CERT_PATH="${SSL_CERT:-}"
    KEY_PATH="${SSL_KEY:-}"
  fi
fi

DEFAULT_CERT_DIR="/etc/nginx/ssl/novapage"
if [[ -z "$CERT_PATH" ]]; then
  for c in \
    "$DEFAULT_CERT_DIR/fullchain.pem" \
    "$DEFAULT_CERT_DIR/cert.pem" \
    "/etc/nginx/ssl/fullchain.pem" \
    "/etc/pki/nginx/server.pem"; do
    [[ -f "$c" ]] && CERT_PATH="$c" && break
  done
fi
if [[ -z "$KEY_PATH" ]]; then
  for k in \
    "$DEFAULT_CERT_DIR/privkey.key" \
    "$DEFAULT_CERT_DIR/privkey.pem" \
    "$DEFAULT_CERT_DIR/key.pem" \
    "/etc/nginx/ssl/privkey.key"; do
    [[ -f "$k" ]] && KEY_PATH="$k" && break
  done
fi

if [[ -z "$CERT_PATH" || -z "$KEY_PATH" ]]; then
  cat >&2 <<EOF
[recover-https] 未找到证书文件。请先把阿里云下载的 pem/key 放到服务器，例如：

  sudo mkdir -p $DEFAULT_CERT_DIR
  # 若有 cert.pem + chain.pem:
  # sudo bash -c 'cat /tmp/cert.pem /tmp/chain.pem > $DEFAULT_CERT_DIR/fullchain.pem'
  sudo cp /tmp/你的证书.pem $DEFAULT_CERT_DIR/fullchain.pem
  sudo cp /tmp/你的私钥.key $DEFAULT_CERT_DIR/privkey.key
  sudo chmod 600 $DEFAULT_CERT_DIR/privkey.key

然后重新运行本脚本，或指定:
  sudo bash recover-https-aliyun.sh --cert ... --key ...
EOF
  exit 1
fi

echo "[recover-https] 域名: $DOMAIN ${APEX:+(apex $APEX)}"
echo "[recover-https] 证书: $CERT_PATH"
echo "[recover-https] 私钥: $KEY_PATH"

SETUP="$WORK/setup-https-aliyun.sh"
if [[ ! -f "$SETUP" ]]; then
  fetch_oss "setup-https-aliyun.sh" "$WORK/setup-https-aliyun.sh" || true
fi
if [[ ! -f "$SETUP" && -f "$INSTALL_ROOT/setup-https-aliyun.sh" ]]; then
  SETUP="$INSTALL_ROOT/setup-https-aliyun.sh"
fi
if [[ ! -f "$SETUP" ]]; then
  echo "[recover-https] 无法获取 setup-https-aliyun.sh。" >&2
  echo "  请在本机执行: scp scripts/release/{recover-https-aliyun.sh,setup-https-aliyun.sh,nginx-site.sh} admin@47.79.32.199:/tmp/" >&2
  echo "  然后在 ECS: sudo bash /tmp/recover-https-aliyun.sh --cert ... --key ..." >&2
  exit 1
fi

mkdir -p "$INSTALL_ROOT/current"
cp -f "$NGINX_TEMPLATE" "$INSTALL_ROOT/current/nginx-https-aliyun.conf"
for aux in nginx-nova-locations.conf nginx-cache-http.conf; do
  if [[ -f "$WORK/$aux" && ! -f "$INSTALL_ROOT/current/$aux" ]]; then
    cp -f "$WORK/$aux" "$INSTALL_ROOT/current/$aux"
  fi
done
if [[ ! -f /etc/nginx/nova-locations.conf && -f "$INSTALL_ROOT/current/nginx-nova-locations.conf" ]]; then
  cp -f "$INSTALL_ROOT/current/nginx-nova-locations.conf" /etc/nginx/nova-locations.conf
fi
cp -f "$WORK/nginx-site.sh" "$(dirname "$SETUP")/nginx-site.sh" 2>/dev/null || true
cp -f "$SETUP" "$INSTALL_ROOT/setup-https-aliyun.sh"
cp -f "$WORK/nginx-site.sh" "$INSTALL_ROOT/nginx-site.sh" 2>/dev/null || true
chmod +x "$INSTALL_ROOT/setup-https-aliyun.sh" "$INSTALL_ROOT/nginx-site.sh" 2>/dev/null || true

APEX_ARGS=()
[[ -n "$APEX" ]] && APEX_ARGS=(--apex "$APEX")

bash "$INSTALL_ROOT/setup-https-aliyun.sh" \
  --domain "$DOMAIN" \
  "${APEX_ARGS[@]}" \
  --cert "$CERT_PATH" \
  --key "$KEY_PATH" \
  --yes

echo ""
echo "[recover-https] 检查 443 监听..."
if ss -tlnp 2>/dev/null | grep -q ':443 '; then
  echo "[recover-https] ✅ Nginx 已在监听 443"
else
  echo "[recover-https] ❌ 仍未监听 443 — 请检查 nginx -t 与 systemctl status nginx" >&2
  nginx -t 2>&1 || true
  exit 1
fi

echo "[recover-https] 本机探测 HTTPS..."
if curl -fsSI --max-time 10 "https://$DOMAIN/" | head -3; then
  echo "[recover-https] ✅ HTTPS 本机可达"
else
  echo "[recover-https] ⚠️ 本机 curl 失败 — 若 Nginx 已监听 443，请到阿里云控制台检查安全组是否放行 TCP 443" >&2
fi

echo ""
echo "[recover-https] 完成。后续 upgrade.sh 将读取 $INSTALL_ROOT/https-aliyun.env 自动保留 HTTPS。"
