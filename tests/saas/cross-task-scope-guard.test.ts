import { describe, expect, it } from "vitest";
import { filterVerifiedForContractBinding } from "../../src/saas/deliverables/filterVerifiedForContractBinding.js";
import { isCrossTaskArtifactPath } from "../../src/saas/taskState/taskPathGuard.js";

describe("cross-task scope guard (P0-E)", () => {
  const scopeDir = "artifacts/task-20260726-b75064fd";

  it("detects cross-task artifact paths", () => {
    expect(
      isCrossTaskArtifactPath("artifacts/task-20260711-09c598fc/01-topics.md", scopeDir),
    ).toBe(true);
    expect(
      isCrossTaskArtifactPath("artifacts/task-20260726-b75064fd/zhihu.md", scopeDir),
    ).toBe(false);
  });

  it("filterVerified excludes paths outside scopeDir", () => {
    const verified = [
      "artifacts/task-20260726-b75064fd/article.md",
      "artifacts/task-20260711-09c598fc/01-topics.md",
    ];
    const filtered = filterVerifiedForContractBinding(verified, { scopeDir });
    expect(filtered).toContain("artifacts/task-20260726-b75064fd/article.md");
    expect(filtered.some((p) => p.includes("20260711"))).toBe(false);
  });
});
