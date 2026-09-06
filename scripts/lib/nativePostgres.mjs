/**
 * PD-SAAS-FORK: Native PostgreSQL on Windows (D:\pgsql or PILOTDECK_PG_HOME).
 */
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from './childProcessShim.mjs';
import { join } from 'node:path';
import { isPortOpen } from './netProbe.mjs';
import { withHiddenConsole } from './winSpawn.mjs';

export const NATIVE_DEV_PG_URL =
  process.env.DEV_PG_NATIVE_URL || 'postgresql://postgres@127.0.0.1:5432/pilotdeck_saas';

const WINDOWS_PG_CONF_CANDIDATES = [
  'C:\\Program Files\\PostgreSQL\\16\\data\\postgresql.conf',
  'C:\\Program Files\\PostgreSQL\\15\\data\\postgresql.conf',
  'C:\\Program Files\\PostgreSQL\\14\\data\\postgresql.conf',
];

/** Read `port` from a local PostgreSQL install (Windows Program Files or PILOTDECK_PG_HOME). */
export function detectNativePgPort() {
  const confPaths = [
    process.env.PILOTDECK_PG_HOME
      ? join(process.env.PILOTDECK_PG_HOME, 'data', 'postgresql.conf')
      : null,
    process.platform === 'win32' ? join('D:\\pgsql', 'data', 'postgresql.conf') : null,
    ...(process.platform === 'win32' ? WINDOWS_PG_CONF_CANDIDATES : []),
  ].filter(Boolean);

  for (const confPath of confPaths) {
    if (!existsSync(confPath)) continue;
    try {
      const text = readFileSync(confPath, 'utf8');
      const match = text.match(/^port\s*=\s*(\d+)/m);
      if (match) return Number.parseInt(match[1], 10);
    } catch {
      // try next candidate
    }
  }
  return 5432;
}

/** Native PG URLs to probe (explicit override first, then detected port + default 5432). */
export function getNativePgUrlCandidates() {
  const urls = [];
  const explicit = process.env.DEV_PG_NATIVE_URL?.trim();
  if (explicit) urls.push(explicit);

  const port = detectNativePgPort();
  const base = `postgresql://postgres@127.0.0.1`;
  urls.push(`${base}:${port}/pilotdeck_saas`);
  if (port !== 5432) urls.push(`${base}:5432/pilotdeck_saas`);
  return [...new Set(urls)];
}

const PG_CTL_CANDIDATES = [
  process.env.PG_CTL_PATH,
  process.env.PILOTDECK_PG_HOME
    ? join(process.env.PILOTDECK_PG_HOME, 'bin', process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl')
    : null,
  process.platform === 'win32' ? 'D:\\pgsql\\bin\\pg_ctl.exe' : null,
].filter(Boolean);

const PG_DATA_CANDIDATES = [
  process.env.PGDATA,
  process.env.PILOTDECK_PG_HOME ? join(process.env.PILOTDECK_PG_HOME, 'data') : null,
  process.platform === 'win32' ? 'D:\\pgsql\\data' : null,
].filter(Boolean);

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

export function findPgCtl() {
  for (const candidate of PG_CTL_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function findPgDataDir() {
  for (const candidate of PG_DATA_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function hasNativePgInstall() {
  return Boolean(findPgCtl() && findPgDataDir());
}

function queryWindowsService(name) {
  const result = spawnSync('sc.exe', ['query', name], withHiddenConsole({
    encoding: 'utf8',
    shell: false,
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 8000,
  }));
  if (result.status !== 0) return null;
  const state = String(result.stdout || '').match(/STATE\s*:\s*\d+\s+(\w+)/i);
  return state?.[1]?.toUpperCase() || null;
}

function pgCtlStatus(pgCtl, dataDir) {
  const result = spawnSync(pgCtl, ['status', '-D', dataDir], withHiddenConsole({
    encoding: 'utf8',
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10_000,
  }));
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (/server is running/i.test(output)) return 'running';
  if (result.status === 0) return 'running';
  return 'stopped';
}

export function startNativePostgres() {
  if (process.platform !== 'win32') return false;

  for (const serviceName of ['postgresql-x64-16', 'postgresql-x64-15', 'postgresql-x64-14', 'postgresql']) {
    const state = queryWindowsService(serviceName);
    if (!state) continue;
    if (state === 'RUNNING') return true;
    const start = spawnSync('net.exe', ['start', serviceName], withHiddenConsole({
      shell: false,
      stdio: 'ignore',
      timeout: 30_000,
    }));
    if (start.status === 0) return true;
  }

  const pgCtl = findPgCtl();
  const dataDir = findPgDataDir();
  if (!pgCtl || !dataDir) return false;

  if (pgCtlStatus(pgCtl, dataDir) === 'running') return true;

  const logDir = join(dataDir, '..', 'log');
  const logFile = join(logDir, 'server.log');
  const result = spawnSync(pgCtl, ['start', '-D', dataDir, '-l', logFile, '-w'], withHiddenConsole({
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 45_000,
  }));
  if (result.status === 0) return true;
  return pgCtlStatus(pgCtl, dataDir) === 'running';
}

/**
 * Ensure native PostgreSQL responds on port 5432 (start via service or pg_ctl when possible).
 * @returns {Promise<boolean>}
 */
export async function ensureNativePostgres() {
  if (await isPortOpen('127.0.0.1', 5432)) return true;
  if (process.platform !== 'win32' || !hasNativePgInstall()) return false;

  console.log('[dev-infra] 尝试启动本机 PostgreSQL…');
  startNativePostgres();
  for (let i = 0; i < 30; i += 1) {
    if (await isPortOpen('127.0.0.1', 5432)) return true;
    await sleep(1000);
  }
  return isPortOpen('127.0.0.1', 5432);
}
