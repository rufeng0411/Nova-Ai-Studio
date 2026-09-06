#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
export NOVA_REPO_ROOT="$REPO_ROOT"
cd "$REPO_ROOT/tools/nova-launcher"

if ! command -v npm >/dev/null 2>&1; then
  echo "[NovaLauncher] npm 未找到，请先安装 Node.js 20+"
  exit 1
fi

if [[ ! -d "$REPO_ROOT/tools/nova-launcher/node_modules" ]]; then
  echo "[NovaLauncher] 首次运行，正在安装启动器依赖…"
  npm --prefix "$REPO_ROOT/tools/nova-launcher" install
fi

npm --prefix "$REPO_ROOT/tools/nova-launcher" run start
