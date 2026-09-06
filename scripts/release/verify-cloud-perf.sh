#!/usr/bin/env bash
# PD-SAAS-FORK: 云端首访/历史对话卡顿 — 配置与 conversation_catalog 对齐检查
set -euo pipefail

COMPOSE_FILE="${1:-docker-compose.prod.yml}"
ENV_FILE="${2:-/opt/nova-ai-studio/.env}"
SERVICE="${3:-nova}"
INSTALL_ROOT="$(dirname "$ENV_FILE")"

cd "$INSTALL_ROOT/current" 2>/dev/null || cd /opt/nova-ai-studio/current

echo "[nova-perf] ========== 云端性能配置检查 =========="

FAIL=0
WARN=0

mark_ok() { echo "[nova-perf] ✓ $1"; }
mark_warn() { echo "[nova-perf] ⚠ $1" >&2; WARN=$((WARN + 1)); }
mark_fail() { echo "[nova-perf] ✗ $1" >&2; FAIL=$((FAIL + 1)); }

# 生产容器名固定 nova-ai-studio；--no-deps 重建后 compose exec 易挂起，优先 docker exec
container_exec() {
  if docker ps --format '{{.Names}}' | grep -qx 'nova-ai-studio'; then
    timeout 30 docker exec nova-ai-studio "$@" 2>/dev/null || true
    return
  fi
  timeout 30 docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T "$SERVICE" "$@" 2>/dev/null || true
}

env_val() {
  local key="$1"
  container_exec printenv "$key" | tr -d '\r'
}

host_env_val() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r' || true
}

# ── 1) 会话目录加速（conversation_catalog）──
CATALOG_READ="$(env_val SAAS_CONVERSATION_CATALOG)"
CATALOG_SHADOW="$(env_val SAAS_CONVERSATION_CATALOG_SHADOW)"
if [[ "$CATALOG_READ" == "1" ]]; then
  mark_ok "SAAS_CONVERSATION_CATALOG=1（侧栏/历史读数据库，非扫盘）"
else
  mark_fail "SAAS_CONVERSATION_CATALOG 未设为 1 — 侧栏仍扫 jsonl 目录，首访/翻页会卡"
  echo "           修复: echo 'SAAS_CONVERSATION_CATALOG=1' | sudo tee -a $ENV_FILE" >&2
fi
if [[ "$CATALOG_SHADOW" == "1" || "$CATALOG_READ" == "1" ]]; then
  mark_ok "catalog 影子写入已开（SHADOW=$CATALOG_SHADOW）"
else
  mark_fail "SAAS_CONVERSATION_CATALOG_SHADOW 未开 — catalog 表不会自动同步"
  echo "           修复: echo 'SAAS_CONVERSATION_CATALOG_SHADOW=1' | sudo tee -a $ENV_FILE" >&2
fi

# ── 2) Redis 与 API 缓存 TTL ──
REDIS_URL_VAL="$(env_val REDIS_URL)"
if [[ -n "$REDIS_URL_VAL" ]]; then
  mark_ok "REDIS_URL 已配置"
else
  mark_fail "REDIS_URL 未配置 — 能力/项目列表缓存降级内存"
fi
for key in CACHE_TTL_CAPABILITIES_SEC CACHE_TTL_PROJECTS_SEC; do
  val="$(env_val "$key")"
  if [[ -n "$val" ]]; then
    mark_ok "$key=$val"
  else
    mark_warn "$key 未设（建议 capabilities=600 projects=60）"
  fi
done

