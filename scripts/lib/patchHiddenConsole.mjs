/**
 * PD-SAAS-FORK: On Windows, force hidden subprocesses (no CMD flash).
 * - windowsHide + CREATE_NO_WINDOW on all spawns
 * - shell:true → cmd.exe /d /s /c … with shell:false
 * - npm.cmd / npx.cmd → node npm-cli.js (no cmd host)
 *
 * Import once at process entry (Gateway / Bridge / Launcher / dev scripts).
 */
import cp from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const PATCH_FLAG = '__NOVA_PATCH_HIDDEN_CONSOLE__';
const COMSPEC = process.env.ComSpec || 'cmd.exe';
/** Win32 CREATE_NO_WINDOW — belt-and-suspenders with windowsHide */
const CREATE_NO_WINDOW = 0x08000000;

/** Optional: set NOVA_LOG_HIDDEN_SPAWNS=1 to append spawn audit log */
const LOG_PATH =
  process.env.NOVA_HIDDEN_SPAWN_LOG ||
  join(process.env.LOCALAPPDATA || process.env.TEMP || '.', 'NovaAiStudio', 'hidden-spawn.log');

function shouldLogSpawns() {
  return process.env.NOVA_LOG_HIDDEN_SPAWNS === '1';
}

function logSpawnSync(kind, command, args, options) {
  if (!shouldLogSpawns()) return;
  try {
    mkdirSync(dirname(LOG_PATH), { recursive: true });
    appendFileSync(
      LOG_PATH,
      `${JSON.stringify({
        ts: new Date().toISOString(),
        pid: process.pid,
        kind,
        command: String(command),
        shell: options?.shell,
        detached: options?.detached,
      })}\n`,
      'utf8',
    );
  } catch {
    // ignore
  }
}

function mergeHidden(options) {
  const base = options == null || typeof options !== 'object' ? {} : { ...options };
  // GUI 子进程（Electron）：显式 windowsHide:false，避免 rewriteWindowsSpawn 再默认藏窗
  if (base.allowGuiWindow) {
    const next = { ...base, windowsHide: false };
    delete next.allowGuiWindow;
    return next;
  }
  const next = { ...base, windowsHide: base.windowsHide ?? true };
  if (process.platform === 'win32') {
    next.creationFlags = (next.creationFlags ?? 0) | CREATE_NO_WINDOW;
    if (next.detached !== true) {
      next.detached = false;
    }
  }
  return next;
}

function normalizeSpawnArgs(command, args, options) {
  let cmd = command;
  let cmdArgs = args;
  let opts = options;
  if (cmdArgs != null && typeof cmdArgs === 'object' && !Array.isArray(cmdArgs)) {
    opts = cmdArgs;
    cmdArgs = [];
  }
  opts = mergeHidden(opts);
  return { cmd, cmdArgs: cmdArgs ?? [], opts };
}

