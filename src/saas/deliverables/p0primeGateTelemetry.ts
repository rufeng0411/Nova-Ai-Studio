// PD-SAAS-FORK P0′: shadow-mode telemetry for office/completion gates.
import fs from "node:fs";
import path from "node:path";

export type P0PrimeGateEvent = {
  flag: string;
  caseId?: string;
  path?: string;
  reason: string;
  at?: string;
};

const TELEMETRY_REL = ".saas-dev-data/telemetry/p0prime-gate-events.jsonl";

export function recordP0PrimeGateEvent(event: P0PrimeGateEvent): void {
  if (typeof process === "undefined" || !process.cwd) return;
  try {
    const filePath = path.join(process.cwd(), TELEMETRY_REL);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.appendFileSync(
      filePath,
      `${JSON.stringify({ ...event, at: event.at ?? new Date().toISOString() })}\n`,
      "utf8",
    );
  } catch {
    // telemetry must never block deliverable validation
  }
}
