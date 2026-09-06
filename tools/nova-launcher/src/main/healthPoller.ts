import WebSocket from 'ws';
import type { HealthSample, ServiceState } from '../shared/types.js';
import type { ProcessSupervisor } from './supervisor.js';

const HISTORY_LEN = 60;
const POLL_MS = 2000;

async function timedFetch(url: string): Promise<number | null> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return Date.now() - started;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function timedWsHandshake(gatewayPort: number): Promise<number | null> {
  const started = Date.now();
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${gatewayPort}/ws`);
    const timer = setTimeout(() => {
      ws.terminate();
      resolve(null);
    }, 4000);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'hello', protocolVersion: 1, clientName: 'nova-launcher' }));
    });
    ws.on('message', (data) => {
      try {
        const frame = JSON.parse(String(data));
        if (frame.type === 'hello_ok') {
          clearTimeout(timer);
          ws.close();
          resolve(Date.now() - started);
        }
      } catch {
        // ignore
      }
    });
    ws.on('error', () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

export class HealthPoller {
  private history: HealthSample[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private inflight = false;
  private supervisor: ProcessSupervisor;
  private onUpdate: (history: HealthSample[], services: ServiceState[]) => void;

  constructor(supervisor: ProcessSupervisor, onUpdate: (history: HealthSample[], services: ServiceState[]) => void) {
    this.supervisor = supervisor;
    this.onUpdate = onUpdate;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => void this.poll(), POLL_MS);
    void this.poll();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getHistory() {
    return this.history;
  }

  private async poll() {
    if (this.inflight) return;
    this.inflight = true;
    try {
      await this.supervisor.refreshInfraStatus({ probeOnly: true });

      const snap = this.supervisor.buildSnapshot();
      const ports = snap.runtime?.ports;
      if (!ports || !snap.stackRunning) {
        this.onUpdate(this.history, snap.services);
        return;
      }

      const [gatewayMs, bridgeMs, wsMs] = await Promise.all([
        timedFetch(`http://127.0.0.1:${ports.gateway}/health`),
        timedFetch(`http://127.0.0.1:${ports.server}/api/saas/health`),
        timedWsHandshake(ports.gateway),
      ]);

      const sample: HealthSample = {
        ts: Date.now(),
        gatewayMs,
        bridgeMs,
        wsMs,
      };
      this.history = [...this.history, sample].slice(-HISTORY_LEN);
      this.onUpdate(this.history, this.supervisor.buildSnapshot().services);
    } finally {
      this.inflight = false;
    }
  }
}
