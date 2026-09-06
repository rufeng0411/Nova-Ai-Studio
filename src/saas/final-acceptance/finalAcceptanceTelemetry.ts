// PD-SAAS-FORK: fire-and-forget final acceptance telemetry.
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { FinalAcceptanceResult } from "./finalAcceptanceState.js";
import { summarizeFinalAcceptance } from "./finalAcceptanceSignals.js";

export type FinalAcceptanceTelemetryEvent = {
  recordedAtMs: number;
  sessionId?: string;
  turnId?: string;
  result: ReturnType<typeof summarizeFinalAcceptance>;
  budgetRemaining?: number;
};

function resolveLogPath(): string {
  const fromEnv = process.env.PILOTDECK_FINAL_ACCEPTANCE_LOG?.trim();
  if (fromEnv) return fromEnv;
  const dataRoot = process.env.PILOTDECK_DATA_ROOT?.trim() || process.env.DATA_ROOT?.trim();
  if (dataRoot) return resolve(dataRoot, "telemetry", "final-acceptance-events.jsonl");
  return resolve(process.cwd(), ".saas-dev-data", "telemetry", "final-acceptance-events.jsonl");
}

export function recordFinalAcceptanceEvent(input: {
  sessionId?: string;
  turnId?: string;
  result: FinalAcceptanceResult;
  budgetRemaining?: number;
}): void {
  const event: FinalAcceptanceTelemetryEvent = {
    recordedAtMs: Date.now(),
    sessionId: input.sessionId,
    turnId: input.turnId,
    result: summarizeFinalAcceptance(input.result),
    budgetRemaining: input.budgetRemaining,
  };
  const logPath = resolveLogPath();
  void (async () => {
    try {
      await mkdir(dirname(logPath), { recursive: true });
      await appendFile(logPath, `${JSON.stringify(event)}\n`, "utf8");
    } catch {
      // Telemetry must never affect user turns.
    }
  })();
}
