#!/usr/bin/env node
/**
 * Thin wrapper: delegates to repo-root pack-social-matrix-yixiaoer.mjs
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PACK = path.join(REPO_ROOT, 'scripts', 'pack-social-matrix-yixiaoer.mjs');

const result = spawnSync(process.execPath, [PACK, ...process.argv.slice(2)], {
  cwd: REPO_ROOT,
  stdio: 'inherit',
  shell: false,
});
process.exit(result.status ?? 1);
