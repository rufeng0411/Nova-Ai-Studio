#!/usr/bin/env bash
# Nova Ai-Studio 一键更新：换程序、重建镜像；不覆盖 /var/lib/nova 用户数据与 .env
#
# 依赖在服务器 docker build 时安装（Playwright、python-pptx、pnpm 等），无需本机 ossutil。
#
# 用法（任选其一）:
#   sudo bash upgrade.sh --bundle https://bucket.../nova-latest.tar.gz
#   sudo bash upgrade.sh --local /path/on/server/nova-XXX.tar.gz
#   sudo bash upgrade.sh   # 需 /opt/nova-ai-studio/.env 中 NOVA_BUNDLE_URL=...
#
# 从 OSS 拉脚本（包由服务器 curl 下载）:
#   curl -fsSL "https://webui-media.oss-cn-beijing.aliyuncs.com/nova-ai-studio/upgrade.sh" | sudo bash -s --
set -euo pipefail

INSTALL_ROOT="/opt/nova-ai-studio"
DATA_ROOT="/var/lib/nova"
INCOMING_DIR="$INSTALL_ROOT/incoming"
BUNDLE_URL=""
LOCAL_BUNDLE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bundle) BUNDLE_URL="$2"; shift 2 ;;
    --local) LOCAL_BUNDLE="$2"; shift 2 ;;
    *) echo "未知参数: $1"; exit 1 ;;
  esac
done

resolve_bundle_url() {
  if [[ -n "$BUNDLE_URL" ]]; then
    return 0
  fi
  if [[ -f "$INSTALL_ROOT/.env" ]]; then
    BUNDLE_URL="$(grep -E '^NOVA_BUNDLE_URL=' "$INSTALL_ROOT/.env" 2>/dev/null | cut -d= -f2- | tr -d '\r' || true)"
  fi
  if [[ -z "$BUNDLE_URL" && -f "$INSTALL_ROOT/bundle.url" ]]; then
    BUNDLE_URL="$(tr -d '\r\n' < "$INSTALL_ROOT/bundle.url")"
  fi
}

if [[ -z "$LOCAL_BUNDLE" ]]; then
  resolve_bundle_url
  if [[ -z "$BUNDLE_URL" ]]; then
    cat >&2 <<'EOF'
用法:
  sudo bash upgrade.sh --bundle https://.../nova-latest.tar.gz
  sudo bash upgrade.sh --local /opt/nova-ai-studio/incoming/nova-XXX.tar.gz
  sudo bash upgrade.sh   # 在 .env 配置 NOVA_BUNDLE_URL=https://.../nova-latest.tar.gz

本机无 ossutil 时：把 tar.gz 传到 ECS（scp 或 OSS 控制台），在服务器上用 --local 或配置 NOVA_BUNDLE_URL 后执行本脚本。
EOF
    exit 1
  fi
fi

if [[ ! -f "$DATA_ROOT/.installed" ]]; then
  echo "[nova] 未安装，请先运行 install.sh"; exit 1
fi

mkdir -p "$INSTALL_ROOT/tmp" "$INCOMING_DIR"
cd "$INSTALL_ROOT/tmp"

if [[ -n "$LOCAL_BUNDLE" ]]; then
  if [[ ! -f "$LOCAL_BUNDLE" ]]; then
    echo "[nova] 本地包不存在: $LOCAL_BUNDLE"; exit 1
  fi
  echo "[nova] 使用服务器本地包: $LOCAL_BUNDLE"
  cp -f "$LOCAL_BUNDLE" nova-bundle.tar.gz
else
  echo "[nova] 从服务器下载新版本..."
  echo "[nova] URL: $BUNDLE_URL"
  curl -fL "$BUNDLE_URL" -o nova-bundle.tar.gz
fi

# Windows 打的包在部分 ECS 文件系统上 chmod/utime 会失败，须忽略权限位
tar --no-same-permissions --no-same-owner -xzf nova-bundle.tar.gz 2>/dev/null \
  || tar xzf nova-bundle.tar.gz --no-same-permissions 2>/dev/null \
  || tar xzf nova-bundle.tar.gz

