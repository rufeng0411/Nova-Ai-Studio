import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  loadStabilityEvents,
  recordStabilityEvent,
  resolveStabilityLogPath,
  summarizeStabilityByEvent,
  type StabilityEvent,
} from "./stabilityEvents.js";

const ENV_KEYS = ["PILOTDECK_STABILITY_LOG", "PILOTDECK_DATA_ROOT", "DATA_ROOT"];

async function waitForEvents(logPath: string, min: number, timeoutMs = 2000): Promise<StabilityEvent[]> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const events = await loadStabilityEvents(logPath);
    if (events.length >= min || Date.now() > deadline) return events;
    await new Promise((r) => setTimeout(r, 25));
  }
}

describe("stabilityEvents", () => {
  const saved: Record<string, string | undefined> = {};
  let dir: string;

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    dir = mkdtempSync(join(tmpdir(), "stability-events-"));
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it("resolves the log path from PILOTDECK_STABILITY_LOG, then DATA_ROOT, then cwd fallback", () => {
    process.env.PILOTDECK_STABILITY_LOG = join(dir, "explicit.jsonl");
    expect(resolveStabilityLogPath()).toBe(join(dir, "explicit.jsonl"));

    delete process.env.PILOTDECK_STABILITY_LOG;
    process.env.DATA_ROOT = dir;
    expect(resolveStabilityLogPath()).toBe(join(dir, "telemetry", "stability-events.jsonl"));

    delete process.env.DATA_ROOT;
    expect(resolveStabilityLogPath().endsWith(`telemetry${sep}stability-events.jsonl`)).toBe(true);
  });

  it("appends events as JSONL and reads them back", async () => {
    const logPath = join(dir, "events.jsonl");
    process.env.PILOTDECK_STABILITY_LOG = logPath;

    recordStabilityEvent({ event: "cold_resume_fired", sessionId: "s1", turnId: "t1", reason: "stale_disconnect" });
    recordStabilityEvent({ event: "degeneration_detected", reason: "table_repeat", detail: { rows: 42 } });

    const events = await waitForEvents(logPath, 2);
    expect(events.length).toBe(2);
    // Fire-and-forget appends run concurrently; assert membership, not order.
    const cold = events.find((e) => e.event === "cold_resume_fired");
    const degen = events.find((e) => e.event === "degeneration_detected");
    expect(cold?.reason).toBe("stale_disconnect");
    expect(degen?.detail?.rows).toBe(42);
    expect(typeof cold?.recordedAtMs).toBe("number");
  });

  it("summarizes counts by event name", () => {
    const summary = summarizeStabilityByEvent([
      { recordedAtMs: 1, event: "cold_resume_fired" },
      { recordedAtMs: 2, event: "cold_resume_fired" },
      { recordedAtMs: 3, event: "no_progress_terminal" },
    ]);
    expect(summary.cold_resume_fired).toBe(2);
    expect(summary.no_progress_terminal).toBe(1);
  });

  it("never throws even when the path is unwritable", () => {
    // a path whose parent is a file (not a directory) -> mkdir will fail and be swallowed
    process.env.PILOTDECK_STABILITY_LOG = join(dir, "events.jsonl", "nested", "deep.jsonl");
    expect(() => recordStabilityEvent({ event: "no_progress_terminal" })).not.toThrow();
  });
});
