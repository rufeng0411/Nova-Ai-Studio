#!/usr/bin/env node
/**
 * L3 OSS regression — P1–P4 (requires dev server; set VITE_URL or PLAYWRIGHT_BASE_URL).
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const viteUrl = (
  process.env.VITE_URL
  || process.env.PLAYWRIGHT_BASE_URL
  || 'http://127.0.0.1:5173'
).replace(/\/$/, '');

function runNode(script, args = []) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: repoRoot,
      env: { ...process.env, VITE_URL: viteUrl, PLAYWRIGHT_BASE_URL: viteUrl },
      stdio: 'inherit',
    });
    child.on('error', rejectRun);
    child.on('exit', (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${script} exited with ${code ?? 'null'}`));
    });
  });
}

async function main() {
  console.log(`[oss-regression] base URL: ${viteUrl}`);
  await runNode('scripts/check-white-screen.mjs', [`${viteUrl}/p/general`]);
  await runNode('scripts/ui-regression-check.mjs');
  await runNode('scripts/ui-artifact-preview-check.mjs');
  if (process.env.OSS_REGRESSION_SKIP_YIXIAOER !== '1') {
    await runNode('scripts/ui-yixiaoer-regression-check.mjs');
  } else {
    console.log('[oss-regression] skip P4 (OSS_REGRESSION_SKIP_YIXIAOER=1)');
  }
  console.log('[oss-regression] OK');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