# PD-SAAS-FORK: Windows 打包的 .sh 可能带 CRLF，Linux bash 会在 [[ ]] / echo 处报错
normalize_shell_scripts() {
  local dir="$1"
  [[ -d "$dir" ]] || return 0
  local f
  for f in "$dir"/*.sh; do
    [[ -f "$f" ]] || continue
    sed -i 's/\r$//' "$f" 2>/dev/null || true
  done
}
normalize_shell_scripts "$INSTALL_ROOT/tmp"
if [[ -f "$INSTALL_ROOT/tmp/upgrade.sh" ]]; then
  cp -f "$INSTALL_ROOT/tmp/upgrade.sh" "$INSTALL_ROOT/upgrade.sh"
  chmod +x "$INSTALL_ROOT/upgrade.sh"
  sed -i 's/\r$//' "$INSTALL_ROOT/upgrade.sh" 2>/dev/null || true
fi

VERSION="$(cat VERSION)"
export NOVA_VERSION="$VERSION"

# shellcheck disable=SC1091
set -a
source "$INSTALL_ROOT/.env"
set +a
# .env 可能残留旧 NOVA_VERSION，必须以本次包 VERSION 为准
export NOVA_VERSION="$VERSION"
DB_BACKEND="${DB_BACKEND:-sqlite}"
COMPOSE_FILE="docker-compose.prod.yml"
[[ "$DB_BACKEND" == "postgres" ]] && COMPOSE_FILE="docker-compose.prod.pg.yml"

echo "[nova] 停服..."
cd "$INSTALL_ROOT/current"
docker compose -f "$COMPOSE_FILE" --env-file "$INSTALL_ROOT/.env" stop nova || true

echo "[nova] 删除旧备份..."
rm -rf "$INSTALL_ROOT/backups"/*
mkdir -p "$INSTALL_ROOT/backups"

if [[ ! -d "$INSTALL_ROOT/tmp/app" ]]; then
  echo "[nova] 发布包缺少 app/ 目录"; exit 1
fi

mkdir -p "$INSTALL_ROOT/releases/$VERSION"
cp -rf "$INSTALL_ROOT/tmp/app" "$INSTALL_ROOT/releases/$VERSION/app"
cp -f "$INSTALL_ROOT/tmp"/docker-compose*.yml "$INSTALL_ROOT/tmp"/nginx*.conf "$INSTALL_ROOT/releases/$VERSION/" 2>/dev/null || \
cp -f "$INSTALL_ROOT/tmp"/docker-compose*.yml "$INSTALL_ROOT/tmp/nginx.conf" "$INSTALL_ROOT/releases/$VERSION/"
if [[ -f "$INSTALL_ROOT/tmp/HISTORY-MESSAGES-DEPLOY.md" ]]; then
  cp -f "$INSTALL_ROOT/tmp/HISTORY-MESSAGES-DEPLOY.md" "$INSTALL_ROOT/releases/$VERSION/"
  cp -f "$INSTALL_ROOT/tmp/HISTORY-MESSAGES-DEPLOY.md" "$INSTALL_ROOT/"
fi
ln -sfn "$INSTALL_ROOT/releases/$VERSION" "$INSTALL_ROOT/current"
ln -sfn "$INSTALL_ROOT/.env" "$INSTALL_ROOT/releases/$VERSION/.env"

# PD-SAAS-FORK: 持久化 NOVA_VERSION，避免 .env 旧版本导致 compose 拉起错误镜像 tag
if [[ -f "$INSTALL_ROOT/.env" ]]; then
  if grep -q '^NOVA_VERSION=' "$INSTALL_ROOT/.env" 2>/dev/null; then
    sed -i "s/^NOVA_VERSION=.*/NOVA_VERSION=$VERSION/" "$INSTALL_ROOT/.env"
  else
    echo "NOVA_VERSION=$VERSION" >> "$INSTALL_ROOT/.env"
  fi
fi

# 不覆盖 $INSTALL_ROOT/.env 与 $DATA_ROOT 下任何数据
cd "$INSTALL_ROOT/current"
echo "[nova] 重建镜像（--no-cache；apt + pip + pnpm + Playwright + sharp）..."
docker compose -f "$COMPOSE_FILE" --env-file "$INSTALL_ROOT/.env" build --no-cache nova

echo "[nova] 启动服务..."
docker compose -f "$COMPOSE_FILE" --env-file "$INSTALL_ROOT/.env" up -d 2>/dev/null || {
  echo "[nova] 容器名冲突，清理旧容器后重试..."
  docker rm -f nova-ai-studio nova-redis 2>/dev/null || true
  docker compose -f "$COMPOSE_FILE" --env-file "$INSTALL_ROOT/.env" up -d
}

# 校验容器内前端是否已换新（index-*.js 哈希应随版本变化）
CONTAINER_INDEX="$(docker compose -f "$COMPOSE_FILE" --env-file "$INSTALL_ROOT/.env" exec -T nova \
  grep -oE 'assets/index-[^"]+' /app/ui/dist/index.html 2>/dev/null | head -1 || true)"
