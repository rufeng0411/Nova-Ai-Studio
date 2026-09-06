#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Launch Nova Dev Console — minimal, reliable Windows entry.
 * Electron 不走 patchHiddenConsole（会破坏渲染进程）；仅 npm install 等用隐藏 spawn。
 */
import cp from 'node:child_process';
import { spawnSync } from '../../../scripts/lib/childProcessShim.mjs';
import { withHiddenConsole } from '../../../scripts/lib/patchHiddenConsole.mjs';
import { appendFileSync, closeSync, existsSync, openSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clearLauncherPidFile,
  focusLauncherWindow,
  forceCleanLauncherProcesses,
  isPidAlive,
  launcherHasVisibleWindow,
  launcherLogPath,
  readLauncherPid,
} from './launcherInstance.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const launcherDir = join(__dirname, '..');
const repoRoot = resolve(process.env.NOVA_REPO_ROOT || join(launcherDir, '../..'));
const logFile = launcherLogPath(launcherDir);
const lockPath = join(launcherDir, '.launcher-starting.lock');

function log(line) {
  try {
    appendFileSync(logFile, `[${new Date().toISOString()}] ${line}\n`, 'utf8');
  } catch {
    // ignore
  }
}

function notifyUser(message) {
  if (process.platform !== 'win32') return;
  try {
    const safe = String(message).slice(0, 400).replace(/'/g, "''");
    spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-WindowStyle',
        'Hidden',
        '-Command',
        `Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('${safe}','Nova 启动器','OK','Warning') | Out-Null`,
      ],
      withHiddenConsole({ shell: false, stdio: 'ignore' }),
    );
  } catch {
    // ignore
  }
}

function hiddenSpawnSync(command, args, opts = {}) {
  return spawnSync(command, args, withHiddenConsole({
    cwd: launcherDir,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, NOVA_REPO_ROOT: repoRoot },
    ...opts,
  }));
}

function ensureDeps() {
  if (existsSync(join(launcherDir, 'node_modules', 'electron'))) return;
  log('installing launcher dependencies');
  const npmCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  if (existsSync(npmCli)) {
    const r = hiddenSpawnSync(process.execPath, [npmCli, 'install'], { cwd: launcherDir });
    if (r.status !== 0) throw new Error(`npm install failed (${r.status ?? '?'})`);
    return;
  }
  const r = hiddenSpawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install'], { cwd: launcherDir });
  if (r.status !== 0) throw new Error(`npm install failed (${r.status ?? '?'})`);
}

function ensureBuild() {
  const required = [
    join(launcherDir, 'dist-main/main/index.js'),
    join(launcherDir, 'dist-preload/preload/index.cjs'),
    join(launcherDir, 'dist-renderer/index.html'),
  ];
  if (required.every(existsSync)) return;

  log('building launcher artifacts');
  const tsc = join(launcherDir, 'node_modules/typescript/bin/tsc');
  const vite = join(launcherDir, 'node_modules/vite/bin/vite.js');
  for (const [cmd, args] of [
    [tsc, ['-p', 'tsconfig.main.json']],
    [tsc, ['-p', 'tsconfig.preload.json']],
    [process.execPath, ['scripts/finalize-preload.mjs']],
    [process.execPath, [vite, 'build']],
  ]) {
    const r = hiddenSpawnSync(cmd, args);
    if (r.status !== 0) throw new Error(`build failed: ${cmd}`);
  }
}

/** Electron 子进程环境：剥离会破坏 GPU/渲染的 NODE_OPTIONS */
function buildElectronEnv() {
  const env = { ...process.env };
  env.NOVA_REPO_ROOT = repoRoot;
  env.ELECTRON_NO_ATTACH_CONSOLE = '1';
  env.NODE_ENV = env.NODE_ENV || 'production';
  const raw = String(env.NODE_OPTIONS || '').trim();
  if (raw) {
    const cleaned = raw
      .split(/\s+/)
      .filter((tok) => tok && !tok.includes('patchHiddenConsole.mjs'))
      .join(' ')
      .trim();
    if (cleaned) env.NODE_OPTIONS = cleaned;
    else delete env.NODE_OPTIONS;
  }
  return env;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function removeLock() {
  try {
    if (existsSync(lockPath)) unlinkSync(lockPath);
  } catch {
    // ignore
  }
}

async function waitForLauncherWindow(timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const pid = readLauncherPid(launcherDir);
    if (pid && isPidAlive(pid) && launcherHasVisibleWindow(pid)) return true;
    await sleep(400);
  }
  const pid = readLauncherPid(launcherDir);
  return Boolean(pid && isPidAlive(pid));
}

function launchElectron() {
  const require = createRequire(import.meta.url);
  const electronPath = require('electron');
  log(`electron bin: ${electronPath}`);

  const child = cp.spawn(electronPath, ['.'], {
    cwd: launcherDir,
    env: buildElectronEnv(),
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
    shell: false,
  });
  child.unref();
  return child.pid ?? null;
}

process.chdir(launcherDir);
process.env.NOVA_REPO_ROOT = repoRoot;

try {
  const existingPid = readLauncherPid(launcherDir);
  if (existingPid && isPidAlive(existingPid) && launcherHasVisibleWindow(existingPid)) {
    log('already running — focus');
    focusLauncherWindow(launcherDir);
    process.exit(0);
  }

  forceCleanLauncherProcesses(launcherDir);
  removeLock();

  let lockFd;
  try {
    lockFd = openSync(lockPath, 'wx');
  } catch {
    log('start lock busy — retry after clean');
    forceCleanLauncherProcesses(launcherDir);
    removeLock();
    lockFd = openSync(lockPath, 'wx');
  }

  try {
    ensureDeps();
    ensureBuild();
    log('spawning electron');
    const spawnedPid = launchElectron();
    if (!spawnedPid) throw new Error('无法拉起 Electron 进程');

    const ok = await waitForLauncherWindow();
    if (!ok) {
      forceCleanLauncherProcesses(launcherDir);
      throw new Error('启动器窗口未出现（可能被杀软拦截或 Electron 崩溃），请查看 .launcher-start.log');
    }
    log(`electron ready pid=${readLauncherPid(launcherDir) ?? spawnedPid}`);
  } finally {
    if (lockFd != null) {
      try {
        closeSync(lockFd);
      } catch {
        // ignore
      }
    }
    removeLock();
  }
} catch (err) {
  removeLock();
  forceCleanLauncherProcesses(launcherDir);
  const msg = err instanceof Error ? err.message : String(err);
  log(`fatal: ${msg}`);
  notifyUser(`Nova 启动器未能打开：\n${msg}`);
  process.exit(1);
}
