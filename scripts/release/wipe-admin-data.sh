#!/usr/bin/env bash
# Nova Ai-Studio：清空平台管理员（默认 admin）的对话、文件夹与相关库表，账号保留。
#
# 用法:
#   sudo bash wipe-admin-data.sh              # 交互确认
#   sudo bash wipe-admin-data.sh --yes
#   sudo bash wipe-admin-data.sh --backup --yes
#   sudo bash wipe-admin-data.sh --username admin --yes
#
# 清空: 管理员租户 projects/memory/cloud-storage、Legacy pilotdeck 项目与记忆、
#       user_workspaces / storage_sync_jobs / usage_session_owner / sessions / session_names
# 保留: 用户账号与密码、租户、计费计划与积分、pilotdeck.yaml、skills
set -euo pipefail

INSTALL_ROOT="${INSTALL_ROOT:-/opt/nova-ai-studio}"
DATA_ROOT="${DATA_ROOT:-/var/lib/nova}"
SAAS_ROOT="${SAAS_ROOT:-$DATA_ROOT/saas}"
PILOT_HOME="${PILOT_HOME:-$DATA_ROOT/pilotdeck}"
ENV_FILE="${ENV_FILE:-$INSTALL_ROOT/.env}"
COMPOSE_DIR="${COMPOSE_DIR:-$INSTALL_ROOT/current}"
COMPOSE_BASENAME="docker-compose.prod.yml"
ADMIN_USERNAME="admin"
SKIP_CONFIRM=0
DO_BACKUP=0
RESTART=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --username) ADMIN_USERNAME="$2"; shift 2 ;;
    --yes) SKIP_CONFIRM=1; shift ;;
    --backup) DO_BACKUP=1; shift ;;
    --no-restart) RESTART=0; shift ;;
    --help|-h)
      sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "未知参数: $1（可用 --help）"; exit 1 ;;
  esac
done

if [[ "$(id -u)" -ne 0 ]]; then
  echo "[wipe-admin] 请使用 sudo 运行"; exit 1
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

echo "[wipe-admin] 将清空管理员「$ADMIN_USERNAME」的对话与文件夹数据"
echo "  文件: 租户 projects/memory/cloud-storage + Legacy pilotdeck/projects、memory"
echo "  数据库: user_workspaces、storage_sync_jobs、usage_session_owner、sessions、session_names"
echo "  保留: 账号、密码、租户、计费、pilotdeck.yaml"
echo ""

if [[ "$SKIP_CONFIRM" -ne 1 ]]; then
  read -r -p "输入 WIPE-ADMIN 确认: " ans
  if [[ "$ans" != "WIPE-ADMIN" ]]; then
    echo "[wipe-admin] 已取消"; exit 0
  fi
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="$DATA_ROOT/backups"
mkdir -p "$BACKUP_DIR"

wipe_dir_contents() {
  local dir="$1"
  if [[ -d "$dir" ]]; then
    find "$dir" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  fi
  mkdir -p "$dir"
}

lookup_admin_sqlite() {
  if ! command -v sqlite3 >/dev/null 2>&1; then
    echo "[wipe-admin] 需要 sqlite3: yum install -y sqlite"; exit 1
  fi
  if [[ ! -f "$CONTROL_DB" ]]; then
    echo "[wipe-admin] 未找到 $CONTROL_DB"; exit 1
  fi
  local row
  row="$(sqlite3 "$CONTROL_DB" "SELECT id, tenant_id FROM users WHERE username = '$ADMIN_USERNAME' AND is_active = 1 LIMIT 1;")"
  if [[ -z "$row" ]]; then
    echo "[wipe-admin] 控制库中无用户: $ADMIN_USERNAME"; exit 1
  fi
  ADMIN_USER_ID="${row%%|*}"
  ADMIN_TENANT_ID="${row#*|}"
}

lookup_admin_postgres() {
  local row
  row="$(
    cd "$COMPOSE_DIR"
    docker compose -f "$COMPOSE_BASENAME" --env-file "$ENV_FILE" exec -T postgres \
      psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c \
      "SELECT id, tenant_id FROM users WHERE username = '$ADMIN_USERNAME' AND is_active = TRUE LIMIT 1;"
  )"
  row="$(echo "$row" | tr -d '\r' | head -1)"
  if [[ -z "$row" ]]; then
    echo "[wipe-admin] 控制库中无用户: $ADMIN_USERNAME"; exit 1
  fi
  ADMIN_USER_ID="${row%%|*}"
  ADMIN_TENANT_ID="${row#*|}"
}

if [[ "$DB_BACKEND" == "postgres" ]]; then
  lookup_admin_postgres
else
  lookup_admin_sqlite
fi

echo "[wipe-admin] 目标用户 id=$ADMIN_USER_ID tenant=$ADMIN_TENANT_ID"

