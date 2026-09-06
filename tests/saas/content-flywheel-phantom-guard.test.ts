import { describe, expect, it } from "vitest";
import { compileSessionDeliverableManifest } from "../../src/saas/taskState/sessionDeliverableManifest.js";
import { BLACKCLOAK_MATRIX_GOAL } from "../fixtures/three-case-speed-rca-20260726.js";

describe("content flywheel phantom guard (P0-C)", () => {
  const prev = process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;

  it("blackcloak matrix goal excludes flywheel basenames", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const manifest = compileSessionDeliverableManifest({
      userGoal: BLACKCLOAK_MATRIX_GOAL,
      capabilitySlug: "humanizer",
      turnId: "t1",
      taskArtifactDir: "artifacts/task-20260726-b75064fd",
    });
    const text = (manifest?.slots ?? [])
      .map((s) => `${s.label} ${s.pathHint ?? ""}`)
      .join(" ");
    expect(text).not.toMatch(/01-topics|02-longform|03-social-slices/i);
    expect(manifest?.profileId).not.toBe("content_flywheel");
    if (prev === undefined) delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
    else process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = prev;
  });

  it("explicit content-flywheel goal keeps three files", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const goal = "content-flywheel 须交付：01-topics.md、02-longform.md、03-social-slices.md";
    const manifest = compileSessionDeliverableManifest({
      userGoal: goal,
      capabilitySlug: "content-flywheel",
      turnId: "t2",
    });
    const text = (manifest?.slots ?? []).map((s) => s.pathHint ?? s.label).join(" ");
    expect(text).toMatch(/01-topics|02-longform|03-social-slices/i);
    if (prev === undefined) delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
    else process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = prev;
  });
});
