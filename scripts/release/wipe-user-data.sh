#!/usr/bin/env bash
# Nova Ai-Studio：清空所有用户的对话与文件夹数据（保留账号、租户、计费与 pilotdeck.yaml）
#
# 用法（在服务器上 root/sudo）:
#   sudo bash wipe-user-data.sh              # 交互确认
#   sudo bash wipe-user-data.sh --yes        # 跳过确认（慎用）
#   sudo bash wipe-user-data.sh --backup --yes   # 先打包备份再清空
#
# 清空范围:
#   - 租户项目/对话 JSONL、记忆、云端同步目录
#   - Legacy ~/.pilotdeck/projects、memory
#   - control.db: user_workspaces, storage_sync_jobs, usage_session_owner, sessions
#   - auth.db: session_names（对话自定义标题）
#
# 不清空: users/tenants/密码、订阅与积分、pilotdeck.yaml、skills、.env
set -euo pipefail

INSTALL_ROOT="${INSTALL_ROOT:-/opt/nova-ai-studio}"
DATA_ROOT="${DATA_ROOT:-/var/lib/nova}"
SAAS_ROOT="${SAAS_ROOT:-$DATA_ROOT/saas}"
PILOT_HOME="${PILOT_HOME:-$DATA_ROOT/pilotdeck}"
ENV_FILE="${ENV_FILE:-$INSTALL_ROOT/.env}"
COMPOSE_DIR="${COMPOSE_DIR:-$INSTALL_ROOT/current}"
COMPOSE_BASENAME="docker-compose.prod.yml"
SKIP_CONFIRM=0
DO_BACKUP=0
RESTART=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes) SKIP_CONFIRM=1; shift ;;
    --backup) DO_BACKUP=1; shift ;;
    --no-restart) RESTART=0; shift ;;
    --help|-h)
      sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "未知参数: $1（可用 --help）"; exit 1 ;;
  esac
done

if [[ "$(id -u)" -ne 0 ]]; then
  echo "[wipe] 请使用 sudo 运行"; exit 1
fi

if [[ ! -d "$SAAS_ROOT" ]]; then
  echo "[wipe] 未找到 $SAAS_ROOT"; exit 1
fi

DB_BACKEND=sqlite
CONTROL_DB="$SAAS_ROOT/control.db"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "$ENV_FILE"
  set +a
  if [[ -n "${SAAS_DATABASE_URL:-}" ]]; then
    DB_BACKEND=postgres
  fi
  [[ "$DB_BACKEND" == "postgres" ]] && COMPOSE_BASENAME="docker-compose.prod.pg.yml"
fi

echo "[wipe] 将清空所有用户的对话与文件夹数据"
echo "  SaaS 数据: $SAAS_ROOT/tenants/*/{projects,memory,cloud-storage,local-bindings}"
echo "  Legacy:    $PILOT_HOME/{projects,memory}"
echo "  控制库:    user_workspaces / storage_sync_jobs / usage_session_owner / sessions"
echo "  保留:      用户账号、密码、租户、计费、pilotdeck.yaml、skills"
echo ""

if [[ "$SKIP_CONFIRM" -ne 1 ]]; then
  read -r -p "输入 WIPE 确认继续: " ans
  if [[ "$ans" != "WIPE" ]]; then
    echo "[wipe] 已取消"; exit 0
  fi
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="$DATA_ROOT/backups"
mkdir -p "$BACKUP_DIR"

if [[ "$DO_BACKUP" -eq 1 ]]; then
  BACKUP_TGZ="$BACKUP_DIR/pre-wipe-$STAMP.tar.gz"
  echo "[wipe] 备份到 $BACKUP_TGZ ..."
  tar czf "$BACKUP_TGZ" \
    -C "$DATA_ROOT" \
    saas/tenants saas/control.db saas/control.db-wal saas/control.db-shm \
    pilotdeck/projects pilotdeck/memory pilotdeck/auth.db \
    pilotdeck/auth.db-wal pilotdeck/auth.db-shm \
    2>/dev/null || tar czf "$BACKUP_TGZ" -C "$DATA_ROOT" saas pilotdeck
  echo "[wipe] 备份完成"
