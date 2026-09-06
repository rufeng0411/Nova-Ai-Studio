import { describe, expect, it } from "vitest";
import {
  applyTaskArtifactDirAcceptanceGateForTest,
  extractCandidateDeliverablePaths,
} from "../../src/agent/deliverables/validateDeliverablesEngine.js";
import {
  filterRepairEligiblePaths,
  isRepairEligiblePath,
  isRepairPlaceholderDeliverablePath,
} from "../../src/saas/deliverables/repairEligiblePath.js";
import type { CanonicalMessage } from "../../src/model/index.js";

describe("repairEligiblePath (ROG M2)", () => {
  it("rejects Campaign phantom bare filenames from assistant prose", () => {
    expect(isRepairEligiblePath("好，campaign-plan.md")).toBe(false);
    expect(isRepairEligiblePath("2645858886640783360.md")).toBe(false);
    expect(isRepairEligiblePath("2026-07-05 23:46:21.362.md")).toBe(false);
    expect(isRepairEligiblePath("07-05.md")).toBe(false);
    expect(isRepairPlaceholderDeliverablePath("07-05.md")).toBe(true);
  });

  it("accepts artifacts/ paths and allowlisted basenames", () => {
    expect(isRepairEligiblePath("artifacts/campaign/rog/campaign-plan.md")).toBe(true);
    expect(
      isRepairEligiblePath("intel.md", {
        allowBasenames: ["intel.md"],
      }),
    ).toBe(true);
    expect(
      isRepairEligiblePath("battlecard.md", {
        allowPathHints: ["artifacts/sales/rog/battlecard.md"],
      }),
    ).toBe(true);
  });

  it("extractCandidateDeliverablePaths ignores bare md from prose", () => {
    const messages: CanonicalMessage[] = [{
      role: "assistant",
      content: [{
        type: "text",
        text: "好，campaign-plan.md 已写好，还缺 2645858886640783360.md 与 2026-07-05 23:46:21.362",
      }],
    }];
    const paths = extractCandidateDeliverablePaths(messages);
    expect(paths).toEqual([]);
  });

  it("extractCandidateDeliverablePaths keeps artifacts/ paths", () => {
    const messages: CanonicalMessage[] = [{
      role: "assistant",
      content: [{
        type: "text",
        text: "交付 artifacts/campaign/rog/campaign-plan.md 与 artifacts/campaign/rog/brief.md",
      }],
    }];
    const paths = extractCandidateDeliverablePaths(messages);
    expect(paths).toContain("artifacts/campaign/rog/campaign-plan.md");
    expect(paths).toContain("artifacts/campaign/rog/brief.md");
  });

  it("filterRepairEligiblePaths drops phantom missing list", () => {
    const filtered = filterRepairEligiblePaths([
      "artifacts/campaign/rog/brief.md",
      "好，campaign-plan.md",
      "07-05.md",
    ]);
    expect(filtered).toEqual(["artifacts/campaign/rog/brief.md"]);
  });
});

describe("Fix-7 taskArtifactDir acceptance gate", () => {
  const passedBase = {
    verified: ["tmp_workspace/lv/output.md"],
    missing: [] as string[],
    broken: [] as string[],
    failures: [] as Array<{ reason: string; message: string }>,
    acceptance: "passed" as const,
  };

  it("blocks passed when STDA required but taskArtifactDir missing", () => {
    process.env.PILOTDECK_SESSION_TASK_DIRECTORY = "1";
    const result = applyTaskArtifactDirAcceptanceGateForTest(
      {
        userGoal: "须交付：output.md，写入系统分配任务目录",
        completionMode: "report",
        sessionManifest: {
          slots: [{ id: "slot_1", label: "output.md", pathHint: "output.md", kind: "markdown", required: true, status: "pending" }],
        } as never,
      },
      passedBase,
    );
    expect(result.acceptance).toBe("needs_repair");
    expect(result.failures.some((f) => f.path === "taskArtifactDir")).toBe(true);
    delete process.env.PILOTDECK_SESSION_TASK_DIRECTORY;
  });

  it("keeps passed when taskArtifactDir is present", () => {
    process.env.PILOTDECK_SESSION_TASK_DIRECTORY = "1";
    const result = applyTaskArtifactDirAcceptanceGateForTest(
      {
        userGoal: "须交付：output.md",
        completionMode: "report",
        sessionManifest: {
          taskArtifactDir: "artifacts/task-20260725-abc12345",
          slots: [{ id: "slot_1", label: "output.md", pathHint: "output.md", kind: "markdown", required: true, status: "done" }],
        } as never,
      },
      passedBase,
    );
    expect(result.acceptance).toBe("passed");
    delete process.env.PILOTDECK_SESSION_TASK_DIRECTORY;
  });
});
