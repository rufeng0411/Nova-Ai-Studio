#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Nightly slice — process UX + resilience + recovery baseline.
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(cmd, args, label) {
  return new Promise((resolveRun, rejectRun) => {
    console.log(`\n[process-resilience-nightly] ▶ ${label}`);
    const child = spawn(cmd, args, { cwd: repoRoot, stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('error', rejectRun);
    child.on('exit', (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${label} exited ${code ?? 'null'}`));
    });
  });
}

async function main() {
  await run(npmCmd, ['run', 'test:process-ux:full'], 'test:process-ux:full');
  await run(npmCmd, ['run', 'smoke:resilience'], 'smoke:resilience');
  await run(npmCmd, ['run', 'recovery:baseline'], 'recovery:baseline');
  await run(npmCmd, ['run', 'test:multi-skill:matrix'], 'test:multi-skill:matrix');

  if (process.env.PROCESS_NIGHTLY_LIVE === '1') {
    await run(npmCmd, ['run', 'test:multi-user:sim'], 'test:multi-user:sim');
  } else {
    console.log('\n[process-resilience-nightly] SKIP test:multi-user:sim (set PROCESS_NIGHTLY_LIVE=1 for live Gateway)');
  }

  console.log('\n[process-resilience-nightly] ALL PASS');
}

main().catch((error) => {
  console.error('[process-resilience-nightly] FAIL:', error instanceof Error ? error.message : error);
  process.exit(1);
});
