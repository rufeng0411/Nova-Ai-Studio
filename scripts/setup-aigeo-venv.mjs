#!/usr/bin/env node
/**
 * Optional venv for geo_api score/verify helpers (httpx for Bocha). Quick score works without venv.
 */
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VENV = path.join(REPO_ROOT, '.cache', 'aigeo-venv');

function pyCmd() {
  for (const bin of ['python3', 'python']) {
    const v = spawnSync(bin, ['--version'], { encoding: 'utf8' });
    if (v.status === 0) return bin;
  }
  return null;
}

const py = pyCmd();
if (!py) {
  console.error('[setup-aigeo-venv] Python not found — skip venv');
  process.exit(0);
}

const venvPy =
  process.platform === 'win32'
    ? path.join(VENV, 'Scripts', 'python.exe')
    : path.join(VENV, 'bin', 'python');

if (!existsSync(venvPy)) {
  mkdirSync(path.dirname(VENV), { recursive: true });
  const create = spawnSync(py, ['-m', 'venv', VENV], { cwd: REPO_ROOT, stdio: 'inherit' });
  if (create.status !== 0) process.exit(create.status ?? 1);
}

const pip = spawnSync(venvPy, ['-m', 'pip', 'install', 'httpx>=0.24'], {
  cwd: REPO_ROOT,
  stdio: 'inherit',
});
process.exit(pip.status === 0 ? 0 : pip.status ?? 1);
