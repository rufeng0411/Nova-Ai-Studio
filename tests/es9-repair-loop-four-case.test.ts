import { describe, expect, it } from "vitest";
import { filterAcceptancePathsForScope, pathUnderAcceptanceScope } from "../src/saas/deliverables/filterAcceptancePathsForScope.js";
import { ES9_REPAIR_LOOP_FOUR_CASES } from "./fixtures/es9-repair-loop-four-case.js";
import { resolveDeliverableUserStatusCopy } from "../ui/src/shared/deliverableUserStatusCopy.js";
import { gateAssistantCompletionText } from "../src/saas/deliverables/assistantCompletionGate.js";

describe("filterAcceptancePathsForScope", () => {
  it("filters paths outside task scope", () => {
    const scope = "artifacts/task-20260722-be61b997";
    const filtered = filterAcceptancePathsForScope(
      [
        "artifacts/task-20260722-be61b997/report.md",
        "artifacts/task-20260722-a7a1f199/promo-video.mp4",
      ],
      scope,
    );
    expect(filtered).toEqual(["artifacts/task-20260722-be61b997/report.md"]);
  });

  it("pathUnderAcceptanceScope accepts nested paths", () => {
    expect(pathUnderAcceptanceScope(
      "artifacts/task-20260722-be61b997/sub/report.md",
      "artifacts/task-20260722-be61b997",
    )).toBe(true);
  });
});

describe("es9-repair-loop-four-case trust copy", () => {
  it("repair phase never shows user ack hint", () => {
    for (const caseDef of ES9_REPAIR_LOOP_FOUR_CASES) {
      const copy = resolveDeliverableUserStatusCopy({
        sessionTaskPhase: "deliverable_repair_pending",
        autoContinueEnabled: true,
        continuationOwner: "deliverable_repair",
        requiredDone: 2,
        requiredTotal: 4,
        trustCopyV2Enabled: true,
      });
      expect(copy.showUserAckHint, caseDef.id).toBe(false);
      expect(copy.composerPlaceholderKey, caseDef.id).toBe("composer.deliverableAligningPlaceholder");
    }
  });

  it("scope-out paths trigger footnote in assistant gate", () => {
    process.env.PILOTDECK_ASSISTANT_COMPLETION_GATE = "shadow";
    for (const caseDef of ES9_REPAIR_LOOP_FOUR_CASES) {
      if (!caseDef.outOfScopePaths?.length || !caseDef.scopeDir) continue;
      const result = gateAssistantCompletionText(
        {
          text: `文件在 ${caseDef.outOfScopePaths[0]}`,
          acceptanceStatus: "needs_repair",
          taskArtifactDir: caseDef.scopeDir,
        },
        "zh-CN",
      );
      expect(result.text, caseDef.id).toContain("本任务目录");
    }
  });
});
