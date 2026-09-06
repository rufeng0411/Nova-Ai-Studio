/**
 * PD-SAAS-FORK: Local dev infra — native Redis + PostgreSQL (native or Docker).
 */
import pg from 'pg';
import { spawnSync } from './childProcessShim.mjs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPortOpen } from './netProbe.mjs';
import { DEV_REDIS_URL, ensureNativeRedis, pingRedis } from './nativeRedis.mjs';
import {
  ensureNativePostgres,
  getNativePgUrlCandidates,
  hasNativePgInstall,
  NATIVE_DEV_PG_URL,
} from './nativePostgres.mjs';
import { withHiddenConsole } from './winSpawn.mjs';

const { Pool } = pg;

export { isPortOpen };

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(__dirname, '../..');
export const DEV_PG_COMPOSE_FILE = resolve(REPO_ROOT, 'deploy/docker-compose.pg.dev.yml');

export { DEV_REDIS_URL };
export const DOCKER_DEV_PG_URL =
  process.env.DEV_PG_DOCKER_URL || 'postgresql://pilotdeck:pilotdeck_dev@127.0.0.1:5433/pilotdeck_saas';
export const DEV_PG_URL = process.env.DEV_PG_URL || DOCKER_DEV_PG_URL;

const DEV_PG_CONTAINER = 'nova-postgres-dev';

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

export function isDockerAvailable() {
  const result = spawnSync('docker', ['info'], withHiddenConsole({
    cwd: REPO_ROOT,
    stdio: 'ignore',
    shell: false,
    timeout: 8000,
  }));
  return result.status === 0 && !result.error;
}

function dockerInspectHealth(containerName) {
  const result = spawnSync(
    'docker',
    ['inspect', '--format', '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}', containerName],
    withHiddenConsole({ cwd: REPO_ROOT, encoding: 'utf8', shell: false }),
  );
  if (result.status !== 0) return null;
  return String(result.stdout || '').trim();
}

export async function waitForContainerHealthy(containerName, maxMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const status = dockerInspectHealth(containerName);
    if (status === 'healthy' || status === 'running') {
      return true;
    }
    await sleep(1000);
  }
  return false;
}

export function runPgComposeUp() {
  const result = spawnSync(
    'docker',
    ['compose', '-f', DEV_PG_COMPOSE_FILE, 'up', '-d'],
    withHiddenConsole({ cwd: REPO_ROOT, stdio: 'inherit', shell: false }),
  );
  if (result.status !== 0) {
    throw new Error('PostgreSQL docker compose up failed — is Docker Desktop running?');
  }
}

export function runPgComposeDown() {
  if (!isDockerAvailable()) {
    return true;
  }
  const result = spawnSync(
    'docker',
    ['compose', '-f', DEV_PG_COMPOSE_FILE, 'down'],
    withHiddenConsole({ cwd: REPO_ROOT, stdio: 'pipe', shell: false, encoding: 'utf8' }),
  );
  return result.status === 0;
}

/** @deprecated use runPgComposeDown */
export function runDockerComposeDown() {
  return runPgComposeDown();
}

export async function isRedisReachable(url = DEV_REDIS_URL) {
  return pingRedis(url);
}

function parsePgPort(url) {
  try {
    const parsed = new URL(url.replace(/^postgresql:/, 'http:'));
    return Number.parseInt(parsed.port || '5432', 10);
  } catch {
    return 5432;
  }
}

/** Candidate PG URLs in preference order (native before Docker on Windows). */
export function getPgUrlCandidates() {
  const urls = [];
  const saas = process.env.SAAS_DATABASE_URL?.trim();
  const devPg = process.env.DEV_PG_URL?.trim();
  if (saas) urls.push(saas);
  if (devPg && devPg !== saas) urls.push(devPg);
  if (hasNativePgInstall() || process.platform === 'win32') {
    for (const nativeUrl of getNativePgUrlCandidates()) {
      if (!urls.includes(nativeUrl)) urls.push(nativeUrl);
    }
  } else if (!urls.includes(NATIVE_DEV_PG_URL)) {
    urls.push(NATIVE_DEV_PG_URL);
  }
  if (!urls.includes(DOCKER_DEV_PG_URL)) urls.push(DOCKER_DEV_PG_URL);
  return urls;
}

/** True when the TCP port for a PG URL accepts connections. */
export async function isPgPortOpen(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url.replace(/^postgresql:/, 'http:'));
    const port = Number.parseInt(parsed.port || '5432', 10);
    return isPortOpen(parsed.hostname || '127.0.0.1', port);
  } catch {
    return false;
  }
}

