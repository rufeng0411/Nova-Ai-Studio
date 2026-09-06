#!/usr/bin/env bash
# PD-SAAS-FORK: ECS 一键云端诊断（verify-cloud-perf + PG/Redis + messages 延迟）
#
# 推荐（整包 tar，Bucket 根目录）：
#   curl -fsSL "https://webui-media.oss-cn-beijing.aliyuncs.com/cloud-diag-upload.tar.gz" -o /tmp/cloud-diag.tgz
#   sudo mkdir -p /tmp/nova-cloud-diag && sudo tar -xzf /tmp/cloud-diag.tgz -C /tmp/nova-cloud-diag
#   sudo bash /tmp/nova-cloud-diag/run-cloud-diag.sh
#
# 或 nova-ai-studio 前缀下单脚本：
#   curl -fsSL "https://<bucket>.<endpoint>/nova-ai-studio/run-cloud-diag.sh" | sudo bash -s --
#
# 环境变量（可选）：
#   INSTALL_ROOT=/opt/nova-ai-studio
#   NOVA_OSS_BASE=https://.../nova-ai-studio   # 无本地 verify 脚本时从 OSS 拉
#   DIAG_USER=admin  DIAG_PASS=SAAS_ADMIN_PASSWORD
#   DIAG_BRIDGE_BASE=http://127.0.0.1:3001
#   PROD_BASE_URL=https://www.novapage.online
set -euo pipefail

INSTALL_ROOT="${INSTALL_ROOT:-/opt/nova-ai-studio}"
ENV_FILE="${ENV_FILE:-$INSTALL_ROOT/.env}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
DIAG_USER="${DIAG_USER:-admin}"
DIAG_PASS="${DIAG_PASS:-SAAS_ADMIN_PASSWORD}"
DIAG_BRIDGE_BASE="${DIAG_BRIDGE_BASE:-http://127.0.0.1:3001}"
PROD_BASE_URL="${PROD_BASE_URL:-https://www.novapage.online}"
NOVA_OSS_BASE="${NOVA_OSS_BASE:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"

FAIL=0
WARN=0

mark_ok() { echo "[cloud-diag] ✓ $1"; }
mark_warn() { echo "[cloud-diag] ⚠ $1" >&2; WARN=$((WARN + 1)); }
mark_fail() { echo "[cloud-diag] ✗ $1" >&2; FAIL=$((FAIL + 1)); }

echo "[cloud-diag] ========== Nova 云端对话加载诊断 =========="
echo "[cloud-diag] Bridge=${DIAG_BRIDGE_BASE} 对外=${PROD_BASE_URL} 用户=${DIAG_USER}"

# ── 1) verify-cloud-perf（与 pack 同源）──
PERF_SCRIPT=""
for candidate in "$SCRIPT_DIR/verify-cloud-perf.sh" "$INSTALL_ROOT/verify-cloud-perf.sh" "$INSTALL_ROOT/current/verify-cloud-perf.sh"; do
  if [[ -f "$candidate" ]]; then PERF_SCRIPT="$candidate"; break; fi
done
if [[ -z "$PERF_SCRIPT" && -n "$NOVA_OSS_BASE" ]]; then
  mark_ok "从 OSS 拉取 verify-cloud-perf.sh"
  curl -fsSL "${NOVA_OSS_BASE%/}/verify-cloud-perf.sh" -o /tmp/verify-cloud-perf.sh
  PERF_SCRIPT="/tmp/verify-cloud-perf.sh"
fi
if [[ -n "$PERF_SCRIPT" ]]; then
  echo "[cloud-diag] --- verify-cloud-perf ---"
  if bash "$PERF_SCRIPT" "$COMPOSE_FILE" "$ENV_FILE" nova; then
    mark_ok "verify-cloud-perf 通过"
  else
    mark_fail "verify-cloud-perf 未通过（见上方 [nova-perf] 输出）"
  fi
else
  mark_fail "找不到 verify-cloud-perf.sh（设 NOVA_OSS_BASE 或先 upgrade）"
fi

# ── 2) 容器 / Redis / 控制库 ──
echo "[cloud-diag] --- 基础设施 ---"
docker ps --format 'table {{.Names}}\t{{.Status}}' 2>&1 | head -20 || true

