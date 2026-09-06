/**
 * PD-SAAS-FORK: Start gateway / bridge / vite without flashing Windows cmd windows.
 */
import './patchHiddenConsole.mjs';
import cp from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withHiddenConsole } from './winSpawn.mjs';
import { withHiddenConsoleEnv, getPatchImportUrl } from './hiddenConsoleEnv.mjs';

const spawn = cp.spawn.bind(cp);
const spawnSync = cp.spawnSync.bind(cp);
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * @param {string} repoRoot
 * @param {NodeJS.ProcessEnv} env
 * @param {(tag: string, line: string) => void} onLine
 */
export function spawnHeadlessDevStack(repoRoot, env, onLine) {
  const uiRoot = join(repoRoot, 'ui');
  const nodeBin = pickNodeBin(env);
  const gatewayEntry = join(repoRoot, 'src', 'cli', 'pilotdeck.ts');
  const patchImport = getPatchImportUrl(repoRoot);
  const stackEnv = withHiddenConsoleEnv(env, repoRoot);

  const specs = [
    {
      tag: 'gateway',
      cmd: nodeBin,
      args: ['--import', patchImport, '--import', 'tsx', gatewayEntry, 'server'],
      cwd: repoRoot,
      shell: false,
    },
    {
      tag: 'server',
      cmd: nodeBin,
      args: ['--import', patchImport, '--import', 'tsx', 'server/index.js'],
      cwd: uiRoot,
      shell: false,
    },
    {
      tag: 'client',
      cmd: nodeBin,
      args: ['--import', patchImport, resolveViteBin(uiRoot)],
      cwd: uiRoot,
      shell: false,
    },
  ];

  const children = specs.map((spec) => {
    const child = spawn(
      spec.cmd,
      spec.args,
      withHiddenConsole({
        cwd: spec.cwd,
        env: stackEnv,
        shell: spec.shell,
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    );
    const route = (buf) => {
      for (const line of buf.toString().split(/\r?\n/)) {
        const trimmed = line.trimEnd();
        if (trimmed) onLine(spec.tag, trimmed);
      }
    };
    child.stdout?.on('data', route);
    child.stderr?.on('data', route);
    return child;
  });

  return {
    children,
    killAll() {
      for (const child of children) {
        if (!child.pid) continue;
        if (process.platform === 'win32') {
          spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], withHiddenConsole({ stdio: 'ignore', shell: false }));
        } else {
          child.kill('SIGTERM');
        }
      }
    },
  };
}

function pickNodeBin(env) {
  const candidates = [env.npm_node_execpath, env.NODE, process.env.npm_node_execpath, process.env.NODE, 'node'];
  for (const c of candidates) {
    const v = typeof c === 'string' ? c.trim() : '';
    if (v && (v === 'node' || existsSync(v))) return v;
  }
  return process.platform === 'win32' ? 'node.exe' : 'node';
}

function resolveViteBin(uiRoot) {
  const direct = join(uiRoot, 'node_modules', 'vite', 'bin', 'vite.js');
  if (existsSync(direct)) return direct;
  const hoisted = join(uiRoot, '..', 'node_modules', 'vite', 'bin', 'vite.js');
  if (existsSync(hoisted)) return hoisted;
  try {
    const require = createRequire(join(uiRoot, 'package.json'));
    return require.resolve('vite/bin/vite.js');
  } catch {
    throw new Error(`Vite 未安装或路径缺失: ${direct}（请在仓库根目录执行 npm install）`);
  }
}