fi

echo "[wipe] 停止服务..."
if [[ -f "$COMPOSE_DIR/$COMPOSE_BASENAME" ]]; then
  (cd "$COMPOSE_DIR" && docker compose -f "$COMPOSE_BASENAME" --env-file "$ENV_FILE" stop nova) || true
else
  docker stop nova-ai-studio 2>/dev/null || true
fi

wipe_dir_contents() {
  local dir="$1"
  if [[ -d "$dir" ]]; then
    find "$dir" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  fi
  mkdir -p "$dir"
}

echo "[wipe] 清空租户文件数据..."
if [[ -d "$SAAS_ROOT/tenants" ]]; then
  for tenant_dir in "$SAAS_ROOT/tenants"/*/; do
    [[ -d "$tenant_dir" ]] || continue
    for sub in projects memory cloud-storage local-bindings; do
      wipe_dir_contents "${tenant_dir}${sub}"
    done
    echo "  - $(basename "${tenant_dir%/}")"
  done
fi

echo "[wipe] 清空 Legacy pilotdeck 项目与记忆..."
wipe_dir_contents "$PILOT_HOME/projects"
wipe_dir_contents "$PILOT_HOME/memory"
rm -f "$PILOT_HOME/server-token"

wipe_sqlite_control() {
  local db="$1"
  if [[ ! -f "$db" ]]; then
    echo "[wipe] 跳过 control.db（不存在）"; return
  fi
  if ! command -v sqlite3 >/dev/null 2>&1; then
    echo "[wipe] 需要 sqlite3，请: yum install -y sqlite"; exit 1
  fi
  sqlite3 "$db" <<'SQL'
PRAGMA foreign_keys = ON;
DELETE FROM storage_sync_jobs;
DELETE FROM user_workspaces;
DELETE FROM usage_session_owner;
DELETE FROM sessions;
SQL
  echo "[wipe] control.db 工作区/会话元数据已清空"
}

wipe_postgres_control() {
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "[wipe] PostgreSQL 模式需要 $ENV_FILE"; exit 1
  fi
  (
    cd "$COMPOSE_DIR"
    docker compose -f "$COMPOSE_BASENAME" --env-file "$ENV_FILE" exec -T postgres \
      psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 <<'SQL'
DELETE FROM storage_sync_jobs;
DELETE FROM user_workspaces;
DELETE FROM usage_session_owner;
DELETE FROM sessions;
SQL
  )
  echo "[wipe] PostgreSQL 控制库工作区/会话元数据已清空"
}

if [[ "$DB_BACKEND" == "postgres" ]]; then
  wipe_postgres_control
else
  wipe_sqlite_control "$CONTROL_DB"
  rm -f "$CONTROL_DB-wal" "$CONTROL_DB-shm" 2>/dev/null || true
fi

if [[ -f "$PILOT_HOME/auth.db" ]] && command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$PILOT_HOME/auth.db" "DELETE FROM session_names;" 2>/dev/null || true
  echo "[wipe] auth.db session_names 已清空"
fi

if [[ "$RESTART" -eq 1 ]]; then
  echo "[wipe] 启动服务..."
  if [[ -f "$COMPOSE_DIR/$COMPOSE_BASENAME" ]]; then
    ln -sfn "$ENV_FILE" "$COMPOSE_DIR/.env" 2>/dev/null || true
    (cd "$COMPOSE_DIR" && docker compose -f "$COMPOSE_BASENAME" --env-file "$ENV_FILE" up -d nova)
  else
    docker start nova-ai-studio 2>/dev/null || true
  fi
fi

echo "[wipe] 完成 ($STAMP)。所有用户需重新登录；侧栏项目/对话已归零，账号仍在。"
