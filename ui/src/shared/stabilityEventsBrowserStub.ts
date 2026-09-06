// PD-SAAS-FORK: Vite client stub for src/telemetry/stabilityEvents (no node:fs).
// Aliased in ui/vite.config.js so sdmSlotMatching → recordStabilityEvent stays browser-safe.

export type StabilityEventName = string;

export type StabilityEvent = {
  recordedAtMs: number;
  event: StabilityEventName;
  sessionId?: string;
  turnId?: string;
  reason?: string;
  detail?: Record<string, string | number | boolean>;
};

export function resolveStabilityLogPath(): string {
  return "";
}

export function recordStabilityEvent(
  _event: Omit<StabilityEvent, "recordedAtMs"> & { recordedAtMs?: number },
): void {
  // Client telemetry is server-side only.
}

export function recordToolTimingEvent(_input: {
  sessionId?: string;
  turnId?: string;
  toolName: string;
  durationMs: number;
  phase?: string;
}): void {
  // no-op
}

export async function loadStabilityEvents(
  _logPath?: string,
): Promise<StabilityEvent[]> {
  return [];
}

export function summarizeStabilityByEvent(
  events: StabilityEvent[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const event of events) {
    const key = String(event.event || "unknown");
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}
