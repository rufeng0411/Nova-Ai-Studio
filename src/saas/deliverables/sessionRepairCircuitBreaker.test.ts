import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  isSessionRepairCircuitBreakerEnabled,
  recordSessionRepairGap,
} from "./sessionRepairCircuitBreaker.js";

describe("sessionRepairCircuitBreaker", () => {
  const prev = process.env.PILOTDECK_SESSION_REPAIR_CIRCUIT_BREAKER;
  const prevGap = process.env.PILOTDECK_SESSION_REPAIR_GAP_LIMIT;

  beforeEach(() => {
    process.env.PILOTDECK_SESSION_REPAIR_CIRCUIT_BREAKER = "1";
    process.env.PILOTDECK_SESSION_REPAIR_GAP_LIMIT = "3";
  });

  afterEach(() => {
    if (prev == null) delete process.env.PILOTDECK_SESSION_REPAIR_CIRCUIT_BREAKER;
    else process.env.PILOTDECK_SESSION_REPAIR_CIRCUIT_BREAKER = prev;
    if (prevGap == null) delete process.env.PILOTDECK_SESSION_REPAIR_GAP_LIMIT;
    else process.env.PILOTDECK_SESSION_REPAIR_GAP_LIMIT = prevGap;
  });

  it("is enabled by default", () => {
    expect(isSessionRepairCircuitBreakerEnabled()).toBe(true);
  });

  it("trips after same gap 3 times across turns", () => {
    let manifest = { manifestVersion: 2 as const, goalVersion: 1, sessionGoalAnchor: "ppt" };
    let tripped = false;
    for (let i = 0; i < 3; i += 1) {
      const result = recordSessionRepairGap({
        manifest,
        missing: ["artifacts/deck/presentation.pptx"],
        broken: [],
        verified: [],
      });
      manifest = { ...manifest, repairCircuit: result.circuit };
      tripped = result.tripped;
    }
    expect(tripped).toBe(true);
    expect(manifest.repairCircuit?.tripped).toBe(true);
  });

  it("skips structural alias gaps when real pptx verified", () => {
    const result = recordSessionRepairGap({
      manifest: { manifestVersion: 2, goalVersion: 1, sessionGoalAnchor: "ppt" },
      missing: ["artifacts/deck/presentation.pptx"],
      broken: [],
      verified: ["artifacts/deck/thunderobot-laptop.pptx"],
    });
    expect(result.tripped).toBe(false);
    expect(result.circuit.totalRepairs).toBe(0);
  });

  it("0731-fail-B: distill gap×3 trips repairCircuit", () => {
    let manifest = {
      manifestVersion: 2 as const,
      goalVersion: 1,
      sessionGoalAnchor: "distill",
      slots: [{
        id: "authority_writing-style-distill_1",
        label: "深度蒸馏成稿",
        required: true,
        status: "active" as const,
        kind: "markdown" as const,
        pathHint: "writing-style-distill.md",
      }],
    };
    let tripped = false;
    for (let i = 0; i < 3; i += 1) {
      const result = recordSessionRepairGap({
        manifest,
        missing: ["writing-style-distill.md"],
        broken: [],
        sdmGapKey: "authority_writing-style-distill_1",
        verified: ["artifacts/task-x/unrelated.md"],
      });
      manifest = { ...manifest, repairCircuit: result.circuit };
      tripped = result.tripped;
    }
    expect(tripped).toBe(true);
    expect(manifest.repairCircuit?.tripped).toBe(true);
  });

  it("0731-fail-B: distill gap does not trip when verified net increases", () => {
    let manifest = {
      manifestVersion: 2 as const,
      goalVersion: 1,
      sessionGoalAnchor: "distill",
    };
    for (let i = 0; i < 3; i += 1) {
      const result = recordSessionRepairGap({
        manifest,
        missing: ["writing-style-distill.md"],
        broken: [],
        sdmGapKey: "authority_writing-style-distill_1",
        verified: Array.from({ length: i + 1 }, (_, j) => `artifacts/task-x/f${j}.md`),
      });
      manifest = { ...manifest, repairCircuit: result.circuit };
    }
    expect(manifest.repairCircuit?.tripped).toBeFalsy();
  });

  it("campaign gap still uses global limit (not distill-only early path)", () => {
    let manifest = {
      manifestVersion: 2 as const,
      goalVersion: 1,
      sessionGoalAnchor: "campaign",
    };
    process.env.PILOTDECK_SESSION_REPAIR_GAP_LIMIT = "3";
    let tripped = false;
    for (let i = 0; i < 2; i += 1) {
      const result = recordSessionRepairGap({
        manifest,
        missing: ["artifacts/campaign/research-report.md"],
        broken: [],
        sdmGapKey: "brand_research",
        verified: [],
      });
      manifest = { ...manifest, repairCircuit: result.circuit };
      tripped = result.tripped;
    }
    expect(tripped).toBe(false);
  });
});