if docker ps --format '{{.Names}}' | grep -qx 'nova-redis'; then
  REDIS_PING="$(docker exec nova-redis redis-cli ping 2>/dev/null | tr -d '\r' || true)"
  if [[ "$REDIS_PING" == "PONG" ]]; then
    mark_ok "Redis PONG"
  else
    mark_fail "Redis 无响应: ${REDIS_PING:-empty}"
  fi
else
  mark_warn "nova-redis 容器未运行"
fi

if docker ps --format '{{.Names}}' | grep -qx 'nova-ai-studio'; then
  PG_OUT="$(docker exec -i nova-ai-studio node --input-type=module -e "
import { openControlDatabase, getControlDbBackend } from '/app/ui/server/saas/db/control.js';
try {
  const backend = getControlDbBackend();
  const db = await openControlDatabase();
  const ping = await db.ping();
  let catalog = 0;
  const r = await db.queryOne('SELECT COUNT(*) AS c FROM conversation_catalog WHERE deleted_at IS NULL');
  catalog = Number(r?.c ?? 0);
  console.log('DB_BACKEND=' + backend);
  console.log('DB_PING=' + (ping ? 'ok' : 'fail'));
  console.log('CATALOG_ROWS=' + catalog);
  console.log('HAS_PG_URL=' + (process.env.SAAS_DATABASE_URL ? '1' : '0'));
} catch (e) {
  console.log('PG_ERR=' + (e?.message || e));
}
" 2>/dev/null | tr -d '\r' || true)"
  DB_BACKEND="$(echo "$PG_OUT" | grep '^DB_BACKEND=' | cut -d= -f2 || echo unknown)"
  DB_PING="$(echo "$PG_OUT" | grep '^DB_PING=' | cut -d= -f2 || echo fail)"
  CATALOG_ROWS="$(echo "$PG_OUT" | grep '^CATALOG_ROWS=' | cut -d= -f2 || echo 0)"
  if echo "$PG_OUT" | grep -q '^PG_ERR='; then
    mark_fail "控制库: $(echo "$PG_OUT" | grep '^PG_ERR=' | cut -d= -f2-)"
  elif [[ "$DB_PING" == "ok" ]]; then
    mark_ok "控制库 ${DB_BACKEND} ping=ok catalog=${CATALOG_ROWS}"
    if [[ "$DB_BACKEND" == "sqlite" ]]; then
      mark_warn "生产建议 PostgreSQL（当前 sqlite）"
    fi
  else
    mark_fail "控制库 ping 失败 backend=${DB_BACKEND}"
  fi
else
  mark_fail "nova-ai-studio 未运行"
fi

# ── 3) messages API 延迟（Bridge 本机，admin 默认账密）──
echo "[cloud-diag] --- messages API（Bridge ${DIAG_BRIDGE_BASE}）---"
if ! command -v python3 >/dev/null 2>&1; then
  mark_warn "无 python3，跳过 messages 延迟抽样"
else
  PYTHON_OUT="$(DIAG_BRIDGE_BASE="$DIAG_BRIDGE_BASE" DIAG_USER="$DIAG_USER" DIAG_PASS="$DIAG_PASS" python3 << 'PY'
import json, os, time, urllib.error, urllib.parse, urllib.request

base = os.environ.get("DIAG_BRIDGE_BASE", "http://127.0.0.1:3001").rstrip("/")
user = os.environ.get("DIAG_USER", "admin")
password = os.environ.get("DIAG_PASS", "SAAS_ADMIN_PASSWORD")

def req(method, path, body=None, token=None):
    url = f"{base}{path}"
    data = None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        data = json.dumps(body).encode()
    t0 = time.perf_counter()
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(r, timeout=120) as resp:
        raw = resp.read()
    ms = int((time.perf_counter() - t0) * 1000)
    return ms, json.loads(raw.decode() or "null")

