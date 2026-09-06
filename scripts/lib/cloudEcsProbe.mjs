/**
 * PD-SAAS-FORK: ECS 只读探测 — verify-cloud-perf、脱敏 .env、PG/Redis 健康
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** @typedef {'pass' | 'warn' | 'fail' | 'skip'} Verdict */

/** @typedef {{ id: string, title: string, verdict: Verdict, detail: string }} CheckRecord */

/** @typedef {(id: string, title: string, verdict: Verdict, detail: string) => void} RecordFn */

const SECRET_ENV_PREFIXES = [
  'JWT_',
  'OSS_',
  'SAAS_OSS_',
  'BOCHA_',
  'MINERU_',
  'NUTRIENT_',
];

const SECRET_ENV_KEYS = new Set([
  'SAAS_DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'SESSION_SECRET',
  'CAPTCHA_SECRET',
]);

const HOST_ENV_KEYS = [
  'SAAS_CONVERSATION_CATALOG',
  'SAAS_CONVERSATION_CATALOG_SHADOW',
  'SAAS_DATABASE_URL',
  'REDIS_URL',
  'PILOTDECK_HISTORY_SANITIZE',
  'PILOTDECK_HISTORY_TAIL_READ',
  'PILOTDECK_HISTORY_MESSAGE_CACHE',
  'CACHE_TTL_CAPABILITIES_SEC',
  'CACHE_TTL_PROJECTS_SEC',
  'CACHE_TTL_MESSAGES_SEC',
  'PILOTDECK_SAAS_MODE',
  'DATA_ROOT',
];

/** @type {Record<string, string>} */
const PROD_ECS_HOST_BY_DOMAIN = {
  'www.novapage.online': '47.79.32.199',
  'novapage.online': '47.79.32.199',
};

/**
 * @param {string} [prodBaseUrl]
 */
function resolveDefaultEcsHost(prodBaseUrl) {
  const base = (prodBaseUrl || process.env.PROD_BASE_URL || 'https://www.novapage.online').replace(/\/$/, '');
  try {
    const url = base.startsWith('http') ? base : `https://${base}`;
    const hostname = new URL(url).hostname;
    if (PROD_ECS_HOST_BY_DOMAIN[hostname]) return PROD_ECS_HOST_BY_DOMAIN[hostname];
  } catch {
    /* ignore */
  }
  return PROD_ECS_HOST_BY_DOMAIN['www.novapage.online'];
}

function resolveDefaultSshIdentity() {
  for (const name of ['id_ed25519', 'id_rsa']) {
    const candidate = join(homedir(), '.ssh', name);
    if (existsSync(candidate)) return candidate;
  }
  return '';
}

/**
 * @param {string} repoRoot
 * @param {string} [prodBaseUrl]
 */
export function loadEcsSshConfig(repoRoot, prodBaseUrl) {
  /** @type {Record<string, string>} */
  const fromFile = {};
  const envLocal = join(repoRoot, 'deploy', 'env.local');
  if (existsSync(envLocal)) {
    for (const line of readFileSync(envLocal, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!key.startsWith('ECS_') && key !== 'ECS_INSTALL_ROOT') continue;
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      fromFile[key] = val;
    }
  }

  const pick = (key, fallback = '') =>
    process.env[key] || fromFile[key] || fallback;

  const identity = pick('ECS_SSH_IDENTITY') || pick('ECS_SSH_KEY') || resolveDefaultSshIdentity();
  const host = pick('ECS_SSH_HOST') || resolveDefaultEcsHost(prodBaseUrl);

  return {
    host,
    user: pick('ECS_SSH_USER', 'root'),
    port: pick('ECS_SSH_PORT', '22'),
    identity,
    installRoot: pick('ECS_INSTALL_ROOT', '/opt/nova-ai-studio'),
    enabled: Boolean(host),
    autoHost: !pick('ECS_SSH_HOST'),
    autoIdentity: !pick('ECS_SSH_IDENTITY') && !pick('ECS_SSH_KEY') && Boolean(identity),
  };
}

/**
 * @param {ReturnType<typeof loadEcsSshConfig>} config
 * @returns {string[]}
 */
