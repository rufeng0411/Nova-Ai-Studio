/**
 * PD-SAAS-FORK: Detect / focus / recover Nova Dev Console on Windows (hidden subprocesses).
 */
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from '../../../scripts/lib/childProcessShim.mjs';
import { withHiddenConsole } from '../../../scripts/lib/patchHiddenConsole.mjs';

/**
 * @param {string} launcherDir
 */
export function launcherPidPath(launcherDir) {
  return join(launcherDir, '.launcher-instance.pid');
}

/**
 * @param {number} pid
 */
export function isPidAlive(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} launcherDir
 * @returns {number | null}
 */
export function readLauncherPid(launcherDir) {
  const path = launcherPidPath(launcherDir);
  if (!existsSync(path)) return null;
  try {
    const pid = Number.parseInt(String(readFileSync(path, 'utf8')).trim(), 10);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} launcherDir
 */
export function clearLauncherPidFile(launcherDir) {
  try {
    const path = launcherPidPath(launcherDir);
    if (existsSync(path)) unlinkSync(path);
  } catch {
    // ignore
  }
}

/**
 * @param {number} pid
 */
export function launcherHasVisibleWindow(pid) {
  if (process.platform !== 'win32') return true;
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-WindowStyle',
      'Hidden',
      '-Command',
      `$p=Get-Process -Id ${pid} -EA SilentlyContinue;if($null -eq $p){exit 2};if($p.MainWindowHandle -eq 0){exit 1};exit 0`,
    ],
    withHiddenConsole({ encoding: 'utf8', shell: false, stdio: ['ignore', 'pipe', 'ignore'] }),
  );
  return result.status === 0;
}

/**
 * @param {number} pid
 */
export function killLauncherTree(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return;
  if (process.platform === 'win32') {
    spawnSync(
      'taskkill',
      ['/pid', String(pid), '/T', '/F'],
      withHiddenConsole({ stdio: 'ignore', shell: false }),
    );
    return;
  }
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // ignore
  }
}

/**
 * @param {string} launcherDir
 */
export function listLauncherMainPids(launcherDir) {
  if (process.platform !== 'win32') return [];
  const marker = launcherDir.replace(/\\/g, '\\\\').replace(/'/g, "''");
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-WindowStyle',
      'Hidden',
      '-Command',
      `$m='${marker}'; Get-CimInstance Win32_Process -Filter "Name='electron.exe'" -EA SilentlyContinue | Where-Object { $_.CommandLine -like "*$m*" -and $_.CommandLine -notmatch '--type=' } | ForEach-Object { $_.ProcessId }`,
    ],
    withHiddenConsole({ encoding: 'utf8', shell: false, stdio: ['ignore', 'pipe', 'ignore'] }),
  );
  if (result.status !== 0) return [];
  return String(result.stdout || '')
    .split(/\r?\n/)
    .map((line) => Number.parseInt(line.trim(), 10))
    .filter((pid) => Number.isFinite(pid) && pid > 0);
}

/**
 * @param {string} launcherDir
 */
export function forceCleanLauncherProcesses(launcherDir) {
  const pid = readLauncherPid(launcherDir);
  if (pid) killLauncherTree(pid);
  clearLauncherPidFile(launcherDir);
  for (const p of listLauncherMainPids(launcherDir)) {
    killLauncherTree(p);
  }
}

/**
 * @param {string} launcherDir
 */
export function focusLauncherWindow(launcherDir) {
  if (process.platform !== 'win32') return false;
  const pid = readLauncherPid(launcherDir);
  if (!pid || !isPidAlive(pid) || !launcherHasVisibleWindow(pid)) return false;

  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-WindowStyle',
      'Hidden',
      '-Command',
      [
        'Add-Type @"',
        'using System;using System.Runtime.InteropServices;',
        'public class NovaWin {',
        ' [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);',
        ' [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd,int n);',
        '}"@',
        `$p=Get-Process -Id ${pid} -EA SilentlyContinue`,
        'if($null -eq $p -or $p.MainWindowHandle -eq 0){exit 1}',
        '[void][NovaWin]::ShowWindowAsync($p.MainWindowHandle,9)',
        '[void][NovaWin]::SetForegroundWindow($p.MainWindowHandle)',
        'exit 0',
      ].join(';'),
    ],
    withHiddenConsole({ encoding: 'utf8', shell: false, stdio: ['ignore', 'pipe', 'ignore'] }),
  );
  return result.status === 0;
}

/**
 * @param {string} launcherDir
 */
export function launcherLogPath(launcherDir) {
  return join(launcherDir, '.launcher-start.log');
}

export const recoverStaleLauncher = forceCleanLauncherProcesses;

export function isLauncherRunning(launcherDir) {
  const pid = readLauncherPid(launcherDir);
  if (!pid || !isPidAlive(pid)) {
    clearLauncherPidFile(launcherDir);
    return false;
  }
  return launcherHasVisibleWindow(pid);
}