function quoteCmdArg(arg) {
  const s = String(arg);
  if (!/[\s"&|<>^]/.test(s)) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

function buildShellLine(cmd, cmdArgs) {
  if (!cmdArgs.length) return String(cmd);
  return [cmd, ...cmdArgs].map(quoteCmdArg).join(' ');
}

function resolveNpmCli() {
  const candidates = [
    join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    join(dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

function resolveNpxCli() {
  const candidates = [
    join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js'),
    join(dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npx-cli.js'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Rewrite npm.cmd / shell:true spawns into hidden node/cmd invocations.
 */
function rewriteWindowsSpawn(cmd, cmdArgs, opts) {
  if (process.platform !== 'win32') {
    return { cmd, cmdArgs, opts };
  }

  const base = String(cmd).toLowerCase().replace(/\\/g, '/');
  const baseName = base.split('/').pop() || base;

  if (baseName === 'npm.cmd' || baseName === 'npm') {
    const npmCli = resolveNpmCli();
    if (npmCli) {
      return {
        cmd: process.execPath,
        cmdArgs: [npmCli, ...cmdArgs],
        opts: { ...opts, shell: false, windowsHide: true },
      };
    }
  }

  if (baseName === 'npx.cmd' || baseName === 'npx') {
    const npxCli = resolveNpxCli();
    if (npxCli) {
      return {
        cmd: process.execPath,
        cmdArgs: [npxCli, ...cmdArgs],
        opts: { ...opts, shell: false, windowsHide: true },
      };
    }
  }

  if (opts.shell) {
    const line = buildShellLine(cmd, cmdArgs);
    return {
      cmd: COMSPEC,
      cmdArgs: ['/d', '/s', '/c', line],
      opts: mergeHidden({ ...opts, shell: false, windowsHide: true }),
    };
  }

  // 所有控制台宿主（powershell / taskkill / pg_ctl / sc.exe …）统一 CREATE_NO_WINDOW
  return { cmd, cmdArgs, opts: mergeHidden({ ...opts, windowsHide: opts.windowsHide ?? true }) };
}

function patchChildProcess() {
  if (process.platform !== 'win32') return;
  if (globalThis[PATCH_FLAG]) return;
  globalThis[PATCH_FLAG] = true;

  const origSpawn = cp.spawn.bind(cp);
  cp.spawn = function patchedSpawn(command, args, options) {
    let { cmd, cmdArgs, opts } = normalizeSpawnArgs(command, args, options);
    ({ cmd, cmdArgs, opts } = rewriteWindowsSpawn(cmd, cmdArgs, opts));
    logSpawnSync('spawn', cmd, cmdArgs, opts);
    return origSpawn(cmd, cmdArgs, opts);
  };

  const origSpawnSync = cp.spawnSync.bind(cp);
  cp.spawnSync = function patchedSpawnSync(command, args, options) {
    let { cmd, cmdArgs, opts } = normalizeSpawnArgs(command, args, options);
    ({ cmd, cmdArgs, opts } = rewriteWindowsSpawn(cmd, cmdArgs, opts));
    logSpawnSync('spawnSync', cmd, cmdArgs, opts);
    return origSpawnSync(cmd, cmdArgs, opts);
  };

  const origExec = cp.exec.bind(cp);
  cp.exec = function patchedExec(command, options, callback) {
    if (typeof options === 'function') {
      return origExec(command, mergeHidden(undefined), options);
    }
    return origExec(command, mergeHidden(options), callback);
  };

  const origExecSync = cp.execSync.bind(cp);
  cp.execSync = function patchedExecSync(command, options) {
    return origExecSync(command, mergeHidden(options));
  };

  const origExecFile = cp.execFile.bind(cp);
  cp.execFile = function patchedExecFile(file, args, options, callback) {
    if (typeof args === 'function') {
      return origExecFile(file, mergeHidden(undefined), args);
    }
    if (args != null && typeof args === 'object' && !Array.isArray(args)) {
      if (typeof options === 'function') {
        return origExecFile(file, mergeHidden(args), options);
      }
      return origExecFile(file, mergeHidden(args), options);
    }
    if (typeof options === 'function') {
      return origExecFile(file, args, mergeHidden(undefined), options);
    }
    return origExecFile(file, args, mergeHidden(options), callback);
  };

  const origExecFileSync = cp.execFileSync.bind(cp);
  cp.execFileSync = function patchedExecFileSync(file, args, options) {
    if (args != null && typeof args === 'object' && !Array.isArray(args)) {
      return origExecFileSync(file, mergeHidden(args));
    }
    return origExecFileSync(file, args, mergeHidden(options));
  };

  const origFork = cp.fork.bind(cp);
  cp.fork = function patchedFork(modulePath, args, options) {
    if (args != null && typeof args === 'object' && !Array.isArray(args)) {
      return origFork(modulePath, mergeHidden(args));
    }
    return origFork(modulePath, args, mergeHidden(options));
  };
}

patchChildProcess();

export { mergeHidden as withHiddenConsole, LOG_PATH as HIDDEN_SPAWN_LOG_PATH, CREATE_NO_WINDOW };
