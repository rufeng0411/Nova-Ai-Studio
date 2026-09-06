// PD-SAAS-FORK: Preflight Studio telemetry
import { appendFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';

export type PreflightTelemetryEvent =
  | 'preflight_open'
  | 'preflight_confirm'
  | 'preflight_skip_default'
  | 'preflight_edit'
  | 'preflight_error';

export type PreflightTelemetryRecord = {
  ts: string;
  event: PreflightTelemetryEvent;
  sessionId?: string;
  slotId?: string;
  profileRef?: string;
  catalogId?: string;
  msFromOpen?: number;
  fromId?: string;
  toId?: string;
  kind?: string;
  meta?: Record<string, unknown>;
};

function resolveTelemetryPath(): string {
  const dataRoot = process.env.DATA_ROOT?.trim() || path.join(process.cwd(), '.saas-dev-data');
  return path.join(dataRoot, 'telemetry', 'preflight-events.jsonl');
}

export function appendPreflightTelemetry(record: Omit<PreflightTelemetryRecord, 'ts'>): void {
  try {
    const filePath = resolveTelemetryPath();
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), ...record });
    appendFileSync(filePath, `${line}\n`, 'utf8');
  } catch {
    // fail-open telemetry
  }
}
