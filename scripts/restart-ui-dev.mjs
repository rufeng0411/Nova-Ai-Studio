#!/usr/bin/env node
/**
 * Windows-friendly dev restart — kill dev ports, then spawn SaaS stack (default).
 * Same entry as `npm run dev` (SaaS: PILOTDECK_SAAS_MODE, DATA_ROOT, Redis/PG).
 * PD-SAAS-FORK: no detached CMD window — stack runs in the current terminal headlessly on Windows.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PORTS, prepareSaasDevRuntime, collectAllDevPorts, MAX_PORT_TRIES } from './lib/devLauncherCore.mjs';
import { killPorts } from './lib/processKill.mjs';
import { withHiddenConsole } from './lib/winSpawn.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const runtime = await prepareSaasDevRuntime(ROOT);
  const ports = new Set([
    ...collectAllDevPorts({ maxOffsets: MAX_PORT_TRIES }),
    runtime.ports.vite,
    runtime.ports.server,
    runtime.ports.gateway,
    process.env.VITE_PORT,
    process.env.SERVER_PORT,
    process.env.PILOTDECK_GATEWAY_PORT,
    DEFAULT_PORTS.vite,
    DEFAULT_PORTS.server,
    DEFAULT_PORTS.gateway,
  ]);
  killPorts([...ports]);

  console.warn('[restart-ui-dev] 警告：将杀掉 dev 端口进程，进行中的对话会被中断；请待任务完成后再重启');

  console.log('[restart-ui-dev] starting dev stack (SaaS mode, no extra CMD windows)');
  const devEntry = path.join(ROOT, 'scripts', 'dev-saas.mjs');
  const child = spawn(process.execPath, [devEntry], withHiddenConsole({
    cwd: ROOT,
    env: process.env,
    stdio: 'inherit',
    shell: false,
    detached: false,
  }));

  const forward = (signal) => {
    if (!child.killed) child.kill(signal);
  };
  process.on('SIGINT', () => forward('SIGINT'));
  process.on('SIGTERM', () => forward('SIGTERM'));

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