RELEASE_INDEX="$(grep -oE 'assets/index-[^"]+' "$INSTALL_ROOT/releases/$VERSION/app/ui/dist/index.html" 2>/dev/null | head -1 || true)"
if [[ -n "$RELEASE_INDEX" && -n "$CONTAINER_INDEX" && "$RELEASE_INDEX" != "$CONTAINER_INDEX" ]]; then
  echo "[nova] 警告: 镜像内 index 与发布包不一致（包 $RELEASE_INDEX / 容器 $CONTAINER_INDEX）" >&2
fi
if [[ -n "$RELEASE_INDEX" ]]; then
  echo "[nova] 前端包: $RELEASE_INDEX"
fi

# 同步运维脚本（须去 CRLF），再校验导出 / SSL / Nginx
sync_install_scripts() {
  local name
  for name in nginx-site.sh setup-https-aliyun.sh recover-https-aliyun.sh install-ssl-https.sh \
    verify-export-runtime.sh verify-cloud-runtime.sh verify-cloud-perf.sh apply-cloud-perf-env.sh; do
    if [[ -f "$INSTALL_ROOT/tmp/$name" ]]; then
      cp -f "$INSTALL_ROOT/tmp/$name" "$INSTALL_ROOT/$name"
      chmod +x "$INSTALL_ROOT/$name"
      sed -i 's/\r$//' "$INSTALL_ROOT/$name" 2>/dev/null || true
    fi
  done
}
sync_install_scripts

if [[ -f "$INSTALL_ROOT/verify-export-runtime.sh" ]]; then
  bash "$INSTALL_ROOT/verify-export-runtime.sh" "$COMPOSE_FILE" "$INSTALL_ROOT/.env" nova || true
fi

# PD-SAAS-FORK: export API loads ui/src/shared/*.ts — fail fast if missing from image
if ! docker compose -f "$COMPOSE_FILE" --env-file "$INSTALL_ROOT/.env" exec -T nova \
  test -f /app/ui/src/shared/resolveExportScope.ts 2>/dev/null; then
  echo "[nova] 警告: 镜像缺少 /app/ui/src/shared — PDF/DOC/PPT 导出会失败，请用含 ui/src/shared 的包重建" >&2
fi

# 发布包内含 ssl/ 时自动安装证书并写 https-aliyun.env（后续升级保留 HTTPS）
if [[ -d "$INSTALL_ROOT/tmp/ssl" ]]; then
  echo "[nova] 检测到发布包 ssl/，配置 HTTPS..."
  bash "$INSTALL_ROOT/install-ssl-https.sh" --src "$INSTALL_ROOT/tmp/ssl" --yes \
    || echo "[nova] 警告: SSL/HTTPS 自动配置失败，可手动运行 install-ssl-https.sh" >&2
