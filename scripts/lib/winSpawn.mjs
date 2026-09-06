/**
 * PD-SAAS-FORK: Hide console windows when spawning from GUI (Electron launcher).
 */
import { execSync } from './childProcessShim.mjs';

export { withHiddenConsole } from './patchHiddenConsole.mjs';

/**
 * @param {string} command
 * @param {import('node:child_process').ExecSyncOptions} [options]
 */
export function withHiddenExecSync(command, options = {}) {
  if (process.platform !== 'win32') {
    return execSync(command, options);
  }
  return execSync(command, { ...options, windowsHide: options.windowsHide ?? true });
}
