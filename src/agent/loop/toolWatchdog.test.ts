import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_TOOL_WATCHDOG_CONFIG,
  decideWatchdogVerdict,
  maxBatchDeadlineMs,
  resolveToolDeadlineMs,
  resolveToolWatchdogConfig,
  withDeadline,
} from "./toolWatchdog.js";

describe("resolveToolDeadlineMs", () => {
  it("gives long deadlines to video / generation tools", () => {
    expect(resolveToolDeadlineMs("render_html_video")).toBe(240_000);
    expect(resolveToolDeadlineMs("generate_video")).toBe(240_000);
  });

  it("gives a quick deadline to read/write/edit tools", () => {
    expect(resolveToolDeadlineMs("read_file")).toBe(30_000);
    expect(resolveToolDeadlineMs("str_replace")).toBe(30_000);
  });

  it("matches web tools, agent tool, and subagents by substring", () => {
    expect(resolveToolDeadlineMs("web_search")).toBe(90_000);
    expect(resolveToolDeadlineMs("fork_subagent")).toBe(600_000);
    expect(resolveToolDeadlineMs("agent")).toBe(600_000);
  });

  it("falls back to the default deadline for unknown tools", () => {
    expect(resolveToolDeadlineMs("some_unknown_tool")).toBe(DEFAULT_TOOL_WATCHDOG_CONFIG.defaultDeadlineMs);
  });

  it("extends write_file deadline for large HTML payloads", () => {
    const large = "x".repeat(210_000);
    expect(resolveToolDeadlineMs("write_file", DEFAULT_TOOL_WATCHDOG_CONFIG, { content: large })).toBe(120_000);
  });
});

describe("maxBatchDeadlineMs", () => {
  it("returns the largest deadline across the batch", () => {
    expect(maxBatchDeadlineMs(["read_file", "render_html_video", "write_file"])).toBe(240_000);
  });

  it("returns the default for an empty batch", () => {
    expect(maxBatchDeadlineMs([])).toBe(DEFAULT_TOOL_WATCHDOG_CONFIG.defaultDeadlineMs);
  });
});

describe("decideWatchdogVerdict", () => {
  it("is ok within the deadline", () => {
    expect(decideWatchdogVerdict(10_000, 30_000)).toBe("ok");
  });

  it("warns past the deadline", () => {
    expect(decideWatchdogVerdict(31_000, 30_000)).toBe("warn");
  });

  it("times out past deadline * hardMultiplier", () => {
    expect(decideWatchdogVerdict(61_000, 30_000)).toBe("timeout");
  });
});

describe("resolveToolWatchdogConfig", () => {
  it("uses defaults when env is empty", () => {
    const cfg = resolveToolWatchdogConfig({});
    expect(cfg.defaultDeadlineMs).toBe(DEFAULT_TOOL_WATCHDOG_CONFIG.defaultDeadlineMs);
    expect(cfg.hardMultiplier).toBe(DEFAULT_TOOL_WATCHDOG_CONFIG.hardMultiplier);
  });

  it("reads tunable values from env", () => {
    const cfg = resolveToolWatchdogConfig({
      PILOTDECK_TOOL_DEADLINE_MS: "45000",
      PILOTDECK_TOOL_HARD_MULTIPLIER: "3",
    });
    expect(cfg.defaultDeadlineMs).toBe(45_000);
    expect(cfg.hardMultiplier).toBe(3);
  });
});

describe("withDeadline", () => {
  it("resolves with the value when the promise wins", async () => {
    const outcome = await withDeadline(Promise.resolve("done"), 1_000);
    expect(outcome).toEqual({ timedOut: false, value: "done" });
  });

  it("resolves with a timeout sentinel when the deadline wins", async () => {
    vi.useFakeTimers();
    try {
      const slow = new Promise<string>((resolve) => setTimeout(() => resolve("late"), 10_000));
      const outcomePromise = withDeadline(slow, 1_000);
      await vi.advanceTimersByTimeAsync(1_001);
      expect(await outcomePromise).toEqual({ timedOut: true });
    } finally {
      vi.useRealTimers();
    }
  });

  it("never rejects: a rejected promise resolves to a timeout sentinel", async () => {
    const outcome = await withDeadline(Promise.reject(new Error("boom")), 1_000);
    expect(outcome).toEqual({ timedOut: true });
  });
});
