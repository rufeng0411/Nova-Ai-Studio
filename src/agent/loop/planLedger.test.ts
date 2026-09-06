import { describe, expect, it } from "vitest";
import type { TaskGoalContract } from "../../saas/taskState/taskGoalContract.js";
import {
  buildPlanLedger,
  derivePlanSteps,
  evaluatePlanProgress,
  formatPlanLedgerHint,
} from "./planLedger.js";

function contract(partial: Partial<TaskGoalContract>): TaskGoalContract {
  return {
    goalVersion: 1,
    sourceGoal: "测试目标",
    expectedKinds: [],
    requiredFiles: [],
    qualityChecks: [],
    ...partial,
  };
}

describe("derivePlanSteps", () => {
  it("creates one ordered file step per required file (contract order, deduped)", () => {
    const steps = derivePlanSteps(contract({
      requiredFiles: ["research.md", "bible.md", "research.md"],
    }));
    expect(steps.map((step) => step.target)).toEqual(["research.md", "bible.md"]);
    expect(steps.every((step) => step.kind === "file")).toBe(true);
  });

  it("normalizes platform-drafts>=N tokens to a base label", () => {
    const steps = derivePlanSteps(contract({ requiredFiles: ["platform-drafts>=3"] }));
    expect(steps[0]!.target).toBe("platform-drafts");
  });

  it("adds per-kind count steps from kindCounts", () => {
    const steps = derivePlanSteps(contract({
      expectedKinds: ["html", "video"],
      kindCounts: [{ kind: "html", min: 8 }],
    }));
    const htmlStep = steps.find((step) => step.target === "html");
    expect(htmlStep).toMatchObject({ kind: "count", min: 8 });
    // video has no count -> presence step
    expect(steps.find((step) => step.target === "video")).toMatchObject({ kind: "presence" });
  });

  it("binds a single global minCount to the primary page-unit kind", () => {
    const steps = derivePlanSteps(contract({ expectedKinds: ["html"], minCount: 6 }));
    expect(steps[0]).toMatchObject({ kind: "count", target: "html", min: 6 });
  });
});

describe("evaluatePlanProgress", () => {
  it("marks file steps done by basename containment across nested paths", () => {
    const steps = derivePlanSteps(contract({ requiredFiles: ["slide-manifest.json", "bible.md"] }));
    const snap = evaluatePlanProgress(steps, ["artifacts/slides-x/slide-manifest.json"]);
    expect(snap.done).toBe(1);
    expect(snap.total).toBe(2);
    expect(snap.nextStep?.target).toBe("bible.md");
    expect(snap.complete).toBe(false);
  });

  it("marks count steps done only when enough files of the kind are verified", () => {
    const steps = derivePlanSteps(contract({ expectedKinds: ["html"], kindCounts: [{ kind: "html", min: 3 }] }));
    expect(evaluatePlanProgress(steps, ["a.html", "b.html"]).done).toBe(0);
    expect(evaluatePlanProgress(steps, ["a.html", "b.html", "c.html"]).done).toBe(1);
  });

  it("reports complete when every step is satisfied", () => {
    const snap = buildPlanLedger(
      contract({ requiredFiles: ["report.md"], expectedKinds: ["markdown"] }),
      ["out/report.md"],
    );
    expect(snap.complete).toBe(true);
    expect(snap.remaining).toHaveLength(0);
  });

  it("returns total 0 for a contract with no derivable steps", () => {
    const snap = buildPlanLedger(contract({}), []);
    expect(snap.total).toBe(0);
    expect(snap.complete).toBe(false);
  });
});

describe("formatPlanLedgerHint", () => {
  it("returns undefined when there are no steps", () => {
    expect(formatPlanLedgerHint(buildPlanLedger(contract({}), []))).toBeUndefined();
  });

  it("includes progress and the next step label", () => {
    const hint = formatPlanLedgerHint(buildPlanLedger(
      contract({ requiredFiles: ["a.md", "b.md", "c.md"] }),
      ["a.md"],
    ));
    expect(hint).toContain("计划进度 1/3");
    expect(hint).toContain("下一步：产出 b.md");
  });

  it("collapses to a head line when complete", () => {
    const hint = formatPlanLedgerHint(buildPlanLedger(contract({ requiredFiles: ["a.md"] }), ["a.md"]));
    expect(hint).toBe("计划进度 1/1");
  });
});
