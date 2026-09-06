#!/usr/bin/env bash
# PD-SAAS-FORK: 升级后校验云端运行时（文档导出 + Redis + 导出脚本）
set -euo pipefail

COMPOSE_FILE="${1:-docker-compose.prod.yml}"
ENV_FILE="${2:-/opt/nova-ai-studio/.env}"
SERVICE="${3:-nova}"
INSTALL_ROOT="$(dirname "$ENV_FILE")"

cd "$INSTALL_ROOT/current" 2>/dev/null || cd /opt/nova-ai-studio/current

echo "[nova] ========== 云端运行时校验 =========="

# 1) 文档导出（PDF / DOCX / PPTX）
if [[ -f "$INSTALL_ROOT/verify-export-runtime.sh" ]]; then
  bash "$INSTALL_ROOT/verify-export-runtime.sh" "$COMPOSE_FILE" "$ENV_FILE" "$SERVICE" || true
else
  echo "[nova] 警告: 缺少 verify-export-runtime.sh" >&2
fi

check_in_container() {
  local label="$1"
  shift
  if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T "$SERVICE" sh -c "$*" 2>/dev/null; then
    echo "[nova] ✓ $label"
    return 0
  fi
  echo "[nova] ✗ $label" >&2
  return 1
}

FAIL=0

check_in_container "ui/src/shared 导出模块" \
  'test -f /app/ui/src/shared/resolveExportScope.ts && test -f /app/ui/src/shared/documentExportMatrix.ts' \
  || FAIL=1

check_in_container "PDF 导出脚本 html-to-pdf.mjs" \
  'test -f /app/scripts/export-document/html-to-pdf.mjs' || FAIL=1

check_in_container "DOCX 导出脚本 ir-to-docx.mjs" \
  'test -f /app/scripts/export-document/ir-to-docx.mjs' || FAIL=1

check_in_container "PPTX 导出脚本 ir-to-pptx.py" \
  'test -f /app/scripts/export-document/ir-to-pptx.py' || FAIL=1

check_in_container "python3 Pillow（PPT/图片）" \
  'python3 -c "from PIL import Image"' || FAIL=1

check_in_container "python3 requests" \
  'python3 -c "import requests"' || FAIL=1

check_in_container "Node sharp（缩略图）" \
  'node --input-type=module -e "import sharp from \"sharp\"; await sharp({create:{width:2,height:2,channels:3,background:\"#000\"}}).webp().toBuffer(); console.log(\"sharp ok\")"' || FAIL=1

# PD-SAAS-FORK P0-5: exercise the real task.local route, CSP, external
# interception, Chromium context hardening, semaphore, and PNG write path.
check_in_container "Chromium task.local 离线渲染" \
  'test -f /app/scripts/release/verify-task-local-render.mjs && command -v tsx >/dev/null && tsx /app/scripts/release/verify-task-local-render.mjs | grep -q TASK_LOCAL_RENDER_SMOKE_OK' \
  || FAIL=1

check_in_container "图片 Cache-Control 模块" \
  'test -f /app/ui/server/utils/projectFileCacheHeaders.js' || FAIL=1

check_in_container "缩略图生成模块" \
  'test -f /app/ui/server/utils/projectThumbnail.js' || FAIL=1

check_in_container "Gateway patchHiddenConsole 运行时" \
  'test -f /app/dist/scripts/lib/patchHiddenConsole.mjs' || FAIL=1
check_in_container "Gateway mcpFeatureFlags 运行时" \
  'test -f /app/dist/scripts/lib/mcpFeatureFlags.mjs' || FAIL=1

check_in_container "runtime feature flags route" \
  'test -f /app/ui/server/routes/runtimeFeatureFlags.js' || FAIL=1

check_in_container "ffmpeg available" \
  'ffmpeg -version | head -1' || FAIL=1

check_in_container "HyperFrames CLI" \
  'command -v hyperframes >/dev/null && hyperframes --version >/dev/null' \
  || FAIL=1

check_in_container "export snapshot envelope module" \
  'test -f /app/ui/src/shared/exportSnapshotEnvelope.ts' || FAIL=1

# 导出运行时 flags 必须随容器 env 生效；仅改 .env 后 restart 不会刷新容器环境。
for key in \
  PILOTDECK_EXPORT_SNAPSHOT_V2 \
  PILOTDECK_UI_EXPORT_SNAPSHOT_V2 \
  PILOTDECK_UI_DELIVERABLE_CERTIFICATE \
  PILOTDECK_UI_EXPORT_USER_AUDIT_MODES; do
  value="$(
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
      exec -T "$SERVICE" printenv "$key" 2>/dev/null | tr -d '\r' || true
  )"
  case "$value" in
    0|1|true|false|on|off)
      echo "[nova] ✓ $key=$value"
      ;;
    '')
      echo "[nova] ✗ $key 未注入容器环境" >&2
      FAIL=1
      ;;
    *)
      echo "[nova] ✗ $key=$value 非法（仅允许 0|1|true|false|on|off）" >&2
      FAIL=1
      ;;
  esac
done

# Redis（注册验证码等）
if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; then
  echo "[nova] ✓ Redis PONG"
else
  echo "[nova] ✗ Redis 不可用（注册验证码可能降级内存）" >&2
  FAIL=1
fi

# HTTPS（宿主机 Nginx，非容器）
if [[ -f "$INSTALL_ROOT/https-aliyun.env" ]]; then
  if ss -tlnp 2>/dev/null | grep -q ':443 '; then
    echo "[nova] ✓ Nginx 监听 443（https-aliyun.env 已配置）"
  else
    echo "[nova] ✗ 已配置 https-aliyun.env 但 443 未监听 — 运行 install-ssl-https.sh 或 recover-https-aliyun.sh" >&2
    FAIL=1
  fi
else
  echo "[nova] ⚠ HTTPS 未配置（无 https-aliyun.env）；可用 install-ssl-https.sh 或 recover-https-aliyun.sh"
fi

# Nginx 项目图边缘缓存（宿主机）
if [[ -f /etc/nginx/nova-locations.conf ]]; then
  if grep -q '/files/content' /etc/nginx/nova-locations.conf \
    && grep -q '/files/thumbnail' /etc/nginx/nova-locations.conf \
    && grep -q 'proxy_cache nova_static' /etc/nginx/nova-locations.conf; then
    echo "[nova] ✓ Nginx 项目图/缩略图 proxy_cache 已配置"
  else
    echo "[nova] ✗ Nginx 缺少项目图缓存 location — 运行 upgrade 或 cp current/nginx-nova-locations.conf" >&2
    FAIL=1
  fi
  if [[ ! -f /etc/nginx/conf.d/00-nova-cache-http.conf ]]; then
    echo "[nova] ⚠ 缺少 00-nova-cache-http.conf（proxy_cache_path）；apply_nova_nginx_site 可修复" >&2
  fi
else
  echo "[nova] ⚠ 未找到 /etc/nginx/nova-locations.conf"
fi

# 可选：MinerU OCR PPTX（扫描件转可编辑 PPT，需额外配置）
if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T "$SERVICE" \
  test -f /app/scripts/ocr-to-editable-pptx.py 2>/dev/null; then
  echo "[nova] ℹ OCR 可编辑 PPTX 脚本已打包（需 MINERU_* 等 Key 才可用）"
fi

echo "[nova] ====================================="
if [[ "$FAIL" -ne 0 ]]; then
  echo "[nova] 运行时校验有失败项 — 建议 docker compose build --no-cache nova 后重试" >&2
  exit 1
fi
echo "[nova] 云端运行时校验通过"
