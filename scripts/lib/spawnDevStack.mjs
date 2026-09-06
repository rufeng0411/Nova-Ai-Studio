/**
 * PD-SAAS-FORK: Start gateway / bridge / vite without flashing Windows CMD windows.
 * Windows uses direct node spawns (devConcurrentHeadless); other platforms use npm dev:concurrent.
 */
import './patchHiddenConsole.mjs';
import { spawn } from './childProcessShim.mjs';
import { withHiddenConsole } from './winSpawn.mjs';
import { killChildTree } from './processKill.mjs';

/**
 * @typedef {object} DevStackHandle
 * @property {import('node:child_process').ChildProcess[]} children
 * @property {(signal?: NodeJS.Signals) => void} kill
 * @property {(cb: (code: number | null, signal: NodeJS.Signals | null) => void) => void} onExit
 */

/**
 * @param {string} repoRoot
 * @param {NodeJS.ProcessEnv} env
 * @param {{ log?: boolean, onLine?: (tag: string, line: string) => void }} [options]
 * @returns {Promise<DevStackHandle>}
 */
export async function runDevStack(repoRoot, env, options = {}) {
  const shouldLog = options.log !== false;
  const routeLine = (tag, line) => {
    if (shouldLog) console.log(`[${tag}] ${line}`);
    options.onLine?.(tag, line);
  };

  if (process.platform === 'win32') {
    const { spawnHeadlessDevStack } = await import('./devConcurrentHeadless.mjs');
    const handle = spawnHeadlessDevStack(repoRoot, env, routeLine);
    let notified = false;
    const exitCallbacks = [];

    const notifyExit = (code, signal) => {
      if (notified) return;
      notified = true;
      for (const cb of exitCallbacks) cb(code, signal);
    };

    for (const child of handle.children) {
      child.on('exit', (code, signal) => notifyExit(code, signal));
    }

    return {
      children: handle.children,
      kill: () => handle.killAll(),
      onExit: (cb) => exitCallbacks.push(cb),
    };
  }

  const npmCmd = 'npm';
  const child = spawn(
    npmCmd,
    ['--workspace', 'ui', 'run', 'dev:concurrent'],
    withHiddenConsole({
      cwd: repoRoot,
      env,
      stdio: 'inherit',
      shell: false,
    }),
  );

  const exitCallbacks = [];
  child.on('exit', (code, signal) => {
    for (const cb of exitCallbacks) cb(code, signal);
  });

  return {
    children: [child],
    kill: (signal = 'SIGTERM') => killChildTree(child, signal),
    onExit: (cb) => exitCallbacks.push(cb),
  };
}
