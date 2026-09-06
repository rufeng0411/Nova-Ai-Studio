import { type ChildProcess, spawn, spawnSync } from './childProcess.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createConnection } from 'node:net';
import type {
  AlertItem,
  LogChannel,
  LogEntry,
  RuntimeInfo,
  ServiceId,
  ServiceState,
} from '../shared/types.js';
import { classifyLineSync, loadLogClassifier, setClassifierRepoRoot } from './logBridge.js';
import { adjustLogLevel, shouldSkipLogLine } from './logSanitize.js';
import { resolveNodeBin, resolveNpmBin, withHiddenConsole } from './nodeBin.js';
import { findRepoRoot, checkPrerequisites } from './repoRoot.js';

interface DevRuntime {
  repoRoot: string;
  dataRoot: string;
  infra: { redis: boolean; postgres: boolean; started: boolean; pgUrl?: string | null };
  useSqliteOnly: boolean;
  ports: { server: number; gateway: number; vite: number };
  portMeta: unknown;
  env: NodeJS.ProcessEnv;
  gatewayUrl: string;
  dbBackend: string;
  lanUrls: Array<{ label: string; vite: string; server: string }>;
  viteUrl: string;
}

async function importCore(repoRoot: string) {
  const href = pathToFileURL(join(repoRoot, 'scripts/lib/devLauncherCore.mjs')).href;
  // PD-SAAS-FORK: bust ESM cache so launcher picks up devLauncherCore/devInfra edits without full quit.
  return import(`${href}?nova=${Date.now()}`);
}

const MAX_LOG_LINES = 5000;
/** Launcher UI: scan/kill all dev port offsets (matches devLauncherCore MAX_PORT_TRIES). */
const LAUNCHER_PROBE_MAX_OFFSETS = 20;
const LAUNCHER_HTTP_PROBE_MS = 2500;
const LAUNCHER_HTTP_DEEP_PROBE_MS = 4_000;
const LAUNCHER_PORT_PROBE_MS = 400;
const NOTIFY_DEBOUNCE_MS = 64;
const NOTIFY_BOOT_DEBOUNCE_MS = 280;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isPortListening(port: number, host = '127.0.0.1', timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host });
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });
}

