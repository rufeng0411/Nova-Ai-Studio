// PD-SAAS-FORK: per-turn TTFT stage tracing for complex-task latency analysis.

import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { stringifySanitizedForPersistence } from "../saas/security/urlRedaction.js";
import type { TelemetryClient } from "./types.js";

export type TurnStageId =
  | "turn.config_reload"
  | "turn.session_prepare"
  | "turn.plugin_refresh"
  | "turn.mcp_ready"
  | "turn.per_session_mcp"
  | "turn.attachments"
  | "turn.compact"
  | "turn.context_prepare"
  | "turn.memory_retrieve"
  | "turn.router_judge"
  | "turn.model_ttfb"
  | "turn.first_visible_ui";

export type TurnStageRecord = {
  stage: TurnStageId;
  startedAtMs: number;
  endedAtMs: number;
  durationMs: number;
};

export type TurnTimingSnapshot = {
  traceId: string;
  runId: string;
  sessionId: string;
  startedAtMs: number;
  endedAtMs: number;
  totalMs: number;
  stages: TurnStageRecord[];
  firstVisibleKind?: "text" | "tool";
  firstVisibleMs?: number;
};

type OpenStage = {
  stage: TurnStageId;
  startedAtMs: number;
};

export class TurnTimingTrace {
  readonly traceId: string;
  readonly runId: string;
  readonly sessionId: string;
  readonly startedAtMs: number;
  private readonly stages: TurnStageRecord[] = [];
  private readonly open = new Map<TurnStageId, OpenStage>();
  private firstVisibleKind?: "text" | "tool";
  private firstVisibleMs?: number;
  private finalized = false;

  constructor(input: { traceId: string; runId: string; sessionId: string; startedAtMs?: number }) {
    this.traceId = input.traceId;
    this.runId = input.runId;
    this.sessionId = input.sessionId;
    this.startedAtMs = input.startedAtMs ?? Date.now();
  }

  beginStage(stage: TurnStageId): void {
    if (this.finalized) return;
    this.open.set(stage, { stage, startedAtMs: Date.now() });
  }

  endStage(stage: TurnStageId, telemetry?: TelemetryClient): number | undefined {
    if (this.finalized) return undefined;
    const open = this.open.get(stage);
    if (!open) return undefined;
    const endedAtMs = Date.now();
    const durationMs = Math.max(0, endedAtMs - open.startedAtMs);
    this.open.delete(stage);
    const record: TurnStageRecord = {
      stage,
      startedAtMs: open.startedAtMs,
      endedAtMs,
      durationMs,
    };
    this.stages.push(record);
    this.emitStage(telemetry, record);
    return durationMs;
  }

  markFirstVisible(kind: "text" | "tool", telemetry?: TelemetryClient): void {
    if (this.finalized || this.firstVisibleKind) return;
    this.firstVisibleKind = kind;
    this.firstVisibleMs = Date.now() - this.startedAtMs;
    this.beginStage("turn.first_visible_ui");
    this.endStage("turn.first_visible_ui", telemetry);
    telemetry?.trackFeatureLoopStage({
      module: "session",
      executionKind: "user_session",
      phase: "ttft",
      loopStage: "module_event",
      outcome: "success",
      sessionId: this.sessionId,
      metadata: {
        traceId: this.traceId,
        runId: this.runId,
        stage: "turn.first_visible_ui",
        kind,
        durationMs: this.firstVisibleMs,
      },
    });
  }

  snapshot(): TurnTimingSnapshot {
    const endedAtMs = Date.now();
    return {
      traceId: this.traceId,
      runId: this.runId,
      sessionId: this.sessionId,
      startedAtMs: this.startedAtMs,
      endedAtMs,
      totalMs: Math.max(0, endedAtMs - this.startedAtMs),
      stages: [...this.stages],
      firstVisibleKind: this.firstVisibleKind,
      firstVisibleMs: this.firstVisibleMs,
    };
  }