if [[ "$DO_BACKUP" -eq 1 ]]; then
  BACKUP_TGZ="$BACKUP_DIR/pre-wipe-admin-$STAMP.tar.gz"
  echo "[wipe-admin] 备份到 $BACKUP_TGZ ..."
  tar czf "$BACKUP_TGZ" \
    -C "$DATA_ROOT" \
    "saas/tenants/$ADMIN_TENANT_ID" \
    saas/control.db saas/control.db-wal saas/control.db-shm \
    pilotdeck/projects pilotdeck/memory pilotdeck/auth.db \
    2>/dev/null || true
  echo "[wipe-admin] 备份完成"
fi

echo "[wipe-admin] 停止服务..."
if [[ -f "$COMPOSE_DIR/$COMPOSE_BASENAME" ]]; then
  (cd "$COMPOSE_DIR" && docker compose -f "$COMPOSE_BASENAME" --env-file "$ENV_FILE" stop nova) || true
else
  docker stop nova-ai-studio 2>/dev/null || true
fi

TENANT_ROOT="$SAAS_ROOT/tenants/$ADMIN_TENANT_ID"
echo "[wipe-admin] 清空租户文件..."
for sub in projects memory local-bindings; do
  wipe_dir_contents "$TENANT_ROOT/$sub"
done
if [[ -d "$TENANT_ROOT/cloud-storage/users/$ADMIN_USER_ID" ]]; then
  wipe_dir_contents "$TENANT_ROOT/cloud-storage/users/$ADMIN_USER_ID"
fi
# 兼容旧布局：整棵 cloud-storage 清空（仅 default 租户管理员单机场景）
if [[ "$ADMIN_TENANT_ID" == "default" ]]; then
  wipe_dir_contents "$TENANT_ROOT/cloud-storage"
fi

echo "[wipe-admin] 清空 Legacy pilotdeck（管理员共用桥接目录）..."
wipe_dir_contents "$PILOT_HOME/projects"
wipe_dir_contents "$PILOT_HOME/memory"
rm -f "$PILOT_HOME/server-token"

wipe_sqlite_admin() {
  sqlite3 "$CONTROL_DB" <<SQL
PRAGMA foreign_keys = ON;
DELETE FROM storage_sync_jobs
  WHERE workspace_id IN (SELECT id FROM user_workspaces WHERE user_id = $ADMIN_USER_ID);
DELETE FROM user_workspaces WHERE user_id = $ADMIN_USER_ID;
DELETE FROM usage_session_owner WHERE user_id = $ADMIN_USER_ID;
DELETE FROM sessions WHERE user_id = $ADMIN_USER_ID;
DELETE FROM analytics_events WHERE user_id = $ADMIN_USER_ID;
UPDATE users SET preferences_json = NULL WHERE id = $ADMIN_USER_ID;
SQL
  rm -f "$CONTROL_DB-wal" "$CONTROL_DB-shm" 2>/dev/null || true
  echo "[wipe-admin] control.db 已重置管理员工作区/会话元数据"
}

wipe_postgres_admin() {
  (
    cd "$COMPOSE_DIR"
    docker compose -f "$COMPOSE_BASENAME" --env-file "$ENV_FILE" exec -T postgres \
      psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 <<SQL
DELETE FROM storage_sync_jobs
  WHERE workspace_id IN (SELECT id FROM user_workspaces WHERE user_id = $ADMIN_USER_ID);
DELETE FROM user_workspaces WHERE user_id = $ADMIN_USER_ID;
DELETE FROM usage_session_owner WHERE user_id = $ADMIN_USER_ID;
DELETE FROM sessions WHERE user_id = $ADMIN_USER_ID;
DELETE FROM analytics_events WHERE user_id = $ADMIN_USER_ID;
UPDATE users SET preferences_json = NULL WHERE id = $ADMIN_USER_ID;
SQL
  )
  echo "[wipe-admin] PostgreSQL 已重置管理员工作区/会话元数据"
}

if [[ "$DB_BACKEND" == "postgres" ]]; then
  wipe_postgres_admin
else
  wipe_sqlite_admin
fi

if [[ -f "$PILOT_HOME/auth.db" ]] && command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$PILOT_HOME/auth.db" "DELETE FROM session_names;" 2>/dev/null || true
  echo "[wipe-admin] auth.db session_names 已清空"
fi

if [[ "$RESTART" -eq 1 ]]; then
  echo "[wipe-admin] 启动服务..."
  if [[ -f "$COMPOSE_DIR/$COMPOSE_BASENAME" ]]; then
    ln -sfn "$ENV_FILE" "$COMPOSE_DIR/.env" 2>/dev/null || true
    (cd "$COMPOSE_DIR" && docker compose -f "$COMPOSE_BASENAME" --env-file "$ENV_FILE" up -d nova)
  else
    docker start nova-ai-studio 2>/dev/null || true
  fi
fi

echo "[wipe-admin] 完成 ($STAMP)。管理员 $ADMIN_USERNAME 须重新登录，项目/对话已归零。"
