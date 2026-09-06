/**
 * PD-SAAS-FORK: Patched child_process for Electron main — named ESM imports bypass patch.
 */
import '../../../../scripts/lib/patchHiddenConsole.mjs';
import cp from 'node:child_process';
export const spawn = cp.spawn.bind(cp);
export const spawnSync = cp.spawnSync.bind(cp);
export const exec = cp.exec.bind(cp);
export const execSync = cp.execSync.bind(cp);
export const execFile = cp.execFile.bind(cp);
export const execFileSync = cp.execFileSync.bind(cp);
export const fork = cp.fork.bind(cp);