/** Authenticated ping — avoids treating any listener on :5433 as Docker dev PG. */
export async function pingPgUrl(url, timeoutMs = 4000) {
  if (!url?.trim()) return false;
  /** @type {import('pg').Pool | undefined} */
  let pool;
  try {
    pool = new Pool({
      connectionString: url,
      connectionTimeoutMillis: timeoutMs,
      max: 1,
    });
    const result = await pool.query('SELECT 1 AS ok');
    return result.rows[0]?.ok === 1;
  } catch {
    return false;
  } finally {
    await pool?.end().catch(() => {});
  }
}

/** URL to inject into SAAS_DATABASE_URL when PG auth succeeds. */
export async function resolveDevPgUrl() {
  for (const url of getPgUrlCandidates()) {
    if (!(await isPgPortOpen(url))) continue;
    if (await pingPgUrl(url)) return url;
  }
  return null;
}

export function describePgEndpoint(url = DOCKER_DEV_PG_URL) {
  const port = parsePgPort(url);
  if (port === 5433) return { port, mode: 'custom', detail: `:5433（Docker 或本机 PG）` };
  if (port === 5432) return { port, mode: 'native', detail: '本机就绪' };
  return { port, mode: 'custom', detail: `:${port}` };
}

export async function isPgReachable(url) {
  if (url) {
    if (!(await isPgPortOpen(url))) return false;
    return pingPgUrl(url);
  }
  for (const candidate of getPgUrlCandidates()) {
    if (await isPgReachable(candidate)) return true;
  }
  return false;
}

async function isAnyPgPortOpen() {
  for (const url of getPgUrlCandidates()) {
    if (await isPgPortOpen(url)) return true;
  }
  return false;
}

async function ensureDevPostgres(skipDocker) {
  if (await isAnyPgPortOpen()) return true;

  if (!skipDocker && hasNativePgInstall()) {
    const nativeReady = await ensureNativePostgres();
    if (nativeReady || (await isPgPortOpen(NATIVE_DEV_PG_URL))) return true;
  }

  if (skipDocker || !isDockerAvailable()) {
    if (!skipDocker && !hasNativePgInstall()) {
      console.warn('[dev-infra] Docker 不可用，PostgreSQL 未启动（Control DB 将回退 SQLite）');
    }
    return false;
  }

  console.log('[dev-infra] 启动本地 PostgreSQL (docker compose)…');
  runPgComposeUp();
  const ready = await waitForContainerHealthy(DEV_PG_CONTAINER);
  return ready || isPgPortOpen(DOCKER_DEV_PG_URL);
}

/**
 * Ensure native Redis + optional PostgreSQL for local dev.
 * @returns {Promise<{ redis: boolean, postgres: boolean, started: boolean, pgUrl: string | null }>}
 */
export async function ensureDevInfra(options = {}) {
  const skip = options.skip ?? process.env.DEV_INFRA_SKIP === '1';
  const resolvePg = async () => {
    const pgUrl = await resolveDevPgUrl();
    return { postgres: pgUrl !== null, pgUrl };
  };

  if (skip) {
    const pg = await resolvePg();
    return {
      redis: await isRedisReachable(),
      postgres: pg.postgres,
      started: false,
      pgUrl: pg.pgUrl,
    };
  }

  let started = false;
  let redis = await isRedisReachable();
  if (!redis) {
    redis = await ensureNativeRedis();
    if (redis) started = true;
  }
  if (!redis) {
    console.warn('[dev-infra] 本机 Redis 未就绪 — 运行 npm run install:redis');
    console.warn('[dev-infra] 或设置 REDIS_URL 指向已有实例；否则使用内存缓存兜底');
  }

  const portOpen = await ensureDevPostgres(skip || process.env.DEV_PG_SKIP === '1');
  if (portOpen && !(await isAnyPgPortOpen())) {
    started = true;
  }

  const pg = await resolvePg();
  if (portOpen && !pg.postgres && !process.env.SAAS_DATABASE_URL?.trim()) {
    console.warn('[dev-infra] PostgreSQL 端口可达但认证失败（可能非 Docker dev 容器）— Control DB 回退 SQLite');
    console.warn('[dev-infra] 若需 PostgreSQL：设置 DEV_PG_NATIVE_URL 或 SAAS_DATABASE_URL（见 docs/saas-pg-phase1-runbook.md）');
  }

  return {
    redis,
    postgres: pg.postgres,
    started,
    pgUrl: pg.pgUrl,
  };
}
