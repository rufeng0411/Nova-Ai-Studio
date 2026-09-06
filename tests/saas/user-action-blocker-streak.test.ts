import { describe, expect, it, beforeEach } from "vitest";
import {
  UserActionBlockerStreakTracker,
  USER_ACTION_BLOCKER_CONFIRM_THRESHOLD,
  _clearUserActionBlockerTrackersForTests,
  getUserActionBlockerTracker,
  isUserActionBlockerResetText,
} from "../../src/saas/userActionBlockerStreakTracker.js";

describe("UserActionBlockerStreakTracker", () => {
  beforeEach(() => {
    _clearUserActionBlockerTrackersForTests();
  });

  it("counts consecutive same fingerprint", () => {
    const t = new UserActionBlockerStreakTracker();
    expect(t.record("missing_key:mineru")).toBe(1);
    expect(t.record("missing_key:mineru")).toBe(2);
    expect(t.record("missing_key:mineru")).toBe(3);
    expect(t.isConfirmed()).toBe(true);
  });

  it("resets streak on fingerprint change", () => {
    const t = new UserActionBlockerStreakTracker();
    expect(t.record("missing_key:mineru")).toBe(1);
    expect(t.record("missing_key:mineru")).toBe(2);
    expect(t.record("transient:network")).toBe(1);
    expect(t.isConfirmed()).toBe(false);
  });

  it("accumulates across auto-continue turns when only the turnId changes", () => {
    const t = new UserActionBlockerStreakTracker();
    // Same goal + capability, but a fresh turnId each auto-continue turn. The
    // streak MUST keep climbing so a hard blocker (missing key) reaches the
    // 3-strike fast-stop instead of retrying forever.
    expect(t.recordForContext("missing_key:mineru", {
      userGoal: "生成 PDF 报告",
      capabilitySlug: "document-export",
      turnBoundary: "turn-a",
    })).toBe(1);
    expect(t.recordForContext("missing_key:mineru", {
      userGoal: "生成 PDF 报告",
      capabilitySlug: "document-export",
      turnBoundary: "turn-b",
    })).toBe(2);
    expect(t.recordForContext("missing_key:mineru", {
      userGoal: "生成 PDF 报告",
      capabilitySlug: "document-export",
      turnBoundary: "turn-c",
    })).toBe(3);
    expect(t.isConfirmed()).toBe(true);
  });

  it("resets the streak when the goal or capability changes", () => {
    const t = new UserActionBlockerStreakTracker();
    expect(t.recordForContext("missing_key:mineru", {
      userGoal: "生成 PDF 报告",
      capabilitySlug: "document-export",
      turnBoundary: "turn-a",
    })).toBe(1);
    expect(t.recordForContext("missing_key:mineru", {
      userGoal: "生成 PDF 报告",
      capabilitySlug: "document-export",
      turnBoundary: "turn-b",
    })).toBe(2);
    // Different goal + capability → different context → reset to 1.
    expect(t.recordForContext("missing_key:mineru", {
      userGoal: "帮 ROG 做社媒矩阵",
      capabilitySlug: "social-creative-matrix",
      turnBoundary: "turn-b",
    })).toBe(1);
    expect(t.isConfirmed()).toBe(false);
  });

  it("reset clears streak", () => {
    const t = new UserActionBlockerStreakTracker();
    t.record("missing_key:mineru");
    t.record("missing_key:mineru");
    t.reset("missing_key:mineru");
    expect(t.currentStreak()).toBe(0);
  });

  it("session-scoped tracker", () => {
    const a = getUserActionBlockerTracker("sess-1");
    const b = getUserActionBlockerTracker("sess-2");
    a.record("missing_key:mineru");
    expect(b.currentStreak()).toBe(0);
  });

  it("threshold is 3", () => {
    expect(USER_ACTION_BLOCKER_CONFIRM_THRESHOLD).toBe(3);
  });

  it("detects user replies that should reset blocker streak", () => {
    expect(isUserActionBlockerResetText("已配置，继续")).toBe(true);
    expect(isUserActionBlockerResetText("已上传 继续")).toBe(true);
    expect(isUserActionBlockerResetText("configured, continue")).toBe(true);
    expect(isUserActionBlockerResetText("随便继续")).toBe(false);
  });
});
