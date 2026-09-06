import { describe, expect, it } from "vitest";
import {
  buildTaskArtifactDirFromKey,
  buildTaskDirKey,
  extractTaskDirKeyFromPath,
  formatTaskDateYyyymmddUtc8,
  isSemanticArtifactDirPath,
  isTaskArtifactDirPath,
  shouldAllocateSessionTaskDirectory,
  turnIdToId8,
} from "./sessionTaskDirectory.js";
import { redirectWritePathToTaskDir } from "./taskPathGuard.js";

describe("sessionTaskDirectory", () => {
  it("turnIdToId8 uses last 8 hex chars", () => {
    expect(turnIdToId8("turn_a1b2c3d4e5f67890")).toBe("e5f67890");
    expect(turnIdToId8("abc")).toBe("00000abc");
  });

  it("buildTaskDirKey uses UTC+8 date", () => {
    const key = buildTaskDirKey("turn_a1b2c3d4", new Date("2026-07-09T18:00:00.000Z"));
    expect(key).toMatch(/^20260710-a1b2c3d4$/);
  });

  it("recognizes STDA paths and rejects semantic dirs", () => {
    const dir = buildTaskArtifactDirFromKey("20260710-a1b2c3d4");
    expect(isTaskArtifactDirPath(dir)).toBe(true);
    expect(isSemanticArtifactDirPath("artifacts/geo/brand")).toBe(true);
    expect(isSemanticArtifactDirPath(dir)).toBe(false);
    expect(extractTaskDirKeyFromPath(dir)).toBe("20260710-a1b2c3d4");
  });

  it("formatTaskDateYyyymmddUtc8 matches calendar day in UTC+8", () => {
    expect(formatTaskDateYyyymmddUtc8(new Date("2026-07-09T16:00:00.000Z"))).toBe("20260710");
  });

  it("Fix-7: 须交付 output.md triggers STDA allocation gate", () => {
    process.env.PILOTDECK_SESSION_TASK_DIRECTORY = "1";
    const lvGoal = [
      "须交付：output.md",
      "写入系统分配任务目录",
      "核查 LV 上海大秀相关事实",
    ].join("，");
    expect(shouldAllocateSessionTaskDirectory(lvGoal)).toBe(true);
    delete process.env.PILOTDECK_SESSION_TASK_DIRECTORY;
  });
});

describe("taskPathGuard", () => {
  const taskRoot = "artifacts/task-20260710-a1b2c3d4";

  it("redirects semantic geo path into task root", () => {
    expect(redirectWritePathToTaskDir("artifacts/geo/brand/keywords.md", taskRoot))
      .toBe(`${taskRoot}/keywords.md`);
  });

  it("keeps paths already under task root", () => {
    expect(redirectWritePathToTaskDir(`${taskRoot}/aeo-audit.md`, taskRoot))
      .toBe(`${taskRoot}/aeo-audit.md`);
  });

  it("allows canvas whitelist", () => {
    expect(redirectWritePathToTaskDir("artifacts/canvas-abc123/board.json", taskRoot))
      .toBe("artifacts/canvas-abc123/board.json");
  });

  it("Fix-7: redirects tmp_workspace paths into task root basename", () => {
    expect(redirectWritePathToTaskDir("tmp_workspace/lv-shanghai-factcheck/output.md", taskRoot))
      .toBe(`${taskRoot}/output.md`);
  });
});
