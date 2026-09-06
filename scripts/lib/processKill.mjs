/**
 * PD-SAAS-FORK: Cross-platform port/process kill helpers for dev restart.
 */
import { spawn, spawnSync } from './childProcessShim.mjs';
import { withHiddenConsole } from './winSpawn.mjs';

/**
 * @param {number | string} port
 */
export function killPort(port) {
  killPorts([port]);
}

/**
 * @param {number | string[]} ports
 * @returns {Promise<void>}
 */
export function killPortsAsync(ports) {
  const unique = [...new Set(ports.map((p) => Number.parseInt(String(p), 10)).filter((p) => Number.isFinite(p) && p > 0))];
  if (!unique.length) return Promise.resolve();

  if (process.platform === 'win32') {
    const pids = findWindowsPidsOnPorts(unique);
    if (!pids.length) return Promise.resolve();
    return Promise.all(
      pids.map(
        (pid) =>
          new Promise((resolve) => {
            const child = spawn(
              'taskkill',
              ['/pid', String(pid), '/T', '/F'],
              withHiddenConsole({ stdio: 'ignore', shell: false }),
            );
            child.on('exit', () => resolve());
            child.on('error', () => resolve());
          }),
      ),
    ).then(() => undefined);
  }

  return Promise.all(
    unique.map(
      (port) =>
        new Promise((resolve) => {
          const child = spawn(
            'sh',
            ['-c', `lsof -ti:${port} | xargs -r kill -9 2>/dev/null || fuser -k ${port}/tcp 2>/dev/null || true`],
            { stdio: 'ignore', shell: false },
          );
          child.on('exit', () => resolve());
          child.on('error', () => resolve());
        }),
    ),
  ).then(() => undefined);
}

/**
 * @param {number | string[]} ports
 */
export function killPorts(ports) {
  const unique = [...new Set(ports.map((p) => Number.parseInt(String(p), 10)).filter((p) => Number.isFinite(p) && p > 0))];
  if (!unique.length) return;

  if (process.platform === 'win32') {
    for (const pid of findWindowsPidsOnPorts(unique)) {
      spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], withHiddenConsole({ stdio: 'ignore', shell: false }));
    }
    return;
  }

  for (const port of unique) {
    spawnSync('sh', ['-c', `lsof -ti:${port} | xargs -r kill -9 2>/dev/null || fuser -k ${port}/tcp 2>/dev/null || true`], {
      stdio: 'ignore',
      shell: false,
    });
  }
}

/**
 * @param {import('node:child_process').ChildProcess | null | undefined} child
 * @param {string} [signal]
 */
export function killChildTree(child, signal = 'SIGTERM') {
  if (!child || child.killed) return;
  if (process.platform === 'win32' && child.pid) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], withHiddenConsole({ stdio: 'ignore', shell: false }));
    return;
  }
  child.kill(signal);
}

/**
 * @param {number[]} ports
 * @returns {number[]}
 */
function findWindowsPidsOnPorts(ports) {
  const want = new Set(ports);
  const result = spawnSync('netstat', ['-ano'], withHiddenConsole({ encoding: 'utf8', shell: false }));
  if (result.status !== 0) return [];
  const pids = new Set();
  for (const line of String(result.stdout || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!/^TCP/i.test(trimmed)) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 5) continue;
    const local = parts[1] || '';
    const pid = Number.parseInt(parts[parts.length - 1], 10);
    const portMatch = local.match(/:(\d+)$/);
    const port = portMatch ? Number.parseInt(portMatch[1], 10) : NaN;
    if (!Number.isFinite(pid) || pid <= 0 || !want.has(port)) continue;
    pids.add(pid);
  }
  return [...pids];
}
