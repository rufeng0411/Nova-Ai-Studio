#!/usr/bin/env bash
# Nova Ai-Studio 一键安装（阿里云 Linux + Docker + Nginx）
# 轻量包：服务器 docker compose build 安装依赖（包内无 node_modules / image.tar）
# 用法: curl -fsSL "$OSS/install.sh" | sudo bash -s -- --bundle "$OSS/nova-latest.tar.gz"
set -euo pipefail

INSTALL_ROOT="/opt/nova-ai-studio"
DATA_ROOT="/var/lib/nova"
BUNDLE_URL=""
DOMAIN=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bundle) BUNDLE_URL="$2"; shift 2 ;;
    --domain) DOMAIN="$2"; shift 2 ;;
    *) echo "未知参数: $1"; exit 1 ;;
  esac
done

if [[ -z "$BUNDLE_URL" ]]; then
  echo "用法: sudo bash install.sh --bundle https://bucket.oss-cn-xxx.aliyuncs.com/nova-ai-studio/nova-latest.tar.gz [--domain ai.example.com]"
  exit 1
fi

echo "[nova] 安装 Docker..."
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | bash
  systemctl enable --now docker
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "[nova] 需要 Docker Compose 插件"; exit 1
fi

echo "[nova] 安装 Nginx..."
if ! command -v nginx >/dev/null 2>&1; then
  if command -v dnf >/dev/null 2>&1; then dnf install -y nginx
  elif command -v yum >/dev/null 2>&1; then yum install -y nginx
  elif command -v apt-get >/dev/null 2>&1; then apt-get update && apt-get install -y nginx
  fi
  systemctl enable nginx
fi

echo "[nova] 调高 inotify 监视上限（避免 projects 多时 ENOSPC）..."
SYSCTL_DROPIN="/etc/sysctl.d/99-nova-inotify.conf"
if ! grep -q 'fs.inotify.max_user_watches' "$SYSCTL_DROPIN" 2>/dev/null; then
  cat > "$SYSCTL_DROPIN" <<'EOF'
fs.inotify.max_user_watches=524288
fs.inotify.max_user_instances=1024
EOF
  sysctl --system >/dev/null 2>&1 || sysctl -p "$SYSCTL_DROPIN" >/dev/null 2>&1 || true
fi

mkdir -p "$INSTALL_ROOT" "$DATA_ROOT"/{pilotdeck,saas,postgres,redis} "$INSTALL_ROOT/tmp"
cd "$INSTALL_ROOT/tmp"

echo "[nova] 下载发布包..."
curl -fL "$BUNDLE_URL" -o nova-bundle.tar.gz
tar --no-same-permissions --no-same-owner -xzf nova-bundle.tar.gz 2>/dev/null \
  || tar xzf nova-bundle.tar.gz --no-same-permissions 2>/dev/null \
  || tar xzf nova-bundle.tar.gz

VERSION="$(cat VERSION)"
export NOVA_VERSION="$VERSION"

if [[ -f "$DATA_ROOT/.installed" ]]; then
  echo "[nova] 已安装过，请用 upgrade.sh 更新"; exit 1
fi

if [[ ! -d app ]]; then
  echo "[nova] 发布包缺少 app/ 目录"; exit 1
fi

mkdir -p "$INSTALL_ROOT/releases/$VERSION"
cp -rf app "$INSTALL_ROOT/releases/$VERSION/app"
cp -f docker-compose*.yml deploy.env nginx.conf nginx.conf.cached nginx-https.conf nginx-https.conf.cached nginx-https-aliyun.conf nginx-cache-http.conf nginx-nova-locations.conf "$INSTALL_ROOT/releases/$VERSION/" 2>/dev/null || \
cp -f docker-compose*.yml deploy.env nginx.conf "$INSTALL_ROOT/releases/$VERSION/"
ln -sfn "$INSTALL_ROOT/releases/$VERSION" "$INSTALL_ROOT/current"

cp -f deploy.env "$INSTALL_ROOT/.env"
ln -sfn "$INSTALL_ROOT/.env" "$INSTALL_ROOT/releases/$VERSION/.env"
# shellcheck disable=SC1091
set -a
source "$INSTALL_ROOT/.env"
set +a

DB_BACKEND="${DB_BACKEND:-sqlite}"
COMPOSE_FILE="docker-compose.prod.yml"
[[ "$DB_BACKEND" == "postgres" ]] && COMPOSE_FILE="docker-compose.prod.pg.yml"

