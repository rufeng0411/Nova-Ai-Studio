import { describe, expect, it } from "vitest";
import {
  bindContractUnitsStrict,
  computeStableContractHashV2,
  expandSlotsToContractUnits,
  isContractPlaceholderPath,
  MAX_CONTRACT_EVIDENCE,
  MAX_CONTRACT_UNITS,
} from "./deliverableContractBinding.js";
import type { SessionDeliverableManifest } from "../taskState/sessionDeliverableManifest.js";

function manifest(
  slots: SessionDeliverableManifest["slots"],
  taskArtifactDir = "artifacts/task-0717/",
): SessionDeliverableManifest {
  return {
    manifestVersion: 1,
    goalVersion: 1,
    sessionGoalAnchor: "anchor",
    slots,
    taskArtifactDir,
  };
}

describe("deliverableContractBinding", () => {
  it("expands count=3 slide slot into slide-01..03.png and rejects slide-NN literal", () => {
    const m = manifest([
      {
        id: "slides",
        label: "幻灯页",
        kind: "image",
        count: 3,
        pathHint: "slide-NN.png",
        required: true,
        status: "active",
      },
    ]);
    const units = expandSlotsToContractUnits(m, m.taskArtifactDir);
    expect(units).toHaveLength(3);
    expect(units.map((unit) => unit.expectedBasename)).toEqual([
      "slide-01.png",
      "slide-02.png",
      "slide-03.png",
    ]);
    expect(isContractPlaceholderPath("artifacts/task-0717/slide-NN.png")).toBe(true);
  });

  it("assigns count units from pathHints by index without repeating the first hint", () => {
    const m = manifest([
      {
        id: "articles",
        label: "成稿",
        kind: "markdown",
        count: 2,
        pathHint: "article-a.md",
        pathHints: ["article-a.md", "article-b.md"],
        required: true,
        status: "active",
      },
    ]);

    const units = expandSlotsToContractUnits(m, m.taskArtifactDir);

    expect(units.map((unit) => unit.expectedPath)).toEqual([
      "artifacts/task-0717/article-a.md",
      "artifacts/task-0717/article-b.md",
    ]);
  });

  it("keeps count units deterministic and unique when only one path hint exists", () => {
    const m = manifest([
      {
        id: "articles",
        label: "成稿",
        kind: "markdown",
        count: 2,
        pathHint: "article.md",
        required: true,
        status: "active",
      },
    ]);

    const units = expandSlotsToContractUnits(m, m.taskArtifactDir);

    expect(units).toHaveLength(2);
    expect(new Set(units.map((unit) => unit.expectedPath)).size).toBe(2);
    expect(units[0]?.expectedPath).toBe("artifacts/task-0717/article.md");
  });

  it("deduplicates repeated pathHints before expanding count units", () => {
    const m = manifest([
      {
        id: "articles",
        label: "成稿",
        kind: "markdown",
        count: 2,
        pathHints: ["article.md", "article.md"],
        required: true,
        status: "active",
      },
    ]);

    const units = expandSlotsToContractUnits(m, m.taskArtifactDir);

    expect(units.map((unit) => unit.expectedPath)).toEqual([
      "artifacts/task-0717/article.md",
      "artifacts/task-0717/article-2.md",
    ]);
  });

  it("binds contract hash v2 to normalized scope, goal, count, and path hints", () => {
    const base = manifest([
      {
        id: "articles",
        label: "成稿",
        kind: "markdown",
        count: 2,
        pathHints: ["article-a.md", "article-b.md"],
        required: true,
        status: "active",
      },
    ], "artifacts/task-a/");

    expect(computeStableContractHashV2(base)).toBe(
      computeStableContractHashV2({ ...base, taskArtifactDir: "artifacts\\task-a" }),
    );
    expect(computeStableContractHashV2(base)).not.toBe(
      computeStableContractHashV2({ ...base, taskArtifactDir: "artifacts/task-b/" }),
    );
    expect(computeStableContractHashV2(base)).not.toBe(
      computeStableContractHashV2({ ...base, goalVersion: 2 }),
    );
    expect(computeStableContractHashV2(base)).not.toBe(
      computeStableContractHashV2({
        ...base,
        slots: [{ ...base.slots[0]!, count: 3 }],
      }),
    );
    expect(computeStableContractHashV2(base)).not.toBe(
      computeStableContractHashV2({
        ...base,
        slots: [{
          ...base.slots[0]!,
          pathHints: ["article-a.md", "article-c.md"],
        }],
      }),
    );
  });

  it("does not treat slot.status=done or resolvedPath alone as evidence", () => {
    const m = manifest([
      {
        id: "report",
        label: "报告",
        kind: "markdown",
        pathHint: "nova-market-report.md",
        required: true,
        status: "done",
        resolvedPath: "artifacts/task-0717/nova-market-report.md",
      },
    ]);
    const binding = bindContractUnitsStrict({
      manifest: m,
      verifiedPaths: [],
      scopeDir: m.taskArtifactDir,
    });
    expect(binding.matchedCount).toBe(0);
    expect(binding.complete).toBe(false);
  });

  it("binds one evidence file to one unit only", () => {
    const m = manifest([
      {
        id: "a",
        label: "报告 A",
        kind: "markdown",
        pathHint: "report-a.md",
        required: true,
        status: "active",
      },
      {
        id: "b",
        label: "报告 B",
        kind: "markdown",
        pathHint: "report-b.md",
        required: true,
        status: "active",
      },
    ]);
    const binding = bindContractUnitsStrict({
      manifest: m,
      verifiedPaths: ["artifacts/task-0717/report-a.md"],
      scopeDir: m.taskArtifactDir,
    });
    expect(binding.matchedCount).toBe(1);
    expect(binding.bindings.filter((row) => row.matched)).toHaveLength(1);
    expect(new Set(binding.usedEvidencePaths)).toEqual(
      new Set(["artifacts/task-0717/report-a.md"]),
    );
  });

  it("scores exact path before kind-only fallback", () => {
    const m = manifest([
      {
        id: "html_page",
        label: "阵容 HTML",
        kind: "html",
        pathHint: "spain-lineup.html",
        required: true,
        status: "active",
      },
    ]);
    const binding = bindContractUnitsStrict({
      manifest: m,
      verifiedPaths: [
        "artifacts/task-0717/other.html",
        "artifacts/task-0717/spain-lineup.html",
      ],
      scopeDir: m.taskArtifactDir,
    });
    expect(binding.complete).toBe(true);
    expect(binding.bindings[0]?.evidencePath).toBe("artifacts/task-0717/spain-lineup.html");
    expect(binding.bindings[0]?.matchTier).toBe("exact");
  });

  it("rejects placeholder, out-of-scope, and process evidence paths", () => {
    const m = manifest([
      {
        id: "report",
        label: "报告",
        kind: "markdown",
        pathHint: "final-report.md",
        required: true,
        status: "active",
      },
    ]);
    const binding = bindContractUnitsStrict({
      manifest: m,
      verifiedPaths: [
        "artifacts/task-0717/slide-[N].png",
        "artifacts/other-task/final-report.md",
        "artifacts/task-0717/build.py",
        "artifacts/task-0717/final-report.md",
      ],
      scopeDir: m.taskArtifactDir,
    });
    expect(binding.matchedCount).toBe(1);
    expect(binding.bindings[0]?.evidencePath).toBe("artifacts/task-0717/final-report.md");
  });

  it("fail-closed when unit budget exceeded", () => {
    const slots = Array.from({ length: MAX_CONTRACT_UNITS + 1 }, (_, index) => ({
      id: `slot_${index}`,
      label: `Slot ${index}`,
      kind: "markdown",
      pathHint: `file-${index}.md`,
      required: true,
      status: "active" as const,
    }));
    const binding = bindContractUnitsStrict({
      manifest: manifest(slots),
      verifiedPaths: [],
      scopeDir: "artifacts/task-0717/",
    });
    expect(binding.complete).toBe(false);
    expect(binding.incompleteReason).toMatch(/contract_unit_budget_exceeded/);
  });

  it("fail-closed when raw evidence budget exceeded", () => {
    const m = manifest([
      {
        id: "one",
        label: "One",
        kind: "markdown",
        pathHint: "one.md",
        required: true,
        status: "active",
      },
    ]);
    const overflow = Array.from(
      { length: MAX_CONTRACT_EVIDENCE + 1 },
      (_, index) => `artifacts/task-0717/file-${index}.md`,
    );
    const binding = bindContractUnitsStrict({
      manifest: m,
      verifiedPaths: overflow,
      scopeDir: m.taskArtifactDir,
    });
    expect(binding.complete).toBe(false);
    expect(binding.incompleteReason).toMatch(/evidence_budget_exceeded/);
  });

  it("returns requiredCount/matchedCount/resolvedPaths per slot summary", () => {
    const m = manifest([
      {
        id: "slides",
        label: "幻灯",
        kind: "image",
        count: 2,
        required: true,
        status: "active",
      },
    ]);
    const binding = bindContractUnitsStrict({
      manifest: m,
      verifiedPaths: ["artifacts/task-0717/slide-01.png"],
      scopeDir: m.taskArtifactDir,
    });
    expect(binding.slotSummaries).toHaveLength(1);
    expect(binding.slotSummaries[0]).toMatchObject({
      slotId: "slides",
      requiredCount: 2,
      matchedCount: 1,
      resolvedPaths: ["artifacts/task-0717/slide-01.png"],
    });
  });
});