# ── 3) 消息尾部分页（构建时写入前端，非运行时 env）──
# buildTailFetchQueryParams 会 append direction=backward；Vite 分包后常在 ChatInterfaceV2 或 index chunk，
# 勿只 grep AppShellV2；勿 grep limit=120（压缩后常不可见）。
TAIL_CHUNK="$(container_exec sh -c 'grep -l "append(\"direction\"" /app/ui/dist/assets/*.js 2>/dev/null | head -1' | tr -d '\r')"
INDEX_HTML="$(container_exec cat /app/ui/dist/index.html | tr -d '\r')"
INDEX_JS="$(echo "$INDEX_HTML" | grep -oE 'assets/index-[^"]+\.js' | head -1 || true)"
if [[ -n "$TAIL_CHUNK" ]]; then
  mark_ok "前端尾部分页已启用（bundle 含 direction=backward 请求）"
elif [[ -n "$INDEX_JS" ]]; then
  mark_fail "前端 bundle 未检测到尾部分页 — 打开长对话会一次拉全量消息"
  echo "           需 pack 时 VITE_TAIL_MESSAGE_PAGINATION=true 并 upgrade" >&2
else
  mark_warn "无法读取 index.html / 前端 chunk"
fi

# ── 4) conversation_catalog 表与 jsonl 对齐 ──
CATALOG_STATS="$(container_exec node --input-type=module -e "
import { openControlDatabase } from '/app/ui/server/saas/db/control.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const db = await openControlDatabase();
let catalogRows = 0;
let outboxRows = 0;
let jsonlCount = 0;
try {
  const r = await db.queryOne('SELECT COUNT(*) AS c FROM conversation_catalog WHERE deleted_at IS NULL');
  catalogRows = Number(r?.c ?? 0);
} catch (e) {
  console.log('CATALOG_TABLE_ERR=' + (e?.message || e));
}
try {
  const o = await db.queryOne('SELECT COUNT(*) AS c FROM conversation_catalog_outbox');
  outboxRows = Number(o?.c ?? 0);
} catch { /* optional */ }
const dataRoot = process.env.DATA_ROOT || '/data/saas';
async function walk(dir) {
  let n = 0;
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return 0; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) n += await walk(p);
    else if (e.name.endsWith('.jsonl')) n += 1;
  }
  return n;
}
jsonlCount = await walk(path.join(dataRoot, 'tenants'));
console.log('CATALOG_ROWS=' + catalogRows);
console.log('JSONL_COUNT=' + jsonlCount);
console.log('OUTBOX=' + outboxRows);
" 2>/dev/null | tr -d '\r' || true)"

CATALOG_ROWS="$(echo "$CATALOG_STATS" | grep '^CATALOG_ROWS=' | cut -d= -f2 || echo 0)"
JSONL_COUNT="$(echo "$CATALOG_STATS" | grep '^JSONL_COUNT=' | cut -d= -f2 || echo 0)"
OUTBOX="$(echo "$CATALOG_STATS" | grep '^OUTBOX=' | cut -d= -f2 || echo 0)"

if echo "$CATALOG_STATS" | grep -q 'CATALOG_TABLE_ERR'; then
  mark_fail "conversation_catalog 表不可用 — 迁移可能未跑"
else
  mark_ok "conversation_catalog 活跃行: ${CATALOG_ROWS:-0} / 磁盘 jsonl: ${JSONL_COUNT:-0}"
  if [[ "${JSONL_COUNT:-0}" -gt 0 && "${CATALOG_ROWS:-0}" -eq 0 ]]; then
    mark_fail "catalog 为空但 jsonl 存在 — 需 backfill"
    echo "           修复: docker exec nova-ai-studio tsx /app/scripts/backfill-conversation-catalog.mjs" >&2
  elif [[ "${JSONL_COUNT:-0}" -gt 0 ]]; then
    if [[ "${CATALOG_ROWS:-0}" -ge "${JSONL_COUNT:-0}" ]]; then
      mark_ok "catalog 行数 ≥ jsonl 文件数（多用户各有一份索引，正常）"
    else
      ratio=$(( CATALOG_ROWS * 100 / JSONL_COUNT ))
      if [[ "$ratio" -lt 80 ]]; then
        mark_warn "catalog 覆盖率约 ${ratio}% — 建议 backfill"
      else
        mark_ok "catalog 覆盖率约 ${ratio}%"
      fi
    fi
  fi
  if [[ "${OUTBOX:-0}" -gt 0 ]]; then
    mark_warn "catalog outbox 待重试: ${OUTBOX} 条"
  fi
fi

# ── 5) 历史 messages 加速 flag ──
HIST_SAN="$(env_val PILOTDECK_HISTORY_SANITIZE)"
HIST_TAIL="$(env_val PILOTDECK_HISTORY_TAIL_READ)"
HIST_CACHE="$(env_val PILOTDECK_HISTORY_MESSAGE_CACHE)"
if [[ "$HIST_SAN" == "1" ]]; then
  mark_ok "PILOTDECK_HISTORY_SANITIZE=1（历史 API 载荷瘦身）"
else
  mark_warn "PILOTDECK_HISTORY_SANITIZE 未开 — 重会话 messages 仍可能 >5MB"
fi
if [[ "$HIST_TAIL" == "1" ]]; then
  mark_ok "PILOTDECK_HISTORY_TAIL_READ=1（JSONL 真尾读）"
else
  mark_warn "PILOTDECK_HISTORY_TAIL_READ 未开 — 服务端仍可能全量 parse jsonl"
fi
if [[ "$HIST_CACHE" == "1" ]]; then
  mark_ok "PILOTDECK_HISTORY_MESSAGE_CACHE=1"
fi