if [[ -f data.tar.gz ]]; then
  echo "[nova] 解压用户数据（仅首装）..."
  tar xzf data.tar.gz -C "$DATA_ROOT"
fi

cd "$INSTALL_ROOT/current"

if [[ "$DB_BACKEND" == "postgres" && -f "$INSTALL_ROOT/tmp/postgres.dump" && ! -f "$DATA_ROOT/postgres/PG_VERSION" ]]; then
  echo "[nova] 首次导入 PostgreSQL 数据..."
  docker compose -f "$COMPOSE_FILE" --env-file "$INSTALL_ROOT/.env" up -d postgres
  for i in $(seq 1 60); do
    docker compose -f "$COMPOSE_FILE" --env-file "$INSTALL_ROOT/.env" exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" && break
    sleep 2
  done
  docker cp "$INSTALL_ROOT/tmp/postgres.dump" nova-postgres:/tmp/nova.dump
  docker compose -f "$COMPOSE_FILE" --env-file "$INSTALL_ROOT/.env" exec -T postgres \
    pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges /tmp/nova.dump || true
fi

echo "[nova] 构建镜像（服务器安装依赖，约需数分钟）..."
docker compose -f "$COMPOSE_FILE" --env-file "$INSTALL_ROOT/.env" build

echo "[nova] 启动服务..."
docker compose -f "$COMPOSE_FILE" --env-file "$INSTALL_ROOT/.env" up -d

install_nginx_cache_assets() {
  local release_dir="$1"
  mkdir -p /var/cache/nginx/nova
  chown -R nginx:nginx /var/cache/nginx/nova 2>/dev/null || chown -R www-data:www-data /var/cache/nginx/nova 2>/dev/null || true
  if [[ -f "$release_dir/nginx-cache-http.conf" ]]; then
    cp -f "$release_dir/nginx-cache-http.conf" /etc/nginx/conf.d/00-nova-cache-http.conf
  fi
  if [[ -f "$release_dir/nginx-nova-locations.conf" ]]; then
    cp -f "$release_dir/nginx-nova-locations.conf" /etc/nginx/nova-locations.conf
  fi
}

DEPLOY_DOMAIN="${DOMAIN:-${DEPLOY_DOMAIN:-_}}"
if [[ "$DEPLOY_DOMAIN" != "_" ]]; then
  install_nginx_cache_assets "$INSTALL_ROOT/current"
  NGINX_TEMPLATE="nginx.conf"
  [[ -f "$INSTALL_ROOT/current/nginx.conf.cached" ]] && NGINX_TEMPLATE="nginx.conf.cached"
  sed "s/DEPLOY_DOMAIN_PLACEHOLDER/$DEPLOY_DOMAIN/g" "$INSTALL_ROOT/current/$NGINX_TEMPLATE" > /etc/nginx/conf.d/nova-ai-studio.conf
  nginx -t && systemctl enable nginx && systemctl restart nginx
fi

date -u +%Y-%m-%dT%H:%MZ > "$DATA_ROOT/.installed"
if [[ -f "$INSTALL_ROOT/tmp/upgrade.sh" ]]; then
  cp -f "$INSTALL_ROOT/tmp/upgrade.sh" "$INSTALL_ROOT/upgrade.sh"
  chmod +x "$INSTALL_ROOT/upgrade.sh"
fi
if [[ -f "$INSTALL_ROOT/tmp/verify-export-runtime.sh" ]]; then
  cp -f "$INSTALL_ROOT/tmp/verify-export-runtime.sh" "$INSTALL_ROOT/verify-export-runtime.sh"
  chmod +x "$INSTALL_ROOT/verify-export-runtime.sh"
fi
for name in verify-cloud-runtime.sh verify-cloud-perf.sh apply-cloud-perf-env.sh; do
  if [[ -f "$INSTALL_ROOT/tmp/$name" ]]; then
    cp -f "$INSTALL_ROOT/tmp/$name" "$INSTALL_ROOT/$name"
    chmod +x "$INSTALL_ROOT/$name"
    sed -i 's/\r$//' "$INSTALL_ROOT/$name" 2>/dev/null || true
  fi
done
rm -rf "$INSTALL_ROOT/tmp"/*
echo "[nova] 安装完成 v$VERSION → http://${DEPLOY_DOMAIN:-127.0.0.1:3001}（管理员 admin，公网前请改密）"
echo "[nova] 日后升级: sudo bash $INSTALL_ROOT/upgrade.sh --bundle <URL>"
