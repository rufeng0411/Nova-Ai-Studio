/**

 * PD-SAAS-FORK: Native Redis / Memurai on Windows (no Docker).

 */

import { existsSync } from 'node:fs';

import { spawnSync } from './childProcessShim.mjs';

import { join } from 'node:path';

import { isPortOpen } from './netProbe.mjs';

import { withHiddenConsole } from './winSpawn.mjs';



export const DEV_REDIS_URL = process.env.DEV_REDIS_URL || 'redis://127.0.0.1:6379/0';



const REDIS_CLI_CANDIDATES = [

  process.env.REDIS_CLI_PATH,

  'C:\\Program Files\\Memurai\\memurai-cli.exe',

  'C:\\Program Files\\Redis\\redis-cli.exe',

  join(process.env.ProgramFiles || 'C:\\Program Files', 'Memurai', 'memurai-cli.exe'),

  join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Memurai', 'memurai-cli.exe'),

].filter(Boolean);



let cachedRedisCli;



function parseRedisUrl(url = DEV_REDIS_URL) {

  const parsed = new URL(url);

  return {

    host: parsed.hostname || '127.0.0.1',

    port: String(parsed.port || '6379'),

  };

}



export function findRedisCli() {

  if (cachedRedisCli && existsSync(cachedRedisCli)) return cachedRedisCli;

  for (const candidate of REDIS_CLI_CANDIDATES) {

    if (existsSync(candidate)) {

      cachedRedisCli = candidate;

      return candidate;

    }

  }

  const which = spawnSync('where.exe', ['memurai-cli'], withHiddenConsole({

    encoding: 'utf8',

    shell: false,

    stdio: ['ignore', 'pipe', 'ignore'],

  }));

  if (which.status === 0) {

    const line = String(which.stdout || '').split(/\r?\n/).find(Boolean);

    if (line && existsSync(line.trim())) {

      cachedRedisCli = line.trim();

      return cachedRedisCli;

    }

  }

  const whichRedis = spawnSync('where.exe', ['redis-cli'], withHiddenConsole({

    encoding: 'utf8',

    shell: false,

    stdio: ['ignore', 'pipe', 'ignore'],

  }));

  if (whichRedis.status === 0) {

    const line = String(whichRedis.stdout || '').split(/\r?\n/).find(Boolean);

    if (line && existsSync(line.trim())) {

      cachedRedisCli = line.trim();

      return cachedRedisCli;

    }

  }

  return null;

}



/** TCP-only probe for UI polling (no redis-cli subprocess). */

export async function probeRedisReachable(url = DEV_REDIS_URL) {

  const { host, port } = parseRedisUrl(url);

  return isPortOpen(host, Number.parseInt(port, 10));

}



export function pingRedis(url = DEV_REDIS_URL) {

  const { host, port } = parseRedisUrl(url);

  const cli = findRedisCli();

  if (!cli) return false;

  const result = spawnSync(cli, ['-h', host, '-p', port, 'ping'], withHiddenConsole({

    encoding: 'utf8',

    shell: false,

    timeout: 5000,

  }));

  return String(result.stdout || '').trim() === 'PONG';

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



export function startNativeRedisService() {

  if (process.platform !== 'win32') return false;

  for (const serviceName of ['Memurai', 'Redis']) {

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

  return false;

}



/**

 * Ensure native Redis/Memurai responds to PING (start Windows service when possible).

 * @returns {Promise<boolean>}

 */

export async function ensureNativeRedis() {

  if (await probeRedisReachable()) return true;

  if (process.platform === 'win32') {

    console.log('[dev-infra] 尝试启动本机 Redis/Memurai 服务…');

    startNativeRedisService();

    for (let i = 0; i < 15; i += 1) {

      if (await probeRedisReachable()) return true;

      await new Promise((r) => setTimeout(r, 1000));

    }

  }

  return pingRedis();

}