async function fetchJson(url: string, timeoutMs = 8000): Promise<{ ok: boolean; ms: number; data?: unknown }> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const ms = Date.now() - started;
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = undefined;
    }
    return { ok: res.ok, ms, data };
  } catch {
    return { ok: false, ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

export class ProcessSupervisor {
  private repoRoot: string;
  private runtime: DevRuntime | null = null;
  private stackRunning = false;
  private stackExternal = false;
  private managedByLauncher = false;
  private stopPgOnShutdown = false;
  private logFilter: LogChannel = 'all';
  private logs: LogEntry[] = [];
  private logId = 0;
  private listeners = new Set<(snap: ReturnType<ProcessSupervisor['buildSnapshot']>) => void>();

  private lastActionError: string | null = null;
  private isBooting = false;
  private isInitializing = true;
  private initSlowDone = false;
  private initInfraDone = false;
  private selfCheckMessage = '正在自检，请稍后…';
  private shuttingDown = false;

  /** 与 dev-saas.mjs 相同栈；Windows 下走无控制台三进程拉起 */
  private stackChildren: ChildProcess[] = [];
  private stackChild: ChildProcess | null = null;
  private stackHandle: { killAll: () => void } | null = null;
  private children: Partial<Record<'gateway' | 'bridge' | 'vite', ChildProcess>> = {};
  private gatewayConnectFailures = 0;
  private redisMemoryFallback = false;
  private notifyTimer: ReturnType<typeof setTimeout> | null = null;
  private slowInitDone = false;

  private services: Record<ServiceId, ServiceState> = {
    redis: { id: 'redis', label: 'Redis', status: 'stopped', detail: '—' },
    postgres: { id: 'postgres', label: 'PostgreSQL', status: 'stopped', detail: '—' },
    gateway: { id: 'gateway', label: 'Gateway', status: 'stopped', detail: '—' },
    bridge: { id: 'bridge', label: 'UI Bridge', status: 'stopped', detail: '—' },
    vite: { id: 'vite', label: 'Vite', status: 'stopped', detail: '—' },
    bridgeGateway: { id: 'bridgeGateway', label: 'Bridge↔Gateway', status: 'stopped', detail: '—' },
  };

  constructor(repoRoot?: string) {
    this.repoRoot = repoRoot ?? findRepoRoot();
  }

  async init() {
    this.isInitializing = true;
    this.initSlowDone = false;
    this.initInfraDone = false;
    this.setSelfCheckMessage('正在自检，请稍后…');

    setClassifierRepoRoot(this.repoRoot);
    await loadLogClassifier(this.repoRoot);
    await importCore(this.repoRoot);
    this.logSystem('[nova-launcher] 仓库根目录: ' + this.repoRoot);

    this.setSelfCheckMessage('正在检测 Redis / PostgreSQL…');
    await this.refreshInfraStatus({ probeOnly: true });
    this.notify(true);

    void this.runSlowInit().finally(() => {
      this.initSlowDone = true;
      this.tryFinishInitSelfCheck();
    });
    void this.refreshInfraStatus({ tryStartInfra: true }).finally(() => {
      this.initInfraDone = true;
      this.tryFinishInitSelfCheck();
    });
  }

  private setSelfCheckMessage(message: string) {
    this.selfCheckMessage = message;
    this.notify(true);
  }

  private tryFinishInitSelfCheck() {
    if (!this.initSlowDone || !this.initInfraDone) return;
    this.isInitializing = false;
    if (!this.isBooting) {
      this.notify(true);
    }
  }

  private buildSelfCheckState() {
    const active = this.isInitializing || this.isBooting;
    return {
      active,
      message: active ? this.selfCheckMessage : '',
    };
  }

  isSlowInitDone() {
    return this.slowInitDone;
  }

  /** Port scan + kill leftover dev processes — deferred so the window stays responsive */
  private async runSlowInit() {
    await sleep(80);
    try {
      this.setSelfCheckMessage('正在检测本机已有服务…');
      this.logSystem('[nova-launcher] 正在检测本机已有服务…');
      const cleared = await this.terminateExistingDevServices('检测到已有 dev 服务，正在全部关闭');
      if (cleared) {
        this.logSystem('[nova-launcher] 已有服务已关闭，点击「启动/重启」拉起全栈');
      } else {
        this.logSystem('[nova-launcher] 未发现运行中的 dev 服务，点击「启动/重启」即可拉起');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logSystem(`[nova-launcher] 环境检测未完成: ${msg}`);
    } finally {
      this.slowInitDone = true;
      this.notify(true);
    }
  }

  isStackRunning() {
    return this.stackRunning;
  }

  isManagedByLauncher() {
    return this.managedByLauncher;
  }

  /** Probe for a healthy dev stack without attaching supervisor state. */
  private async probeRunningStack(): Promise<{
    server: number;
    gateway: number;
    vite: number;
    source: string;
  } | null> {
    const core = await importCore(this.repoRoot);
    const triplets = core.buildDevPortTriplets({ maxOffsets: LAUNCHER_PROBE_MAX_OFFSETS }) as Array<{
      server: number;
      gateway: number;
      vite: number;
      source: string;
    }>;

    for (const triplet of triplets) {
      const [gatewayOpen, bridgeOpen, viteOpen] = await Promise.all([
        isPortListening(triplet.gateway, '127.0.0.1', LAUNCHER_PORT_PROBE_MS),
        isPortListening(triplet.server, '127.0.0.1', LAUNCHER_PORT_PROBE_MS),
        isPortListening(triplet.vite, '127.0.0.1', LAUNCHER_PORT_PROBE_MS),
      ]);
      if (!gatewayOpen && !bridgeOpen && !viteOpen) continue;

      const [gatewayProbe, bridgeProbe] = await Promise.all([
        gatewayOpen ? this.probeGatewayHealth(triplet.gateway) : Promise.resolve({ ok: false, ms: 0 }),
        bridgeOpen ? this.probeBridgeHealthDeep(triplet.server) : Promise.resolve({ ok: false, ms: 0 }),
      ]);
      if (gatewayProbe.ok && bridgeProbe.ok) return triplet;
    }
    return null;
  }

  /** Collect all candidate dev ports (always kill full triplet sweep on restart). */
  private async collectAllDevPortsToKill(): Promise<number[]> {
    const core = await importCore(this.repoRoot);
    const triplets = core.buildDevPortTriplets({ maxOffsets: LAUNCHER_PROBE_MAX_OFFSETS }) as Array<{
      server: number;
      gateway: number;
      vite: number;
    }>;
    const ports = new Set<number>();
    for (const triplet of triplets) {
      ports.add(triplet.server);
      ports.add(triplet.gateway);
      ports.add(triplet.vite);
    }
    return [...ports];
  }

  /** Collect dev ports that are listening (gateway / bridge / vite candidates). */
  private async collectOccupiedDevPorts(): Promise<number[]> {
    const core = await importCore(this.repoRoot);
    const triplets = core.buildDevPortTriplets({ maxOffsets: LAUNCHER_PROBE_MAX_OFFSETS }) as Array<{
      server: number;
      gateway: number;
      vite: number;
    }>;
    const ports = new Set<number>();

    for (const triplet of triplets) {
      const [gatewayUp, bridgeUp, viteUp] = await Promise.all([
        isPortListening(triplet.gateway, '127.0.0.1', LAUNCHER_PORT_PROBE_MS),
        isPortListening(triplet.server, '127.0.0.1', LAUNCHER_PORT_PROBE_MS),
        isPortListening(triplet.vite, '127.0.0.1', LAUNCHER_PORT_PROBE_MS),
      ]);
      if (gatewayUp || bridgeUp || viteUp) {
        ports.add(triplet.server);
        ports.add(triplet.gateway);
        ports.add(triplet.vite);
      }
    }
    return [...ports];
  }

  /**
   * Kill external or leftover dev processes (same intent as CLI restart).
   * Returns true if anything was terminated.
   */
  private async terminateExistingDevServices(reason: string): Promise<boolean> {
    const [occupied, runningStack, allTripletPorts] = await Promise.all([
      this.collectOccupiedDevPorts(),
      this.probeRunningStack(),
      this.collectAllDevPortsToKill(),
    ]);
    const hasManaged = !!(this.stackChild?.pid) || this.stackRunning;

    if (!occupied.length && !runningStack && !hasManaged) {
      return false;
    }

    this.logSystem(`[nova-launcher] ${reason}`);
    this.logSystem('[nova-launcher] ⚠ 将中断进行中的对话任务（Gateway/WebSocket 会断开）；请待任务完成后再点「启动/重启」');
    if (runningStack) {
      const srcLabel = runningStack.source === 'default' ? '' : ` (${runningStack.source})`;
      this.logSystem(
        `[nova-launcher] 已识别运行中服务${srcLabel}: server=${runningStack.server} gateway=${runningStack.gateway} vite=${runningStack.vite}`,
      );
    } else if (occupied.length) {
      this.logSystem(
        `[nova-launcher] 检测到占用端口: ${[...occupied].sort((a, b) => a - b).join(', ')}`,
      );
    }

    const ports = new Set(allTripletPorts);
    for (const p of occupied) ports.add(p);
    if (runningStack) {
      ports.add(runningStack.server);
      ports.add(runningStack.gateway);
      ports.add(runningStack.vite);
    }
    if (this.runtime) {
      ports.add(this.runtime.ports.server);
      ports.add(this.runtime.ports.gateway);
      ports.add(this.runtime.ports.vite);
    }

    await this.killDevPortsAndChildren([...ports]);
    this.runtime = null;
    this.stackRunning = false;
    this.stackExternal = false;
    this.managedByLauncher = false;
    this.resetAppServices();
    this.stackHandle = null;
    this.stackChildren = [];
    this.stackChild = null;
    await this.refreshInfraStatus();
    this.notify();
    this.logSystem('[nova-launcher] dev 服务进程已关闭');
    return true;
  }

  private async probeGatewayHealth(port: number) {
    const res = await fetchJson(`http://127.0.0.1:${port}/health`, LAUNCHER_HTTP_PROBE_MS);
    const ok = res.ok && (res.data as { ok?: boolean })?.ok === true;
    return { ok, ms: res.ms };
  }

  private async probeBridgeHealthDeep(port: number) {
    const res = await fetchJson(
      `http://127.0.0.1:${port}/api/saas/health/ready`,
      LAUNCHER_HTTP_DEEP_PROBE_MS,
    );
    const data = res.data as { ok?: boolean; ms?: number; backend?: string; probe?: string } | undefined;
    const ok = res.ok && data?.ok === true;
    return { ok, ms: res.ms, data };
  }

  private async probeBridgeHealth(port: number) {
    const res = await fetchJson(`http://127.0.0.1:${port}/api/saas/health`, LAUNCHER_HTTP_PROBE_MS);
    const data = res.data as { ok?: boolean; db?: string; backend?: string } | undefined;
    const ok = res.ok && data?.ok === true;
    return { ok, ms: res.ms, data };
  }

  private resetAppServices() {
    for (const id of ['gateway', 'bridge', 'vite', 'bridgeGateway'] as ServiceId[]) {
      this.setService(id, { status: 'stopped', detail: '—', port: undefined, pid: undefined, latencyMs: undefined });
    }
  }

  subscribe(listener: (snap: ReturnType<ProcessSupervisor['buildSnapshot']>) => void) {
    this.listeners.add(listener);
    listener(this.buildSnapshot());
    return () => this.listeners.delete(listener);
  }

  private notify(immediate = false) {
    const debounceMs = this.isBooting ? NOTIFY_BOOT_DEBOUNCE_MS : NOTIFY_DEBOUNCE_MS;
    if (immediate) {
      if (this.notifyTimer) {
        clearTimeout(this.notifyTimer);
        this.notifyTimer = null;
      }
      this.flushNotify();
      return;
    }
    if (this.notifyTimer) return;
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null;
      this.flushNotify();
    }, debounceMs);
  }

  private flushNotify() {
    const snap = this.buildSnapshot();
    for (const l of this.listeners) l(snap);
  }

  private pushLog(channel: LogChannel, line: string) {
    const trimmed = line.replace(/\r?\n$/, '');
    if (!trimmed || shouldSkipLogLine(trimmed)) return;
    if (/using memory fallback/i.test(trimmed)) {
      this.redisMemoryFallback = true;
    }
    if (/gateway connect failed/i.test(trimmed) && !this.isBooting) {
      this.gatewayConnectFailures += 1;
      this.services.bridgeGateway.status = 'error';
      this.services.bridgeGateway.detail = `失败 ${this.gatewayConnectFailures} 次`;
    }
    const baseLevel = classifyLineSync(trimmed);
    const level = adjustLogLevel(trimmed, baseLevel, {
      booting: this.isBooting,
      shuttingDown: this.shuttingDown,
    });
    this.logs.push({
      id: ++this.logId,
      channel,
      line: trimmed,
      level,
      ts: Date.now(),
    });
    if (this.logs.length > MAX_LOG_LINES) {
      this.logs = this.logs.slice(-MAX_LOG_LINES);
    }
    this.notify();
  }

  private emitSystem(line: string) {
    this.pushLog('system', line);
  }

  logSystem(line: string) {
    this.emitSystem(line);
  }

  private spawnLogged(
    channel: LogChannel,
    key: 'gateway' | 'bridge' | 'vite',
    cmd: string,
    args: string[],
    env: NodeJS.ProcessEnv,
    cwd: string,
  ) {
    const child = spawn(cmd, args, withHiddenConsole({
      cwd,
      env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    }));
    this.children[key] = child;
    const prefix = `[${key}]`;
    child.stdout?.on('data', (buf: Buffer) => {
      for (const line of buf.toString().split(/\r?\n/)) {
        if (line) this.pushLog(channel, `${prefix} ${line}`);
      }
    });
    child.stderr?.on('data', (buf: Buffer) => {
      for (const line of buf.toString().split(/\r?\n/)) {
        if (line) this.pushLog(channel, `${prefix} ${line}`);
      }
    });
    child.on('exit', (code, signal) => {
      if (this.shuttingDown) {
        delete this.children[key];
        return;
      }
      if (this.stackRunning) {
        const msg = signal ? `signal ${signal}` : `exit ${code}`;
        this.pushLog(channel, `${prefix} 进程退出 (${msg})`);
        this.services[key === 'bridge' ? 'bridge' : key].status = code === 0 ? 'stopped' : 'error';
        this.services[key === 'bridge' ? 'bridge' : key].lastError = msg;
      }
      delete this.children[key];
      this.notify();
    });
    return child;
  }

  private async killService(key: 'gateway' | 'bridge' | 'vite') {
    const rt = this.runtime;
    if (!rt) return;
    const port = key === 'bridge' ? rt.ports.server : rt.ports[key];
    await this.killChild(key);
    const killMod = await import(pathToFileURL(join(this.repoRoot, 'scripts/lib/processKill.mjs')).href);
    killMod.killPort(port);
    await sleep(600);
  }

  private async killChild(key: 'gateway' | 'bridge' | 'vite') {
    const child = this.children[key];
    if (!child?.pid) return;
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], withHiddenConsole({ shell: false, stdio: 'ignore' }));
    } else {
      child.kill('SIGTERM');
    }
    delete this.children[key];
    await sleep(400);
  }

  private setService(id: ServiceId, patch: Partial<ServiceState>) {
    this.services[id] = { ...this.services[id], ...patch };
  }

  async startOrRestart(): Promise<{ ok: boolean; error?: string }> {
    this.lastActionError = null;
    this.logSystem('[nova-launcher] ── 启动/重启：环境自检 ──');

    const prereq = checkPrerequisites(this.repoRoot);
    for (const msg of prereq.messages) {
      this.logSystem(`[nova-launcher] ${msg}`);
    }
    if (!prereq.ok) {
      const err = prereq.messages.join('；');
      this.lastActionError = err;
      return { ok: false, error: err };
    }

    try {
      await this.terminateExistingDevServices('启动/重启：先关闭已有 dev 服务');
      await sleep(400);
      await this.bootStack();
      if (this.lastActionError) {
        return { ok: false, error: this.lastActionError };
      }
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.lastActionError = msg;
      return { ok: false, error: msg };
    }
  }

  private routeConcurrentLog(raw: string) {
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trimEnd();
      if (!trimmed) continue;
      if (/\[gateway\]/i.test(trimmed)) this.pushLog('gateway', trimmed);
      else if (/\[server\]/i.test(trimmed)) this.pushLog('bridge', trimmed);
      else if (/\[client\]/i.test(trimmed)) this.pushLog('vite', trimmed);
      else this.pushLog('system', trimmed);
    }
  }

  private attachStackChildHandlers(child: ChildProcess) {
    child.stdout?.on('data', (buf: Buffer) => this.routeConcurrentLog(buf.toString()));
    child.stderr?.on('data', (buf: Buffer) => this.routeConcurrentLog(buf.toString()));
    child.on('exit', (code, signal) => {
      if (this.shuttingDown) {
        this.stackChild = null;
        this.children = {};
        return;
      }
      if (this.stackRunning && this.managedByLauncher) {
        const msg = signal ? `signal ${signal}` : `exit ${code}`;
        this.pushLog('system', `[stack] 开发栈退出 (${msg})`);
        for (const id of ['gateway', 'bridge', 'vite'] as const) {
          this.services[id].status = code === 0 ? 'stopped' : 'error';
          this.services[id].lastError = msg;
        }
        this.stackRunning = false;
      }
      this.stackChild = null;
      this.children = {};
      this.notify();
    });
  }

  /** Electron/Windows 用 headless 三进程，避免弹出 cmd；其余平台走 npm dev:concurrent */
  private async spawnDevConcurrent(runtime: DevRuntime) {
    if (process.platform === 'win32') {
      const mod = await import(
        pathToFileURL(join(this.repoRoot, 'scripts/lib/devConcurrentHeadless.mjs')).href
      );
      const handle = mod.spawnHeadlessDevStack(this.repoRoot, runtime.env, (tag: string, line: string) => {
        this.routeConcurrentLog(`[${tag}] ${line}`);
      });
      this.stackHandle = handle;
      this.stackChildren = handle.children;
      this.stackChild = handle.children[0] ?? null;
      this.children = {
        gateway: handle.children[0],
        bridge: handle.children[1],
        vite: handle.children[2],
      };
      for (const child of handle.children) {
        child.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
          if (this.shuttingDown) return;
          if (this.stackRunning && this.managedByLauncher && code !== 0) {
            const msg = signal ? `signal ${signal}` : `exit ${code}`;
            this.pushLog('system', `[stack] 开发栈进程退出 (${msg})`);
            this.stackRunning = false;
            this.notify();
          }
        });
      }
      return;
    }

    const npmCmd = resolveNpmBin();
    const child = spawn(npmCmd, ['--workspace', 'ui', 'run', 'dev:concurrent'], withHiddenConsole({
      cwd: this.repoRoot,
      env: runtime.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    }));
    this.stackChild = child;
    this.stackChildren = [child];
    this.children = { gateway: child, bridge: child, vite: child };
    this.attachStackChildHandlers(child);
  }

  private runBootstrapConfig(env: NodeJS.ProcessEnv) {
    const bootstrap = join(this.repoRoot, 'scripts/bootstrap-pilotdeck-config.mjs');
    if (!existsSync(bootstrap)) return;
    const nodeBin = resolveNodeBin();
    this.emitSystem('[nova-launcher] 同步本地配置 bootstrap…');
    const result = spawnSync(nodeBin, [bootstrap], withHiddenConsole({
      cwd: this.repoRoot,
      env,
      shell: false,
      stdio: 'pipe',
      encoding: 'utf8',
    }));
    if (result.status !== 0) {
      const tail = (result.stderr || result.stdout || '').trim().slice(-300);
      this.emitSystem(`[nova-launcher] bootstrap 警告: ${tail || result.status}`);
    }
  }

  private async killProcessTree(pid: number) {
    await new Promise<void>((resolve) => {
      if (process.platform === 'win32') {
        const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], withHiddenConsole({
          shell: false,
          stdio: 'ignore',
        }));
        killer.on('exit', () => resolve());
        killer.on('error', () => resolve());
      } else {
        try {
          process.kill(-pid, 'SIGTERM');
        } catch {
          try {
            process.kill(pid, 'SIGTERM');
          } catch {
            // ignore
          }
        }
        setTimeout(resolve, 500);
      }
    });
  }

  private withCapturedConsole<T>(fn: () => Promise<T>): Promise<T> {
    const prev = {
      log: console.log,
      warn: console.warn,
      error: console.error,
    };
    const emit = (line: string) => {
      if (line.trim()) this.emitSystem(line);
    };
    const wrap =
      (...args: unknown[]) =>
      () => {
        const line = args
          .map((a) => {
            if (typeof a === 'string') return a;
            if (a instanceof Error) return a.message;
            try {
              return JSON.stringify(a);
            } catch {
              return String(a);
            }
          })
          .join(' ');
        emit(line);
      };
    console.log = (...args: unknown[]) => wrap(...args)();
    console.warn = (...args: unknown[]) => wrap(...args)();
    console.error = (...args: unknown[]) => wrap(...args)();
    return fn().finally(() => {
      console.log = prev.log;
      console.warn = prev.warn;
      console.error = prev.error;
    });
  }

  private async killDevPortsAndChildren(ports: number[]) {
    this.shuttingDown = true;
    try {
      if (this.stackHandle) {
        this.stackHandle.killAll();
        this.stackHandle = null;
        this.stackChild = null;
        this.stackChildren = [];
        this.children = {};
      } else if (this.stackChild?.pid) {
        await this.killProcessTree(this.stackChild.pid);
        this.stackChild = null;
        this.stackChildren = [];
        this.children = {};
      }

      await this.killChild('vite');
      await this.killChild('bridge');
      await this.killChild('gateway');

      if (ports.length) {
        const killMod = await import(pathToFileURL(join(this.repoRoot, 'scripts/lib/processKill.mjs')).href);
        await killMod.killPortsAsync(ports);
        await sleep(400);
      }
      this.setService('bridgeGateway', { status: 'stopped', detail: '—' });
    } finally {
      this.shuttingDown = false;
    }
  }

  private async killAppStack() {
    const ports: number[] = [];
    if (this.runtime) {
      ports.push(this.runtime.ports.server, this.runtime.ports.gateway, this.runtime.ports.vite);
    }
    await this.killDevPortsAndChildren(ports);
  }

  private stackExited(): string | null {
    if (this.stackChildren.length > 0) {
      const dead = this.stackChildren.find((c) => c.exitCode != null);
      if (dead) return `开发栈进程已退出 (code ${dead.exitCode})，请查看下方日志`;
      return null;
    }
    if (!this.stackChild) return null;
    const code = this.stackChild.exitCode;
    if (code == null) return null;
    return `开发栈进程已退出 (code ${code})，请查看下方日志`;
  }

  private async bootStack() {
    this.isBooting = true;
    this.setSelfCheckMessage('正在自检，请稍后…');
    this.stackRunning = true;
    this.stackExternal = false;
    this.managedByLauncher = true;
    this.gatewayConnectFailures = 0;
    this.redisMemoryFallback = false;

    const core = await importCore(this.repoRoot);
    this.setSelfCheckMessage('正在检测 Redis / PostgreSQL / Docker…');
    this.emitSystem('[nova-launcher] ① 自检 Redis / PostgreSQL / Docker…');

    try {
      this.setService('redis', { status: 'starting', detail: '检测中…' });
      this.setService('postgres', { status: 'starting', detail: '检测中…' });
      this.notify();

      const runtime = await this.withCapturedConsole(() =>
        core.prepareSaasDevRuntime(this.repoRoot) as Promise<DevRuntime>,
      );
      this.runtime = runtime;

      this.setService('redis', {
        status: runtime.infra.redis ? 'running' : 'degraded',
        detail: runtime.infra.redis ? 'PONG' : '内存缓存兜底',
      });
      this.setService('postgres', {
        status: runtime.infra.postgres ? 'running' : 'degraded',
        detail: runtime.infra.postgres
          ? (await this.pgStatusDetail(runtime.infra.pgUrl))
          : runtime.dbBackend === 'sqlite' ? 'SQLite 回退' : '未就绪',
        port: await this.pgStatusPort(runtime.infra.pgUrl),
      });

      const nodeBin = resolveNodeBin();

      this.emitSystem(`[nova-launcher] ② 端口 server=${runtime.ports.server} gateway=${runtime.ports.gateway} vite=${runtime.ports.vite}`);
      this.emitSystem(`[nova-launcher] Node: ${nodeBin}`);
      this.runBootstrapConfig(runtime.env);

      this.setService('gateway', { status: 'starting', detail: '启动中…', port: runtime.ports.gateway });
      this.setService('bridge', { status: 'starting', detail: '启动中…', port: runtime.ports.server });
      this.setService('vite', { status: 'starting', detail: '启动中…', port: runtime.ports.vite });
      this.setSelfCheckMessage('正在拉起全栈服务，请稍候…');
      this.emitSystem(
        process.platform === 'win32'
          ? '[nova-launcher] ③ 无窗口拉起 gateway / bridge / vite（三进程）…'
          : '[nova-launcher] ③ npm --workspace ui run dev:concurrent …',
      );
      this.notify();

      await this.spawnDevConcurrent(runtime);

      await this.waitGatewayHealth(runtime.ports.gateway);
      await this.waitBridgeHealth(runtime.ports.server);
      await this.waitVitePort(runtime.ports.vite);

      this.setService('bridgeGateway', {
        status: this.gatewayConnectFailures > 0 ? 'error' : 'running',
        detail: this.gatewayConnectFailures > 0 ? `失败 ${this.gatewayConnectFailures}` : '已连接',
      });
      this.emitSystem('[nova-launcher] 全栈就绪 — 可打开浏览器');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.emitSystem(`[nova-launcher] 启动未完成: ${msg}`);
      this.stackRunning = false;
      this.managedByLauncher = false;
      this.stackExternal = false;
      await this.killAppStack();
      this.runtime = null;
      this.resetAppServices();
      this.lastActionError = msg;
      this.notify(true);
      return;
    } finally {
      this.isBooting = false;
    }
    this.notify(true);
  }

  private async waitGatewayHealth(port: number, maxMs = 120_000) {
    const started = Date.now();
    while (Date.now() - started < maxMs) {
      const exited = this.stackExited();
      if (exited) throw new Error(exited);
      const res = await fetchJson(`http://127.0.0.1:${port}/health`);
      if (res.ok && (res.data as { ok?: boolean })?.ok) {
        this.setService('gateway', {
          status: 'running',
          detail: `OK ${res.ms}ms`,
          latencyMs: res.ms,
          pid: this.children.gateway?.pid,
        });
        this.notify();
        return;
      }
      await sleep(1000);
    }
    throw new Error('Gateway /health 超时');
  }

  private async waitBridgeHealth(port: number, maxMs = 180_000) {
    const started = Date.now();
    while (Date.now() - started < maxMs) {
      const exited = this.stackExited();
      if (exited) throw new Error(exited);
      const res = await fetchJson(
        `http://127.0.0.1:${port}/api/saas/health/ready`,
        LAUNCHER_HTTP_DEEP_PROBE_MS,
      );
      const data = res.data as { ok?: boolean; ms?: number; backend?: string; probe?: string } | undefined;
      if (res.ok && data?.ok) {
        this.setService('bridge', {
          status: 'running',
          detail: `${data.backend ?? 'saas'}/ready ${res.ms}ms`,
          latencyMs: res.ms,
          pid: this.children.bridge?.pid,
        });
        this.notify();
        return;
      }
      await sleep(1000);
    }
    throw new Error('UI Bridge /api/saas/health/ready 超时');
  }

  private async waitVitePort(port: number, maxMs = 90_000) {
    const started = Date.now();
    while (Date.now() - started < maxMs) {
      const exited = this.stackExited();
      if (exited) throw new Error(exited);
      if (await isPortListening(port)) {
        this.setService('vite', {
          status: 'running',
          detail: `监听 :${port}`,
          pid: this.children.vite?.pid,
        });
        this.notify();
        return;
      }
      await sleep(800);
    }
    throw new Error('Vite 端口监听超时');
  }

  /** @deprecated use startOrRestart */
  async startAll() {
    await this.startOrRestart();
  }

  async shutdownAll() {
    await this.terminateExistingDevServices('正在关闭全部 dev 服务');

    try {
      const infra = await import(pathToFileURL(join(this.repoRoot, 'scripts/lib/devInfra.mjs')).href);
      if (infra.isDockerAvailable()) {
        infra.runPgComposeDown();
        this.setService('postgres', { status: 'stopped', detail: '容器已关闭' });
      }
    } catch {
      // ignore
    }

    this.stackRunning = false;
    this.stackExternal = false;
    this.managedByLauncher = false;
    this.runtime = null;
    this.resetAppServices();
    await this.refreshInfraStatus();
    this.notify();
    this.logSystem('[nova-launcher] 已全部关闭（Redis 本机服务保持运行）');
  }

  /** @deprecated use shutdownAll */
  async stopAll() {
    await this.shutdownAll();
  }

  async openBrowser() {
    if (!this.runtime) return;
    const { shell } = await import('electron');
    await shell.openExternal(this.runtime.viteUrl);
  }

  clearLogs() {
    this.logs = [];
    this.notify();
  }

  setStopPgOnShutdown(value: boolean) {
    this.stopPgOnShutdown = value;
    this.notify();
  }

  setLogFilter(channel: LogChannel) {
    this.logFilter = channel;
    this.notify();
  }

  getRuntime(): RuntimeInfo | null {
    if (!this.runtime) return null;
    return {
      repoRoot: this.runtime.repoRoot,
      dataRoot: this.runtime.dataRoot,
      dbBackend: this.runtime.dbBackend as 'sqlite' | 'postgres',
      gatewayUrl: this.runtime.gatewayUrl,
      viteUrl: this.runtime.viteUrl,
      ports: this.runtime.ports,
      lanUrls: this.runtime.lanUrls,
      pids: {
        gateway: this.children.gateway?.pid,
        bridge: this.children.bridge?.pid,
        vite: this.children.vite?.pid,
      },
    };
  }

  private async pgStatusPort(pgUrl?: string | null) {
    try {
      const infraMod = await import(pathToFileURL(join(this.repoRoot, 'scripts/lib/devInfra.mjs')).href);
      const url = pgUrl || (await infraMod.resolveDevPgUrl());
      return infraMod.describePgEndpoint(url).port;
    } catch {
      return 5432;
    }
  }

  private async pgStatusDetail(pgUrl?: string | null) {
    try {
      const infraMod = await import(pathToFileURL(join(this.repoRoot, 'scripts/lib/devInfra.mjs')).href);
      const url = pgUrl || (await infraMod.resolveDevPgUrl());
      return infraMod.describePgEndpoint(url).detail;
    } catch {
      return '就绪';
    }
  }

  async refreshInfraStatus(options: { probeOnly?: boolean; tryStartInfra?: boolean } = {}) {
    try {
      const redisMod = await import(pathToFileURL(join(this.repoRoot, 'scripts/lib/nativeRedis.mjs')).href);
      const infraMod = await import(pathToFileURL(join(this.repoRoot, 'scripts/lib/devInfra.mjs')).href);
      const nativePgMod = await import(pathToFileURL(join(this.repoRoot, 'scripts/lib/nativePostgres.mjs')).href);

      const redisOk = options.probeOnly
        ? await redisMod.probeRedisReachable()
        : await redisMod.pingRedis();

      let pgOk = await infraMod.isPgReachable();
      if (!pgOk && options.tryStartInfra && nativePgMod.hasNativePgInstall()) {
        await nativePgMod.ensureNativePostgres();
        pgOk = await infraMod.isPgReachable();
      }

      const pgUrl = pgOk ? await infraMod.resolveDevPgUrl() : null;
      const pgDetail = pgOk ? await this.pgStatusDetail(pgUrl) : '未连接';
      const pgPort = pgOk ? await this.pgStatusPort(pgUrl) : 5432;

      this.setService('redis', {
        status: redisOk ? 'running' : this.stackRunning ? 'degraded' : 'stopped',
        detail: redisOk ? 'PONG' : '内存缓存兜底',
      });
      this.setService('postgres', {
        status: pgOk ? 'running' : this.stackRunning ? 'degraded' : 'stopped',
        detail: pgDetail,
        port: pgPort,
      });
      this.notify();
    } catch {
      // ignore probe errors
    }
  }

  buildAlerts(): AlertItem[] {
    const alerts: AlertItem[] = [];
    const rt = this.runtime;
    if (!rt) return alerts;

    const DEFAULT_PORTS = { server: 3001, gateway: 18789, vite: 5173 };
    if (rt.ports.server !== DEFAULT_PORTS.server) {
      alerts.push({ id: 'port-server', level: 'info', message: `Server 端口偏移: ${rt.ports.server}（默认 3001）` });
    }
    if (rt.ports.gateway !== DEFAULT_PORTS.gateway) {
      alerts.push({ id: 'port-gateway', level: 'info', message: `Gateway 端口偏移: ${rt.ports.gateway}（默认 18789）` });
    }
    if (rt.ports.vite !== DEFAULT_PORTS.vite) {
      alerts.push({ id: 'port-vite', level: 'info', message: `Vite 端口偏移: ${rt.ports.vite}（默认 5173）` });
    }
    if (rt.gatewayUrl && !rt.gatewayUrl.startsWith('ws://')) {
      alerts.push({ id: 'gw-url', level: 'error', message: 'PILOTDECK_GATEWAY_URL 须为 ws:// 协议' });
    }
    if (this.redisMemoryFallback || this.services.redis.status === 'degraded') {
      alerts.push({ id: 'redis-fallback', level: 'muted', message: 'Redis 未连接，使用内存缓存（多实例不一致风险）' });
    }
    if (rt.dbBackend === 'sqlite' && process.env.DEV_SAAS_SQLITE !== '1') {
      alerts.push({ id: 'pg-sqlite', level: 'info', message: 'PostgreSQL 未就绪，控制库回退 SQLite' });
    }
    if (existsSync(join(this.repoRoot, 'ui', 'dist')) && this.services.vite.status !== 'running') {
      alerts.push({ id: 'stale-dist', level: 'muted', message: 'ui/dist 存在且 Vite 未运行，可能误走旧构建' });
    }
    return alerts;
  }

  filterLogs(): LogEntry[] {
    if (this.logFilter === 'all') return this.logs;
    return this.logs.filter((l) => l.channel === this.logFilter || l.channel === 'system');
  }

  buildSnapshot() {
    return {
      services: Object.values(this.services),
      runtime: this.getRuntime(),
      healthHistory: [] as import('../shared/types.js').HealthSample[],
      alerts: this.buildAlerts(),
      logs: this.filterLogs(),
      stackRunning: this.stackRunning,
      stackExternal: this.stackExternal && !this.managedByLauncher,
      stopPgOnShutdown: this.stopPgOnShutdown,
      lastActionError: this.lastActionError,
      selfCheck: this.buildSelfCheckState(),
    };
  }
}