function sshBaseArgs(config) {
  /** @type {string[]} */
  const args = [
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=20',
    '-o', 'StrictHostKeyChecking=accept-new',
    '-p', String(config.port),
  ];
  if (config.identity) {
    args.push('-i', config.identity);
  }
  return args;
}

/**
 * @param {ReturnType<typeof loadEcsSshConfig>} config
 * @param {string} script
 * @param {number} [timeoutMs]
 */
export function runEcsRemoteScript(config, script, timeoutMs = 180_000) {
  const args = [
    ...sshBaseArgs(config),
    `${config.user}@${config.host}`,
    'bash', '-s',
  ];
  const result = spawnSync('ssh', args, {
    encoding: 'utf8',
    input: script,
    timeout: timeoutMs,
    maxBuffer: 12 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    status: result.status ?? -1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error?.message,
  };
}

/**
 * @param {string} installRoot
 */
function buildRemoteProbeScript(installRoot) {
  const root = installRoot.replace(/'/g, "'\\''");
  const hostEnvKeys = HOST_ENV_KEYS.join(' ');
  const lines = [
    'set +e',
    `INSTALL_ROOT='${root}'`,
    'ENV_FILE="$INSTALL_ROOT/.env"',
    'COMPOSE_FILE="docker-compose.prod.yml"',
    '',
    'echo "=== SECTION:docker_ps ==="',
    "docker ps --format '{{.Names}}\\t{{.Status}}' 2>&1",
    '',
    'echo "=== SECTION:verify_cloud_perf ==="',
    'VERIFY_SCRIPT=""',
    'for candidate in "$INSTALL_ROOT/verify-cloud-perf.sh" "$INSTALL_ROOT/current/verify-cloud-perf.sh"; do',
    '  if [[ -f "$candidate" ]]; then VERIFY_SCRIPT="$candidate"; break; fi',
    'done',
    'if [[ -n "$VERIFY_SCRIPT" ]]; then',
    '  bash "$VERIFY_SCRIPT" "$COMPOSE_FILE" "$ENV_FILE" nova 2>&1',
    '  echo "VERIFY_EXIT=$?"',
    'else',
    '  echo "VERIFY_MISSING=1"',
    'fi',
    '',
    'echo "=== SECTION:host_env ==="',
    'if [[ -f "$ENV_FILE" ]]; then',
    `  for key in ${hostEnvKeys}; do`,
    '    val="$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d \'\\r\' || true)"',
    '    if [[ -n "$val" ]]; then',
    '      echo "ENV:${key}=set"',
    '    else',
    '      echo "ENV:${key}=unset"',
    '    fi',
    '  done',
    'else',
    '  echo "ENV_FILE_MISSING=1"',
    'fi',
    '',
    'echo "=== SECTION:runtime_env ==="',
    "if docker ps --format '{{.Names}}' | grep -qx 'nova-ai-studio'; then",
    '  docker exec nova-ai-studio printenv SAAS_CONVERSATION_CATALOG SAAS_CONVERSATION_CATALOG_SHADOW PILOTDECK_HISTORY_SANITIZE PILOTDECK_HISTORY_TAIL_READ PILOTDECK_HISTORY_MESSAGE_CACHE REDIS_URL SAAS_DATABASE_URL 2>/dev/null | while IFS= read -r line; do',
    '    key="${line%%=*}"',
    '    val="${line#*=}"',
    '    case "$key" in',
    '      SAAS_DATABASE_URL|REDIS_URL) echo "RUNTIME:${key}=masked" ;;',
    '      *) echo "RUNTIME:${key}=${val}" ;;',
    '    esac',
    '  done',
    'else',
    '  echo "NOVA_CONTAINER=missing"',
    'fi',
    '',
    'echo "=== SECTION:redis_ping ==="',
    "if docker ps --format '{{.Names}}' | grep -qx 'nova-redis'; then",
    '  docker exec nova-redis redis-cli ping 2>&1',
    'else',
    '  echo "REDIS_CONTAINER=missing"',
    'fi',
    '',
    'echo "=== SECTION:pg_probe ==="',
    "if docker ps --format '{{.Names}}' | grep -qx 'nova-ai-studio'; then",
    `  docker exec nova-ai-studio node --input-type=module -e "
import { openControlDatabase, getControlDbBackend } from '/app/ui/server/saas/db/control.js';
try {
  const backend = getControlDbBackend();
  const db = await openControlDatabase();
  const ping = await db.ping();
  let catalog = 0;
  let users = 0;
  try {
    const r = await db.queryOne('SELECT COUNT(*) AS c FROM conversation_catalog WHERE deleted_at IS NULL');
    catalog = Number(r?.c ?? 0);
  } catch (e) { console.log('CATALOG_ERR=' + e.message); }
  try {
    const u = await db.queryOne('SELECT COUNT(*) AS c FROM users');
    users = Number(u?.c ?? 0);
  } catch (e) { console.log('USERS_ERR=' + e.message); }
  console.log('DB_BACKEND=' + backend);
  console.log('DB_PING=' + (ping ? 'ok' : 'fail'));
  console.log('CATALOG_ROWS=' + catalog);
  console.log('USERS=' + users);
  console.log('HAS_SAAS_DATABASE_URL=' + (process.env.SAAS_DATABASE_URL ? '1' : '0'));
} catch (e) {
  console.log('PG_PROBE_ERR=' + (e?.message || e));
}
" 2>&1`,
    'else',
    '  echo "PG_PROBE_SKIP=no_container"',
    'fi',
    '',
    'echo "=== SECTION:end ==="',
  ];
  return lines.join('\n');
}

/**
 * @param {string} stdout
 * @param {string} name
 */
function extractSection(stdout, name) {
  const marker = `=== SECTION:${name} ===`;
  const start = stdout.indexOf(marker);
  if (start < 0) return '';
  const bodyStart = start + marker.length;
  const next = stdout.indexOf('=== SECTION:', bodyStart);
  return (next >= 0 ? stdout.slice(bodyStart, next) : stdout.slice(bodyStart)).trim();
}

/**
 * @param {string} text
 */
export function parseVerifyCloudPerfOutput(text) {
  /** @type {Array<{ kind: 'ok' | 'warn' | 'fail' | 'info', text: string }>} */
  const items = [];
  for (const line of text.split('\n')) {
    if (!line.includes('[nova-perf]')) continue;
    const body = line.replace(/^\[nova-perf\]\s*/, '').trim();
    if (line.includes('✓')) items.push({ kind: 'ok', text: body });
    else if (line.includes('✗')) items.push({ kind: 'fail', text: body });
    else if (line.includes('⚠')) items.push({ kind: 'warn', text: body });
    else items.push({ kind: 'info', text: body });
  }
  const verifyExit = Number.parseInt(text.match(/VERIFY_EXIT=(\d+)/)?.[1] ?? '', 10);
  const verifyMissing = text.includes('VERIFY_MISSING=1');
  return {
    items,
    verifyExit: Number.isFinite(verifyExit) ? verifyExit : null,
    verifyMissing,
    failCount: items.filter((i) => i.kind === 'fail').length,
    warnCount: items.filter((i) => i.kind === 'warn').length,
  };
}

/**
 * @param {string} key
 * @param {string} value
 */
export function maskEnvValue(key, value) {
  if (!value) return '(unset)';
  if (SECRET_ENV_KEYS.has(key) || SECRET_ENV_PREFIXES.some((p) => key.startsWith(p))) {
    if (key === 'SAAS_DATABASE_URL') {
      return value.replace(/\/\/([^:@/]+):([^@/]+)@/, '//$1:***@');
    }
    if (key === 'REDIS_URL') {
      return value.includes('@') ? value.replace(/:([^:@/]+)@/, ':***@') : '***';
    }
    return '***';
  }
  return value.length > 96 ? `${value.slice(0, 93)}...` : value;
}

/**
 * @param {string} pgText
 */
function parsePgProbe(pgText) {
  /** @type {Record<string, string>} */
  const kv = {};
  for (const line of pgText.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) kv[m[1]] = m[2];
  }
  return {
    backend: kv.DB_BACKEND || 'unknown',
    ping: kv.DB_PING || 'unknown',
    catalogRows: Number.parseInt(kv.CATALOG_ROWS ?? '0', 10) || 0,
    users: Number.parseInt(kv.USERS ?? '0', 10) || 0,
    hasSaasDatabaseUrl: kv.HAS_SAAS_DATABASE_URL === '1',
    error: kv.PG_PROBE_ERR || kv.CATALOG_ERR || kv.USERS_ERR || null,
  };
}

/**
 * @param {ReturnType<typeof loadEcsSshConfig>} config
 * @param {RecordFn} record
 */
export function probeEcsReadOnly(config, record) {
  if (!config.enabled) {
    record(
      'ecs.config',
      'ECS 只读探测',
      'skip',
      '未配置 ECS 主机',
    );
    return { skipped: true, reason: 'no_ssh_config' };
  }

  if (config.autoHost || config.autoIdentity) {
    record(
      'ecs.config',
      'ECS 连接参数',
      'pass',
      `${config.user}@${config.host}:${config.port}${config.identity ? ` key=${config.identity}` : '（无本地密钥，依赖 ssh-agent）'}`,
    );
  }

  const script = buildRemoteProbeScript(config.installRoot);
  const ssh = runEcsRemoteScript(config, script);

  if (ssh.error) {
    const soft = /permission denied|publickey|auth/i.test(String(ssh.error));
    record('ecs.ssh', 'ECS SSH', soft ? 'warn' : 'fail', ssh.error);
    return {
      skipped: false,
      sshError: ssh.error,
      config: {
        host: config.host,
        user: config.user,
        port: config.port,
        installRoot: config.installRoot,
      },
      stdout: ssh.stdout,
      stderr: ssh.stderr,
    };
  }

  if (!ssh.stdout.includes('=== SECTION:')) {
    const detail = (ssh.stderr || ssh.stdout || `exit ${ssh.status}`).slice(0, 240);
    const soft = /permission denied|publickey|auth/i.test(detail);
    record(
      'ecs.ssh',
      'ECS SSH',
      soft ? 'warn' : 'fail',
      soft ? `${detail}（本机无密钥时可忽略，HTTP 检测仍有效）` : detail,
    );
    return {
      skipped: false,
      sshError: true,
      config: {
        host: config.host,
        user: config.user,
        port: config.port,
        installRoot: config.installRoot,
      },
      stdout: ssh.stdout,
      stderr: ssh.stderr,
    };
  }

  record(
    'ecs.ssh',
    'ECS SSH',
    'pass',
    `${config.user}@${config.host}:${config.port} (${ssh.stdout.length}B)`,
  );

  const dockerPs = extractSection(ssh.stdout, 'docker_ps');
  const novaUp = /nova-ai-studio/.test(dockerPs) && !/Exited/.test(dockerPs.split('\n').find((l) => l.includes('nova-ai-studio')) || '');
  const redisUp = /nova-redis/.test(dockerPs) && dockerPs.includes('Up');

  record(
    'ecs.docker.nova',
    'ECS 容器 nova-ai-studio',
    novaUp ? 'pass' : 'fail',
    dockerPs.split('\n').find((l) => l.includes('nova-ai-studio')) || '未运行',
  );
  record(
    'ecs.docker.redis',
    'ECS 容器 nova-redis',
    redisUp ? 'pass' : 'warn',
    dockerPs.split('\n').find((l) => l.includes('nova-redis')) || '未运行',
  );

  const verifyText = extractSection(ssh.stdout, 'verify_cloud_perf');
  const verify = parseVerifyCloudPerfOutput(verifyText);
  if (verify.verifyMissing) {
    record('ecs.verify_cloud_perf', 'verify-cloud-perf.sh', 'fail', '脚本不存在');
  } else {
    const verdict = verify.failCount > 0 ? 'fail' : verify.warnCount > 0 ? 'warn' : 'pass';
    record(
      'ecs.verify_cloud_perf',
      'verify-cloud-perf.sh',
      /** @type {Verdict} */ (verdict),
      `exit=${verify.verifyExit ?? '?'} fail=${verify.failCount} warn=${verify.warnCount}`,
    );
    for (const item of verify.items.filter((i) => i.kind === 'fail' || i.kind === 'warn').slice(0, 8)) {
      record(
        `ecs.perf.${item.kind}`,
        item.text.slice(0, 60),
        item.kind === 'fail' ? 'fail' : 'warn',
        item.text,
      );
    }
  }

  const hostEnvText = extractSection(ssh.stdout, 'host_env');
  if (hostEnvText.includes('ENV_FILE_MISSING=1')) {
    record('ecs.env.host', 'ECS 主机 .env', 'fail', `${config.installRoot}/.env 不存在`);
  } else {
    /** @type {string[]} */
    const setKeys = [];
    /** @type {string[]} */
    const unsetKeys = [];
    for (const line of hostEnvText.split('\n')) {
      const m = line.match(/^ENV:([A-Z0-9_]+)=(set|unset)$/);
      if (!m) continue;
      if (m[2] === 'set') setKeys.push(m[1]);
      else unsetKeys.push(m[1]);
    }
    const criticalUnset = ['SAAS_CONVERSATION_CATALOG', 'REDIS_URL'].filter((k) => unsetKeys.includes(k));
    record(
      'ecs.env.host',
      'ECS 主机 .env 关键项',
      criticalUnset.length ? 'warn' : 'pass',
      `已设 ${setKeys.length} 项${criticalUnset.length ? `；缺 ${criticalUnset.join(', ')}` : ''}`,
    );
  }

  const runtimeEnv = extractSection(ssh.stdout, 'runtime_env');
  const runtimeLines = runtimeEnv.split('\n').filter((l) => l.startsWith('RUNTIME:'));
  record(
    'ecs.env.runtime',
    'ECS 容器运行时 env',
    runtimeLines.length ? 'pass' : 'warn',
    runtimeLines.slice(0, 6).map((l) => l.replace(/^RUNTIME:/, '')).join(' | ') || runtimeEnv.slice(0, 120),
  );

  const redisText = extractSection(ssh.stdout, 'redis_ping').trim();
  const redisVerdict = redisText === 'PONG' ? 'pass' : redisText.includes('missing') ? 'warn' : 'fail';
  record(
    'ecs.redis.ping',
    'ECS Redis PING',
    /** @type {Verdict} */ (redisVerdict),
    redisText || '无响应',
  );

  const pg = parsePgProbe(extractSection(ssh.stdout, 'pg_probe'));
  if (pg.error) {
    record('ecs.pg.probe', 'ECS 控制库探测', 'fail', pg.error);
  } else {
    const pgVerdict = pg.ping === 'ok' ? 'pass' : 'fail';
    record(
      'ecs.pg.probe',
      'ECS 控制库探测',
      /** @type {Verdict} */ (pgVerdict),
      `backend=${pg.backend} ping=${pg.ping} catalog=${pg.catalogRows} users=${pg.users}`,
    );
    if (pg.backend === 'postgres' && !pg.hasSaasDatabaseUrl) {
      record('ecs.pg.url', 'SAAS_DATABASE_URL', 'warn', 'backend=postgres 但容器内未注入 URL');
    } else if (pg.backend === 'postgres') {
      record('ecs.pg.url', 'SAAS_DATABASE_URL', 'pass', '已注入（值已脱敏）');
    } else {
      record('ecs.pg.url', '控制库后端', 'warn', `当前为 ${pg.backend}（生产建议 PostgreSQL）`);
    }
    if (pg.catalogRows === 0 && pg.ping === 'ok') {
      record('ecs.pg.catalog', 'conversation_catalog', 'warn', '活跃行数为 0，可能需要 backfill');
    } else if (pg.ping === 'ok') {
      record('ecs.pg.catalog', 'conversation_catalog', 'pass', `${pg.catalogRows} 行`);
    }
  }

  return {
    skipped: false,
    config: {
      host: config.host,
      user: config.user,
      port: config.port,
      installRoot: config.installRoot,
    },
    dockerPs,
    verify,
    pg,
    redis: redisText,
    hostEnv: hostEnvText,
    runtimeEnv,
    rawStdout: ssh.stdout,
    rawStderr: ssh.stderr,
  };
}
