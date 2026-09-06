#!/usr/bin/env bash
# PD-SAAS-FORK: 容器内校验 PDF/PPT 导出运行时（Playwright + python-pptx）
set -euo pipefail

COMPOSE_FILE="${1:-docker-compose.prod.yml}"
ENV_FILE="${2:-/opt/nova-ai-studio/.env}"
SERVICE="${3:-nova}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[nova] verify-export: 缺少 $ENV_FILE" >&2
  exit 1
fi

cd "$(dirname "$ENV_FILE")/current" 2>/dev/null || cd /opt/nova-ai-studio/current

echo "[nova] 校验文档导出运行时..."
if ! docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T "$SERVICE" \
  python3 -c "import pptx; print('python-pptx ok')" 2>/dev/null; then
  echo "[nova] 警告: python-pptx 不可用，PPT 导出会失败（请确认镜像已 --no-cache 重建）" >&2
  EXPORT_OK=0
else
  EXPORT_OK=1
fi

if ! docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T "$SERVICE" \
  sh -c 'npx playwright --version >/dev/null 2>&1 && test -d "$HOME/.cache/ms-playwright"' 2>/dev/null; then
  echo "[nova] 警告: Playwright/Chromium 未就绪，PDF 导出会失败" >&2
  EXPORT_OK=0
fi

if [[ "${EXPORT_OK:-1}" == "1" ]]; then
  echo "[nova] 文档导出运行时 OK"
fi
