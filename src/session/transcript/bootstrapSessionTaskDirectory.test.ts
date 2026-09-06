/**
 * PD-SAAS-FORK: STDA bootstrap preserve-root on add/remove/replace mutations.
 */
import { describe, expect, it } from "vitest";
import type { SessionDeliverableManifest } from "../../saas/taskState/sessionDeliverableManifest.js";
import { buildTaskArtifactDirFromKey } from "../../saas/taskState/sessionTaskDirectoryCore.js";

describe("bootstrapSessionTaskDirectory preserve-root semantics", () => {
  it("add mutation should not forceNew when preserve flag is on", () => {
    process.env.PILOTDECK_STDA_ADD_PRESERVE_ROOT = "1";
    const primaryDir = "artifacts/task-20260710-f4424421";
    const manifest: SessionDeliverableManifest = {
      manifestVersion: 2,
      goalVersion: 2,
      profileId: "profile_geo",
      taskArtifactDir: primaryDir,
      supersedes: { diff: "add", priorManifestVersion: 1 },
      slots: [
        { id: "slot_md", label: "报告", kind: "markdown", pathHint: "report.md", required: true },
        { id: "slot_html_1", label: "HTML 1", kind: "html", pathHint: "report-1-depth.html", required: true },
      ],
    };
    expect(manifest.supersedes?.diff).toBe("add");
    expect(manifest.taskArtifactDir).toBe(primaryDir);
    expect(manifest.goalVersion).toBe(2);
    delete process.env.PILOTDECK_STDA_ADD_PRESERVE_ROOT;
  });

  it("pivot diff should allocate a new task directory key", () => {
    const oldKey = "20260710-f4424421";
    const newKey = "20260710-ffd81a25";
    expect(buildTaskArtifactDirFromKey(oldKey)).toBe("artifacts/task-20260710-f4424421");
    expect(buildTaskArtifactDirFromKey(newKey)).toBe("artifacts/task-20260710-ffd81a25");
    expect(buildTaskArtifactDirFromKey(oldKey)).not.toBe(buildTaskArtifactDirFromKey(newKey));
  });
});
