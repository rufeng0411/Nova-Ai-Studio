/**
 * Build artifact sanity checks for Nova Dev Launcher.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const required = [
  'dist-main/main/index.js',
  'dist-main/main/supervisor.js',
  'dist-main/main/ipc.js',
  'dist-preload/preload/index.cjs',
  'dist-renderer/index.html',
];

const failures = [];

for (const rel of required) {
  const abs = join(root, rel);
  if (!existsSync(abs)) {
    failures.push(`missing: ${rel}`);
  }
}

const preloadPath = join(root, 'dist-preload/preload/index.cjs');
if (existsSync(preloadPath)) {
  const text = readFileSync(preloadPath, 'utf8');
  if (text.includes('export ')) {
    failures.push('preload must be CJS bundle without top-level export');
  }
  if (!text.includes('contextBridge')) {
    failures.push('preload missing contextBridge');
  }
}

const forbiddenPreloadJs = join(root, 'dist-preload/preload/index.js');
if (existsSync(forbiddenPreloadJs)) {
  failures.push('dist-preload/preload/index.js must not exist (use index.cjs)');
}

if (failures.length) {
  console.error('[check-artifacts] FAIL');
  for (const f of failures) console.error('  -', f);
  process.exit(1);
}

console.log('[check-artifacts] OK —', required.length, 'artifacts');
