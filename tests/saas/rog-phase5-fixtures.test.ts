import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reconcileDeliverableGroundTruth } from "../../src/saas/deliverables/deliverableGroundTruth.js";
import {
  resolveContinuationAction,
  shouldTriggerDeliverableRepair,
} from "../../src/saas/taskContinuationPolicy.js";

const fixtureDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/task-recovery",
);

type RogFixture = {
  id: string;
  userGoal: string;
  sessionManifest?: Record<string, unknown>;
  validationResult: {
    verified: string[];
    missing: string[];
    broken: string[];
  };
  expectedAcceptance?: string;
  expectedContinuationAction?: string;
};

function loadFixtures(): RogFixture[] {
  return fs.readdirSync(fixtureDir)
    .filter((name) => (name.startsWith("rog-") || name.startsWith("geo-")) && name.endsWith(".json"))
    .map((name) => JSON.parse(fs.readFileSync(path.join(fixtureDir, name), "utf8")) as RogFixture);
}

describe("rog-phase5 fixtures", () => {
  for (const fixture of loadFixtures()) {
    if (!fixture.validationResult) continue;
    it(`${fixture.id}: acceptance + continuation`, () => {
      process.env.PILOTDECK_GROUND_TRUTH_RECONCILE = "1";
      process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";

      const validation = fixture.validationResult;
      const groundTruth = reconcileDeliverableGroundTruth({
        userGoal: fixture.userGoal,
        verified: validation.verified,
        missing: validation.missing,
        broken: validation.broken,
        sessionManifest: fixture.sessionManifest as never,
        profileId: (fixture.sessionManifest as { profileId?: string } | undefined)?.profileId,
      });

      if (fixture.expectedAcceptance) {
        expect(groundTruth.acceptance).toBe(fixture.expectedAcceptance);
      }

      const shouldRepair = shouldTriggerDeliverableRepair({
        userGoal: fixture.userGoal,
        validationResult: {
          verified: validation.verified,
          missing: groundTruth.reconciled ? [] : validation.missing,
          broken: validation.broken,
        },
        sessionManifest: fixture.sessionManifest as never,
        autoRecoveryContinueEnabled: true,
      });

      const action = resolveContinuationAction({
        userGoal: fixture.userGoal,
        validationResult: {
          verified: validation.verified,
          missing: groundTruth.reconciled ? [] : validation.missing,
          broken: validation.broken,
        },
        sessionManifest: fixture.sessionManifest as never,
        autoRecoveryContinueEnabled: true,
      });

      if (fixture.expectedContinuationAction === "none") {
        expect(shouldRepair).toBe(false);
        expect(action).not.toBe("deliverable_repair");
      }
      if (fixture.expectedContinuationAction === "deliverable_repair") {
        expect(shouldRepair).toBe(true);
        expect(action).toBe("deliverable_repair");
      }
    });
  }
});
