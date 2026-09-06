/**
 * PD-SAAS-FORK: Re-export hidden-console helpers for TypeScript entrypoints.
 */
import type { SpawnOptions, SpawnSyncOptions } from 'node:child_process';

import '../../scripts/lib/patchHiddenConsole.mjs';

export function withHiddenConsole<T extends SpawnOptions>(options: T): T {
  if (process.platform !== 'win32') return options;
  return { ...options, windowsHide: options.windowsHide ?? true };
}

export function withHiddenConsoleSync<T extends SpawnSyncOptions>(options: T): T {
  if (process.platform !== 'win32') return options;
  return { ...options, windowsHide: options.windowsHide ?? true };
}
