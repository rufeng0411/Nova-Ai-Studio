/**
 * PD-SAAS-FORK: NODE_OPTIONS + env helpers so every Node child inherits hidden-console patch.
 */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const PATCH_MARKER = 'patchHiddenConsole.mjs';

/**
 * @param {string} repoRoot
 */
export function getPatchImportUrl(repoRoot) {
  return pathToFileURL(join(repoRoot, 'scripts/lib/patchHiddenConsole.mjs')).href;
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {string} repoRoot
 * @returns {NodeJS.ProcessEnv}
 */
export function withHiddenConsoleEnv(env, repoRoot) {
  if (process.platform !== 'win32') return env;
  const patch = getPatchImportUrl(repoRoot);
  const flag = `--import ${patch}`;
  const existing = String(env.NODE_OPTIONS || '').trim();
  if (existing.includes(PATCH_MARKER)) return env;
  return {
    ...env,
    NODE_OPTIONS: existing ? `${existing} ${flag}` : flag,
    ELECTRON_NO_ATTACH_CONSOLE: env.ELECTRON_NO_ATTACH_CONSOLE || '1',
  };
}