# ── 6) Nginx 图缓存（成果预览卡顿）──
if [[ -f /etc/nginx/nova-locations.conf ]] \
  && grep -q '/files/thumbnail' /etc/nginx/nova-locations.conf \
  && grep -q 'proxy_cache nova_static' /etc/nginx/nova-locations.conf; then
  mark_ok "Nginx 项目图/缩略图 proxy_cache"
else
  mark_fail "Nginx 图缓存未配置 — 成果图首屏慢"
fi

# ── 7) 冷启动 captcha 探测 ──
START_MS="$(date +%s%3N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000))')"
if curl -sf "http://127.0.0.1:3001/api/saas/captcha" >/dev/null 2>&1; then
  END_MS="$(date +%s%3N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000))')"
  ELAPSED=$(( END_MS - START_MS ))
  if [[ "$ELAPSED" -lt 500 ]]; then
    mark_ok "Bridge captcha ${ELAPSED}ms"
  else
    mark_warn "Bridge captcha ${ELAPSED}ms（偏慢，可能冷启动或负载高）"
  fi
else
  mark_fail "127.0.0.1:3001 captcha 不可达"
fi

# ── 8) 会话切换 / 并发优化 env ──
for key in \
  PILOTDECK_REQUEST_BACKPRESSURE \
  PILOTDECK_BACKPRESSURE_MESSAGES \
  PILOTDECK_BACKPRESSURE_PROJECTS \
  PILOTDECK_GATEWAY_MAX_CONCURRENT_TURNS \
  PILOTDECK_USER_MAX_ACTIVE_TURNS \
  PILOTDECK_TURN_QUEUE \
  SAAS_SIDEBAR_DEFAULT_DAYS \
  PILOTDECK_LOGIN_RATE_LIMIT_IP \
  PILOTDECK_LOGIN_RATE_LIMIT_USER; do
  val="$(env_val "$key")"
  if [[ -n "$val" ]]; then
    mark_ok "$key=$val"
  else
    mark_warn "$key 未设（会话切换优化建议见 docs/session-switch-optimization-spec.zh-CN.md）"
  fi
done

PIPELINE_BUNDLE="$(container_exec sh -c 'grep -l "sessionDeliverablePipeline" /app/ui/dist/assets/*.js 2>/dev/null | head -1' | tr -d '\r')"
if [[ -n "$PIPELINE_BUNDLE" ]]; then
  mark_ok "前端 sessionDeliverablePipeline bundle 已打包"
else
  mark_warn "未检测到 sessionDeliverablePipeline bundle（需 pack 注入 VITE_SESSION_PIPELINE_BUNDLE）"
fi

# ── 9) 导出快照 v2 运行时 UI flag ──
for key in \
  PILOTDECK_EXPORT_SNAPSHOT_V2 \
  PILOTDECK_UI_EXPORT_SNAPSHOT_V2 \
  PILOTDECK_UI_DELIVERABLE_CERTIFICATE \
  PILOTDECK_UI_EXPORT_USER_AUDIT_MODES; do
  val="$(env_val "$key")"
  host_val="$(host_env_val "$key")"
  merged="${val:-$host_val}"
  case "$merged" in
    0|1|true|false|on|off)
      mark_ok "$key=${merged}"
      ;;
    '')
      mark_fail "$key 未设 — 生产第一阶段须显式为 0"
      ;;
    *)
      mark_fail "$key=${merged} 非法（仅允许 0|1|true|false|on|off）"
      ;;
  esac
done

# ── 10) Preflight / Bento 平台功能开关（默认关）──
PREFLIGHT_VAL="$(env_val PILOTDECK_PREFLIGHT_STUDIO)"
PREFLIGHT_HOST="$(host_env_val PILOTDECK_PREFLIGHT_STUDIO)"
PREFLIGHT_MERGED="${PREFLIGHT_VAL:-$PREFLIGHT_HOST}"
case "$PREFLIGHT_MERGED" in
  off|0|false)
    mark_ok "PILOTDECK_PREFLIGHT_STUDIO=${PREFLIGHT_MERGED:-off}（模板选型默认关）"
    ;;
  shadow|enforce|1|true|on)
    mark_warn "PILOTDECK_PREFLIGHT_STUDIO=${PREFLIGHT_MERGED} — 仍为开启；默认关请跑 apply-cloud-perf-env.sh"
    ;;
  '')
    mark_ok "PILOTDECK_PREFLIGHT_STUDIO 未设（读 platform-features.json，默认 off）"
    ;;
  *)
    mark_fail "PILOTDECK_PREFLIGHT_STUDIO=${PREFLIGHT_MERGED} 非法"
    ;;
esac

