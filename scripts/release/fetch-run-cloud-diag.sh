#!/usr/bin/env bash
# PD-SAAS-FORK: 从 OSS tar 解压并执行 run-cloud-diag.sh（ECS 粘贴一行即可）
set -euo pipefail
TAR_URL="${CLOUD_DIAG_TAR_URL:-https://webui-media.oss-cn-beijing.aliyuncs.com/cloud-diag-upload.tar.gz}"
WORK="${CLOUD_DIAG_WORK_DIR:-/tmp/nova-cloud-diag}"
NOVA_OSS_BASE="${NOVA_OSS_BASE:-https://webui-media.oss-cn-beijing.aliyuncs.com/nova-ai-studio}"
TMP_TAR="${TMPDIR:-/tmp}/cloud-diag-upload.tar.gz"

echo "[cloud-diag-fetch] 下载 ${TAR_URL}"
curl -fsSL "$TAR_URL" -o "$TMP_TAR"
rm -rf "$WORK"
mkdir -p "$WORK"
tar -xzf "$TMP_TAR" -C "$WORK"
echo "[cloud-diag-fetch] 解压 → ${WORK}"
exec env NOVA_OSS_BASE="$NOVA_OSS_BASE" bash "$WORK/run-cloud-diag.sh" "$@"
