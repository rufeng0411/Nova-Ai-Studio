import { describe, expect, it } from "vitest";
import { buildTaskGoalContract } from "./taskGoalContract.js";
import { detectGoalPivot } from "./detectGoalPivot.js";

describe("detectGoalPivot", () => {
  it("returns pivot=true when follow-up introduces pptx after markdown analysis", () => {
    const previous = buildTaskGoalContract({
      userGoal: "帮我做一份南美旅游深度分析报告，输出 markdown。",
    });
    const result = detectGoalPivot({
      previousContract: previous,
      newUserText: "基于上面的分析，做 8 页 16:9 官方图 PPTX 演示文稿，直接开始。",
    });
    expect(result.pivot).toBe(true);
    expect(result.nextContract?.expectedKinds).toContain("pptx");
    expect(result.nextContract?.goalVersion).toBeGreaterThan(previous.goalVersion);
  });

  it("returns pivot=false for pure continuation text", () => {
    const previous = buildTaskGoalContract({
      userGoal: "做 8 页 PPTX 演示文稿。",
    });
    const result = detectGoalPivot({
      previousContract: previous,
      newUserText: "继续",
    });
    expect(result.pivot).toBe(false);
    expect(result.reason).toBe("continuation_only");
  });

  it("returns pivot=false when no previous contract exists", () => {
    const result = detectGoalPivot({
      newUserText: "做 8 页 PPTX。",
    });
    expect(result.pivot).toBe(false);
  });
});