for key in PILOTDECK_BENTO_DECK_EDITOR VITE_BENTO_DECK_PREVIEW; do
  val="$(env_val "$key")"
  host_val="$(host_env_val "$key")"
  merged="${val:-$host_val}"
  case "$merged" in
    0|false|off)
      mark_ok "$key=${merged}"
      ;;
    1|true|on)
      mark_warn "$key=${merged} — Bento 编辑器仍为开启；默认关请跑 apply-cloud-perf-env.sh"
      ;;
    '')
      [[ "$key" == "PILOTDECK_BENTO_DECK_EDITOR" ]] && mark_ok "$key 未设（默认 off）"
      ;;
    *)
      mark_fail "$key=${merged} 非法"
      ;;
  esac
done

# ── 11) Public Markdown share flag + nginx /s/ ──
MD_SHARE_VAL="$(env_val PILOTDECK_PUBLIC_MD_SHARE)"
MD_SHARE_HOST="$(host_env_val PILOTDECK_PUBLIC_MD_SHARE)"
MD_SHARE_MERGED="${MD_SHARE_VAL:-$MD_SHARE_HOST}"
case "$MD_SHARE_MERGED" in
  off|shadow|enforce)
    mark_ok "PILOTDECK_PUBLIC_MD_SHARE=${MD_SHARE_MERGED}"
    ;;
  0|false)
    mark_ok "PILOTDECK_PUBLIC_MD_SHARE=${MD_SHARE_MERGED}（视为 off）"
    ;;
  1|true|on)
    mark_warn "PILOTDECK_PUBLIC_MD_SHARE=${MD_SHARE_MERGED} — 建议用 off|shadow|enforce"
    ;;
  '')
    mark_warn "PILOTDECK_PUBLIC_MD_SHARE 未设（Bridge fail-closed=off）"
    ;;
  *)
    mark_fail "PILOTDECK_PUBLIC_MD_SHARE=${MD_SHARE_MERGED} 非法（须 off|shadow|enforce）"
    ;;
esac

NGINX_LOC=""
for candidate in \
  "/etc/nginx/nova-locations.conf" \
  "$INSTALL_ROOT/current/deploy/nginx-nova-locations.conf" \
  "$INSTALL_ROOT/deploy/nginx-nova-locations.conf" \
  "/opt/nova-ai-studio/current/deploy/nginx-nova-locations.conf"; do
  if [[ -f "$candidate" ]]; then
    NGINX_LOC="$candidate"
    break
  fi
done
if [[ -n "$NGINX_LOC" ]]; then
  if grep -qE 'location\s+\^~\s+/s/' "$NGINX_LOC"; then
    mark_ok "nginx location ^~ /s/ 已配置（$NGINX_LOC）"
  else
    mark_fail "nginx 缺少 location ^~ /s/（公开 Markdown 分享）: $NGINX_LOC"
  fi
else
  mark_warn "未找到 nginx-nova-locations.conf，跳过 /s/ location 检查"
fi

echo "[nova-perf] ====================================="
if [[ "$FAIL" -gt 0 ]]; then
  echo "[nova-perf] 发现 ${FAIL} 项失败 / ${WARN} 项警告" >&2
  echo "[nova-perf] 常见修复（改 .env 后 recreate Nova 容器）：" >&2
  echo "  SAAS_CONVERSATION_CATALOG=1" >&2
  echo "  SAAS_CONVERSATION_CATALOG_SHADOW=1" >&2
  echo "  PILOTDECK_HISTORY_SANITIZE=1   # 阶段 A，见 docs/history-messages-deploy-runbook.zh-CN.md" >&2
  echo "  PILOTDECK_HISTORY_TAIL_READ=1  # 阶段 B（A 验收后）" >&2
  echo "  PILOTDECK_HISTORY_MESSAGE_CACHE=1  # 阶段 C 可选" >&2
  echo "  CACHE_TTL_CAPABILITIES_SEC=600" >&2
  echo "  CACHE_TTL_PROJECTS_SEC=60" >&2
  echo "  CACHE_TTL_MESSAGES_SEC=120" >&2
  echo "  PILOTDECK_PREFLIGHT_STUDIO=off  # 模板选型默认关" >&2
  echo "  PILOTDECK_BENTO_DECK_EDITOR=0   # Bento 编辑器默认关" >&2
  echo "  PILOTDECK_PUBLIC_MD_SHARE=shadow  # 公开 MD 分享灰度" >&2
  echo "[nova-perf] 或一键: sudo bash /opt/nova-ai-studio/apply-cloud-perf-env.sh" >&2
  exit 1
fi
if [[ "$WARN" -gt 0 ]]; then
  echo "[nova-perf] 通过（${WARN} 项警告，建议优化）"
  exit 0
fi
echo "[nova-perf] 性能配置检查通过"
exit 0