try:
    ms, login = req("POST", "/api/auth/login", {"username": user, "password": password})
    token = login.get("token")
    if not token:
        print(f"LOGIN_FAIL ms={ms}")
        raise SystemExit(0)
    print(f"LOGIN_OK ms={ms}")

    ms, health = req("GET", "/api/saas/health", token=token)
    print(f"HEALTH ms={ms} backend={health.get('backend')} db={health.get('db')}")

    ms, projects = req("GET", "/api/projects", token=token)
    if not isinstance(projects, list):
        projects = projects.get("projects") or []
    print(f"PROJECTS ms={ms} count={len(projects)}")

    samples = []
    for p in projects:
        name = p.get("name") or p.get("id")
        for s in (p.get("sessions") or [])[:2]:
            sid = s.get("id") or s.get("sessionId")
            if sid:
                samples.append((name, sid, s.get("title") or sid))
        if len(samples) >= 2:
            break
    samples = samples[:2]

    if not samples:
        print("NO_SESSIONS")
        raise SystemExit(0)

    for project_name, session_id, title in samples:
        times = []
        kb = 0
        total = 0
        path = f"/api/sessions/{urllib.parse.quote(session_id, safe='')}/messages?projectName={urllib.parse.quote(project_name, safe='')}&limit=120&direction=backward"
        for i in range(5):
            t0 = time.perf_counter()
            url = f"{base}{path}"
            r = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
            with urllib.request.urlopen(r, timeout=120) as resp:
                raw = resp.read()
            ms = int((time.perf_counter() - t0) * 1000)
            times.append(ms)
            body = json.loads(raw.decode())
            kb = max(kb, len(raw) // 1024)
            total = int(body.get("total") or 0)
        times.sort()
        p50 = times[len(times) // 2]
        p95 = times[max(0, int(len(times) * 0.95) - 1)]
        short = (title[:40] + "…") if len(title) > 40 else title
        print(f"TAIL120 project={project_name} session={session_id[:16]} p50={p50} p95={p95} kb={kb} total={total} title={short}")
except urllib.error.HTTPError as e:
    print(f"HTTP_ERR code={e.code} body={e.read()[:200]!r}")
except Exception as e:
    print(f"PY_ERR {e}")
PY
)"
  echo "$PYTHON_OUT"
  if echo "$PYTHON_OUT" | grep -q '^LOGIN_FAIL'; then
    mark_fail "Bridge 登录失败（检查 DIAG_USER/DIAG_PASS）"
  elif echo "$PYTHON_OUT" | grep -q '^NO_SESSIONS'; then
    mark_warn "无会话可抽样 messages"
  elif echo "$PYTHON_OUT" | grep -q '^TAIL120'; then
    while IFS= read -r line; do
      [[ "$line" != TAIL120* ]] && continue
      p95="$(echo "$line" | sed -n 's/.*p95=\([0-9]*\).*/\1/p')"
      kb="$(echo "$line" | sed -n 's/.*kb=\([0-9]*\).*/\1/p')"
      if [[ -n "$p95" && "$p95" -ge 3000 ]]; then
        mark_fail "tail120 过慢 p95=${p95}ms — ${line#TAIL120 }"
      elif [[ -n "$p95" && "$p95" -ge 1500 ]]; then
        mark_warn "tail120 偏慢 p95=${p95}ms — ${line#TAIL120 }"
      elif [[ -n "$kb" && "$kb" -ge 1024 ]]; then
        mark_fail "tail120 载荷过大 ${kb}KB — 检查 SANITIZE"
      elif [[ -n "$kb" && "$kb" -ge 500 ]]; then
        mark_warn "tail120 载荷 ${kb}KB — 建议 PILOTDECK_HISTORY_SANITIZE=1"
      else
        mark_ok "tail120 — ${line#TAIL120 }"
      fi
    done <<< "$PYTHON_OUT"
  else
    mark_warn "messages 抽样未完成"
  fi
fi

echo "[cloud-diag] ====================================="
if [[ "$FAIL" -gt 0 ]]; then
  echo "[cloud-diag] 失败 ${FAIL} 项 / 警告 ${WARN} 项" >&2
  echo "[cloud-diag] 修复: sudo bash ${INSTALL_ROOT}/apply-cloud-perf-env.sh && docker compose restart nova-ai-studio" >&2
  exit 1
fi
if [[ "$WARN" -gt 0 ]]; then
  echo "[cloud-diag] 完成（${WARN} 项警告）"
  exit 0
fi
echo "[cloud-diag] 全部通过"
exit 0
