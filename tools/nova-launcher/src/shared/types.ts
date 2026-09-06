export type ServiceId = 'redis' | 'postgres' | 'gateway' | 'bridge' | 'vite' | 'bridgeGateway';
export type ServiceStatus = 'stopped' | 'starting' | 'running' | 'degraded' | 'error';

export interface ServiceState {
  id: ServiceId;
  label: string;
  status: ServiceStatus;
  detail: string;
  port?: number;
  pid?: number;
  latencyMs?: number;
  lastError?: string;
}

export interface PortInfo {
  server: number;
  gateway: number;
  vite: number;
}

export interface RuntimeInfo {
  repoRoot: string;
  dataRoot: string;
  dbBackend: 'sqlite' | 'postgres';
  gatewayUrl: string;
  viteUrl: string;
  ports: PortInfo;
  lanUrls: Array<{ label: string; vite: string; server: string }>;
  pids: Record<string, number | undefined>;
}

export type LogChannel = 'all' | 'infra' | 'gateway' | 'bridge' | 'vite' | 'system';

export interface LogEntry {
  id: number;
  channel: LogChannel;
  line: string;
  level: 'default' | 'info' | 'success' | 'muted' | 'error';
  ts: number;
}

export interface HealthSample {
  ts: number;
  gatewayMs: number | null;
  bridgeMs: number | null;
  wsMs: number | null;
}

export interface AlertItem {
  id: string;
  level: 'info' | 'muted' | 'error';
  message: string;
}

export interface SelfCheckState {
  active: boolean;
  message: string;
}

export interface LauncherSnapshot {
  services: ServiceState[];
  runtime: RuntimeInfo | null;
  healthHistory: HealthSample[];
  alerts: AlertItem[];
  logs: LogEntry[];
  stackRunning: boolean;
  stackExternal: boolean;
  stopPgOnShutdown: boolean;
  lastActionError: string | null;
  /** 启动/自检进行中 — 渲染层展示全屏 loading 并禁止操作 */
  selfCheck: SelfCheckState;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface LauncherApi {
  getSnapshot(): Promise<LauncherSnapshot>;
  startOrRestart(): Promise<ActionResult>;
  shutdownAll(): Promise<ActionResult>;
  openBrowser(): Promise<ActionResult>;
  clearLogs(): Promise<ActionResult>;
  setLogFilter(channel: LogChannel): Promise<ActionResult | { ok: true }>;
  onSnapshot(callback: (snapshot: LauncherSnapshot) => void): () => void;
  windowMinimize(): Promise<ActionResult>;
  windowToggleMaximize(): Promise<ActionResult>;
  windowClose(): Promise<ActionResult>;
}

declare global {
  interface Window {
    launcher: LauncherApi;
  }
}

export {};
