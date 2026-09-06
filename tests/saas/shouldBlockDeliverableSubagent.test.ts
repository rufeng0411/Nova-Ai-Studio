import { describe, expect, it, beforeEach } from "vitest";

import {
  deliverableSubagentBlockedMessage,
  isDeliverableSubagentToolName,
  shouldBlockDeliverableSubagent,
} from "../../src/saas/deliverables/shouldBlockDeliverableSubagent.js";
import { FOUR_CASE_NOVAPAGE_FIXTURES } from "../fixtures/four-case-novapage-rca-20260726.js";

describe("shouldBlockDeliverableSubagent", () => {
  beforeEach(() => {
    process.env.PILOTDECK_BLOCK_DELIVERABLE_SUBAGENT = "1";
  });

  it("matches agent/task tool names", () => {
    expect(isDeliverableSubagentToolName("agent")).toBe(true);
    expect(isDeliverableSubagentToolName("Task")).toBe(true);
    expect(isDeliverableSubagentToolName("write_file")).toBe(false);
  });

  it("blocks deliverable four-case goals", () => {
    for (const fixture of FOUR_CASE_NOVAPAGE_FIXTURES) {
      expect(
        shouldBlockDeliverableSubagent({ userGoal: fixture.userGoal }),
        fixture.caseId,
      ).toBe(true);
    }
  });

  it("allows brainstorming major category", () => {
    expect(
      shouldBlockDeliverableSubagent({
        userGoal: "写一篇深度长文 humanize 五平台，写入系统分配任务目录",
        majorCategory: "brainstorming",
      }),
    ).toBe(false);
  });

  it("returns zh-CN block message", () => {
    expect(deliverableSubagentBlockedMessage("zh-CN")).toContain("禁止");
  });
});
