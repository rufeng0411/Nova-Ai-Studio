import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_COLD_RESUME_CONFIG,
  decideColdResume,
  parseActivityMs,
  resolveColdResumeConfig,
  type ColdResumeGuardInput,
} from "./coldResumeGuard.js";

const NOW = 1_000_000_000_000;

function baseInput(overrides: Partial<ColdResumeGuardInput> = {}): ColdResumeGuardInput {
  return {
    incomplete: { turnId: "t1", blockedOn: "infra" },
    lastActivityMs: NOW - 60_000,
    nowMs: NOW,
    priorAttempts: 0,
    lastFiredAtMs: null,
    userBlocked: false,
    ...overrides,
  };
}

describe("decideColdResume", () => {
  it("allows a recent, un-fired, non-blocked interrupted turn", () => {
    expect(decideColdResume(baseInput())).toEqual({ allowed: true, reason: "allowed" });
  });

  it("does not resume when there is no incomplete turn", () => {
    expect(decideColdResume(baseInput({ incomplete: null })).reason).toBe("no_incomplete_turn");
  });

  it("does not resume turns awaiting user action", () => {
    expect(decideColdResume(baseInput({ userBlocked: true })).reason).toBe("user_blocked");
    expect(
      decideColdResume(baseInput({ incomplete: { turnId: "t1", blockedOn: "permission" } })).reason,
    ).toBe("user_blocked");
  });

  it("does not resume old / abandoned sessions outside the recency window", () => {
    const stale = baseInput({ lastActivityMs: NOW - (DEFAULT_COLD_RESUME_CONFIG.recencyWindowMs + 1) });
    expect(decideColdResume(stale).reason).toBe("stale_outside_recency");
  });

  it("does not resume without a usable timestamp", () => {
    expect(decideColdResume(baseInput({ lastActivityMs: null })).reason).toBe("missing_timestamp");
  });

  it("stops re-firing once the crash-loop budget is exhausted", () => {
    const exhausted = baseInput({ priorAttempts: DEFAULT_COLD_RESUME_CONFIG.maxAttempts });
    expect(decideColdResume(exhausted).reason).toBe("budget_exhausted");
  });

  it("dedups multi-tab / refresh double-fire within the dedup window", () => {
    const justFired = baseInput({ lastFiredAtMs: NOW - 1_000 });
    expect(decideColdResume(justFired).reason).toBe("recently_fired");

    const longAgo = baseInput({
      lastFiredAtMs: NOW - (DEFAULT_COLD_RESUME_CONFIG.dedupWindowMs + 1),
      priorAttempts: 1,
    });
    expect(decideColdResume(longAgo)).toEqual({ allowed: true, reason: "allowed" });
  });

  it("respects config overrides", () => {
    const input = baseInput({ priorAttempts: 1, config: { maxAttempts: 1 } });
    expect(decideColdResume(input).reason).toBe("budget_exhausted");
  });
});

describe("resolveColdResumeConfig", () => {
  const KEYS = [
    "PILOTDECK_COLD_RESUME_RECENCY_MS",
    "PILOTDECK_COLD_RESUME_MAX_ATTEMPTS",
    "PILOTDECK_COLD_RESUME_DEDUP_MS",
  ];
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("defaults when env is unset or invalid", () => {
    expect(resolveColdResumeConfig({})).toEqual(DEFAULT_COLD_RESUME_CONFIG);
    expect(resolveColdResumeConfig({ PILOTDECK_COLD_RESUME_MAX_ATTEMPTS: "-3" }).maxAttempts).toBe(
      DEFAULT_COLD_RESUME_CONFIG.maxAttempts,
    );
  });

  it("reads positive integer overrides", () => {
    const cfg = resolveColdResumeConfig({
      PILOTDECK_COLD_RESUME_RECENCY_MS: "60000",
      PILOTDECK_COLD_RESUME_MAX_ATTEMPTS: "5",
      PILOTDECK_COLD_RESUME_DEDUP_MS: "10000",
    });
    expect(cfg).toEqual({ recencyWindowMs: 60000, maxAttempts: 5, dedupWindowMs: 10000 });
  });
});

describe("parseActivityMs", () => {
  it("parses ISO strings, numbers, and rejects junk", () => {
    expect(parseActivityMs("2026-06-26T00:00:00.000Z")).toBe(Date.parse("2026-06-26T00:00:00.000Z"));
    expect(parseActivityMs(1234)).toBe(1234);
    expect(parseActivityMs(null)).toBeNull();
    expect(parseActivityMs("not-a-date")).toBeNull();
  });
});