  finalize(telemetry?: TelemetryClient): TurnTimingSnapshot {
    if (this.finalized) {
      return this.snapshot();
    }
    this.finalized = true;
    for (const stage of [...this.open.keys()]) {
      this.endStage(stage, telemetry);
    }
    const snap = this.snapshot();
    telemetry?.trackFeatureLoopStage({
      module: "session",
      executionKind: "user_session",
      phase: "ttft",
      loopStage: "loop_end",
      outcome: "success",
      sessionId: this.sessionId,
      metadata: {
        traceId: snap.traceId,
        runId: snap.runId,
        totalMs: snap.totalMs,
        firstVisibleMs: snap.firstVisibleMs,
        firstVisibleKind: snap.firstVisibleKind,
        stages: snap.stages.map((s) => ({ stage: s.stage, durationMs: s.durationMs })),
      },
    });
    void persistTurnSnapshot(snap);
    return snap;
  }

  private emitStage(telemetry: TelemetryClient | undefined, record: TurnStageRecord): void {
    telemetry?.trackFeatureLoopStage({
      module: "session",
      executionKind: "user_session",
      phase: "ttft",
      loopStage: "module_event",
      outcome: "success",
      sessionId: this.sessionId,
      metadata: {
        traceId: this.traceId,
        runId: this.runId,
        stage: record.stage,
        durationMs: record.durationMs,
      },
    });
  }
}

const activeTraces = new Map<string, TurnTimingTrace>();
const completedTraces: TurnTimingSnapshot[] = [];
const MAX_COMPLETED = 200;

function resolveTurnTimingLogPath(): string | undefined {
  const fromEnv = process.env.PILOTDECK_TTFT_LOG?.trim();
  if (fromEnv) return fromEnv;
  const dataRoot = process.env.PILOTDECK_DATA_ROOT?.trim() || process.env.DATA_ROOT?.trim();
  if (dataRoot) {
    return resolve(dataRoot, "telemetry", "turn-timing.jsonl");
  }
  return resolve(process.cwd(), ".saas-dev-data", "telemetry", "turn-timing.jsonl");
}

async function persistTurnSnapshot(snapshot: TurnTimingSnapshot): Promise<void> {
  const logPath = resolveTurnTimingLogPath();
  if (!logPath) return;
  try {
    await mkdir(dirname(logPath), { recursive: true });
    // PD-SAAS-FORK P0-3: telemetry persistence shares the URL redaction boundary.
    await appendFile(
      logPath,
      `${stringifySanitizedForPersistence(snapshot)}\n`,
      "utf8",
    );
  } catch {
    // Persistence must never affect turn completion.
  }
}

export function beginTurnTrace(input: {
  runId: string;
  sessionId: string;
  traceId?: string;
}): TurnTimingTrace {
  const trace = new TurnTimingTrace({
    traceId: input.traceId ?? input.runId,
    runId: input.runId,
    sessionId: input.sessionId,
  });
  activeTraces.set(input.runId, trace);
  return trace;
}

export function getTurnTrace(runId: string | undefined): TurnTimingTrace | undefined {
  if (!runId) return undefined;
  return activeTraces.get(runId);
}

export function endTurnTrace(runId: string, telemetry?: TelemetryClient): TurnTimingSnapshot | undefined {
  const trace = activeTraces.get(runId);
  if (!trace) return undefined;
  activeTraces.delete(runId);
  const snap = trace.finalize(telemetry);
  completedTraces.push(snap);
  if (completedTraces.length > MAX_COMPLETED) {
    completedTraces.splice(0, completedTraces.length - MAX_COMPLETED);
  }
  return snap;
}

export function listCompletedTurnTraces(): TurnTimingSnapshot[] {
  return [...completedTraces];
}

export function clearCompletedTurnTraces(): void {
  completedTraces.length = 0;
}

export function percentile(values: number[], p: number): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

export function summarizeStageDurations(
  traces: TurnTimingSnapshot[],
): Record<string, { count: number; p50?: number; p95?: number }> {
  const buckets = new Map<string, number[]>();
  for (const trace of traces) {
    for (const stage of trace.stages) {
      const list = buckets.get(stage.stage) ?? [];
      list.push(stage.durationMs);
      buckets.set(stage.stage, list);
    }
  }
  const out: Record<string, { count: number; p50?: number; p95?: number }> = {};
  for (const [stage, durations] of buckets) {
    out[stage] = {
      count: durations.length,
      p50: percentile(durations, 50),
      p95: percentile(durations, 95),
    };
  }
  return out;
}

export async function loadTurnTracesFromLog(logPath: string): Promise<TurnTimingSnapshot[]> {
  const { readFile } = await import("node:fs/promises");
  try {
    const raw = await readFile(logPath, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as TurnTimingSnapshot);
  } catch {
    return [];
  }
}
