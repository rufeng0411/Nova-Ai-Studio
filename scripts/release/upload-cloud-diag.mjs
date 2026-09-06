#!/usr/bin/env node
/**
 * 上传云端诊断包 + 可选本机 HTTP（调用 pack-cloud-diag.mjs）
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const RUN_LOCAL = process.argv.includes('--local');

const packArgs = ['--upload', ...process.argv.slice(2).filter((a) => a !== '--local')];
const pack = spawnSync(process.execPath, [join(__dirname, 'pack-cloud-diag.mjs'), ...packArgs], {
  stdio: 'inherit',
  cwd: REPO_ROOT,
});
if (pack.status !== 0) {
  process.exit(pack.status ?? 1);
}

if (RUN_LOCAL) {
  console.log('\n[cloud-diag] 本机 HTTP（--local）…\n');
  const local = spawnSync(
    process.execPath,
    [join(REPO_ROOT, 'scripts', 'diag-cloud-conversation-load.mjs'), '--skip-ecs', '--sessions', '2'],
    { stdio: 'inherit', cwd: REPO_ROOT },
  );
  process.exit(local.status ?? 0);
}

console.log('\n[cloud-diag] 完成。');