elif [[ -f "$INSTALL_ROOT/https-aliyun.env" ]]; then
  echo "[nova] 保留已有 https-aliyun.env，稍后重载 Nginx"
fi

if [[ -f /etc/nginx/conf.d/nova-ai-studio.conf ]]; then
  # shellcheck source=nginx-site.sh
  source "$INSTALL_ROOT/nginx-site.sh" 2>/dev/null || source "$(dirname "$0")/nginx-site.sh" 2>/dev/null || true
  if declare -F apply_nova_nginx_site >/dev/null 2>&1; then
    apply_nova_nginx_site "$INSTALL_ROOT" "$INSTALL_ROOT/releases/$VERSION" "$INSTALL_ROOT/.env"
  else
    DEPLOY_DOMAIN="$(grep DEPLOY_DOMAIN "$INSTALL_ROOT/.env" 2>/dev/null | cut -d= -f2- | tr -d '\r' || echo _)"
    if [[ -n "$DEPLOY_DOMAIN" && "$DEPLOY_DOMAIN" != "_" ]]; then
      mkdir -p /var/cache/nginx/nova
      chown -R nginx:nginx /var/cache/nginx/nova 2>/dev/null || chown -R www-data:www-data /var/cache/nginx/nova 2>/dev/null || true
      [[ -f "$INSTALL_ROOT/current/nginx-cache-http.conf" ]] && cp -f "$INSTALL_ROOT/current/nginx-cache-http.conf" /etc/nginx/conf.d/00-nova-cache-http.conf
      [[ -f "$INSTALL_ROOT/current/nginx-nova-locations.conf" ]] && cp -f "$INSTALL_ROOT/current/nginx-nova-locations.conf" /etc/nginx/nova-locations.conf
      NGINX_TEMPLATE="$INSTALL_ROOT/current/nginx.conf"
      [[ -f "$INSTALL_ROOT/current/nginx.conf.cached" ]] && NGINX_TEMPLATE="$INSTALL_ROOT/current/nginx.conf.cached"
      sed "s/DEPLOY_DOMAIN_PLACEHOLDER/$DEPLOY_DOMAIN/g" "$NGINX_TEMPLATE" > /etc/nginx/conf.d/nova-ai-studio.conf
      rm -rf /var/cache/nginx/nova/* 2>/dev/null || true
      nginx -t && systemctl reload nginx
    fi
  fi
fi

if [[ -f "$INSTALL_ROOT/verify-cloud-runtime.sh" ]]; then
  bash "$INSTALL_ROOT/verify-cloud-runtime.sh" "$COMPOSE_FILE" "$INSTALL_ROOT/.env" nova \
    || echo "[nova] 警告: 云端运行时校验未全部通过，见上方 ✗ 项" >&2
fi

if [[ -f "$INSTALL_ROOT/tmp/upgrade.sh" ]]; then
  cp -f "$INSTALL_ROOT/tmp/upgrade.sh" "$INSTALL_ROOT/upgrade.sh"
  chmod +x "$INSTALL_ROOT/upgrade.sh"
  sed -i 's/\r$//' "$INSTALL_ROOT/upgrade.sh" 2>/dev/null || true
fi

rm -rf "$INSTALL_ROOT/tmp"/*
echo "[nova] 更新完成 v$VERSION（数据与 deploy.env 未改动）"
echo "[nova] 校验: sudo bash $INSTALL_ROOT/verify-cloud-runtime.sh"
echo "[nova] 性能: sudo bash $INSTALL_ROOT/verify-cloud-perf.sh"
echo "[nova] 对话历史/缓存加速（一键，不覆盖 JWT/数据库）:"
echo "       sudo bash $INSTALL_ROOT/apply-cloud-perf-env.sh"
echo "       详见 $INSTALL_ROOT/HISTORY-MESSAGES-DEPLOY.md"
echo "[nova] HTTPS: sudo bash $INSTALL_ROOT/install-ssl-https.sh  # 若尚未配置"
echo "[nova] 下次升级: sudo bash $INSTALL_ROOT/upgrade.sh --bundle <URL>"
