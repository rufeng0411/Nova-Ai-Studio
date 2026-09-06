#!/usr/bin/env bash
# PD-SAAS-FORK: Sync showcase demo media into DATA_ROOT only (never tenants / chats).
# Usage:
#   sudo bash sync-showcase-data.sh --bundle https://.../showcase-data.tar.gz
#   sudo bash sync-showcase-data.sh --local /path/to/showcase-data.tar.gz
set -euo pipefail

INSTALL_ROOT="${INSTALL_ROOT:-/opt/nova-ai-studio}"
ENV_FILE="${INSTALL_ROOT}/.env"
BUNDLE_URL=""
LOCAL_TAR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bundle) BUNDLE_URL="${2:-}"; shift 2 ;;
    --local) LOCAL_TAR="${2:-}"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

# Host DATA_ROOT for compose mount (container sees /data/saas)
HOST_DATA_ROOT="${HOST_DATA_ROOT:-/var/lib/nova/saas}"
if [[ -n "${DATA_ROOT:-}" && -d "${DATA_ROOT}" && "${DATA_ROOT}" != /data/saas ]]; then
  HOST_DATA_ROOT="${DATA_ROOT}"
fi

SHOWCASE_DIR="${HOST_DATA_ROOT}/marketing-showcase"
TMP_DIR="$(mktemp -d /tmp/nova-showcase-XXXXXX)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

TAR_PATH=""
if [[ -n "$LOCAL_TAR" ]]; then
  TAR_PATH="$LOCAL_TAR"
elif [[ -n "$BUNDLE_URL" ]]; then
  TAR_PATH="${TMP_DIR}/showcase-data.tar.gz"
  echo "[sync-showcase] download ${BUNDLE_URL}"
  curl -fsSL "$BUNDLE_URL" -o "$TAR_PATH"
else
  echo "Usage: $0 --bundle <url> | --local <tar.gz>" >&2
  exit 1
fi

if [[ ! -f "$TAR_PATH" ]]; then
  echo "[sync-showcase] missing tar: $TAR_PATH" >&2
  exit 1
fi

mkdir -p "$SHOWCASE_DIR"
echo "[sync-showcase] extract → ${SHOWCASE_DIR} (tenants untouched)"
# Archive root is marketing-showcase/ or flat media/
tar -tzf "$TAR_PATH" | head -n 5
if tar -tzf "$TAR_PATH" | head -n 1 | grep -q '^marketing-showcase/'; then
  tar -xzf "$TAR_PATH" -C "$(dirname "$SHOWCASE_DIR")"
else
  tar -xzf "$TAR_PATH" -C "$SHOWCASE_DIR"
fi

echo "[sync-showcase] done. Recreate nova to pick up overlay if needed:"
echo "  cd ${INSTALL_ROOT}/current && docker compose -f docker-compose.prod.yml --env-file ${ENV_FILE} up -d --no-deps --force-recreate nova"
