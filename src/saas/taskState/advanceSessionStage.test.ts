import { describe, expect, it } from "vitest";

import {
  advanceSessionStage,
  matchPathToCurrentStage,
  type SessionDeliverableManifest,
} from "./sessionDeliverableManifest.js";

function buildStagedManifest(): SessionDeliverableManifest {
  return {
    manifestVersion: 1,
    goalVersion: 1,
    sessionGoalAnchor: "增长全案",
    capabilitySlug: "saas-growth-full",
    baselineLocked: true,
    currentStageId: "stage_1",
    slots: [
      {
        id: "s1",
        label: "调研",
        kind: "markdown",
        pathHint: "market-research.md",
        required: true,
        stageId: "stage_1",
        stageOrder: 1,
        status: "active",
      },
      {
        id: "s2",
        label: "定位",
        kind: "markdown",
        pathHint: "positioning-pricing.md",
        required: true,
        stageId: "stage_2",
        stageOrder: 2,
        status: "pending",
      },
    ],
  };
}

describe("advanceSessionStage", () => {
  it("blocks writes outside current stage when sequential flag on", () => {
    process.env.PILOTDECK_SEQUENTIAL_DELIVERABLES = "1";
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const manifest = buildStagedManifest();
    const blocked = matchPathToCurrentStage(
      "artifacts/task-demo/positioning-pricing.md",
      manifest,
    );
    expect(blocked.allowed).toBe(false);
    const allowed = matchPathToCurrentStage(
      "artifacts/task-demo/market-research.md",
      manifest,
    );
    expect(allowed.allowed).toBe(true);
  });

  it("advances currentStageId when stage slots verified", () => {
    process.env.PILOTDECK_SEQUENTIAL_DELIVERABLES = "1";
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const manifest = buildStagedManifest();
    const advanced = advanceSessionStage(manifest, [
      "artifacts/task-demo/market-research.md",
    ]);
    expect(advanced.changed).toBe(true);
    expect(advanced.manifest.currentStageId).toBe("stage_2");
  });
});
