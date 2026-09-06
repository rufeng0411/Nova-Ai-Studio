import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  isDirectDeliverableWriteGoal,
  shouldBypassOrchestrationForCapability,
} from "../../src/router/orchestrate/shouldBypassOrchestration.js";

const BLACKCLOAK_GOAL =
  "写一篇【黑袍纠察队】深度长文，再 humanize 成五平台口吻，写入系统分配任务目录，直接开始做";
const GEO_GOAL = "帮【www.novapage.online】做品牌 GEO 全案，按阶段一次执行";
const SPONGEBOB_GOAL =
  "用「Nova-用户研究」做【海绵宝宝手机】的八段式用户研究：画像、场景、痛点与决策因素。须交付：user-research-report.md。写入系统分配任务目录。";

describe("shouldBypassOrchestration matrix/geo (P0-A)", () => {
  const prev = process.env.PILOTDECK_ORCH_BYPASS_MATRIX_GEO;

  beforeEach(() => {
    process.env.PILOTDECK_ORCH_BYPASS_MATRIX_GEO = "1";
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.PILOTDECK_ORCH_BYPASS_MATRIX_GEO;
    else process.env.PILOTDECK_ORCH_BYPASS_MATRIX_GEO = prev;
  });

  it("bypasses anth-pptx", () => {
    expect(shouldBypassOrchestrationForCapability("anth-pptx")).toBe(true);
  });
  it("bypasses pd-geo slug", () => {
    expect(shouldBypassOrchestrationForCapability("pd-geo")).toBe(true);
  });
  it("bypasses blackcloak matrix goal without slug", () => {
    expect(shouldBypassOrchestrationForCapability(undefined, undefined, BLACKCLOAK_GOAL)).toBe(true);
  });
  it("bypasses GEO full-case goal without slug", () => {
    expect(shouldBypassOrchestrationForCapability(undefined, undefined, GEO_GOAL)).toBe(true);
  });
  it("does not bypass when flag off", () => {
    process.env.PILOTDECK_ORCH_BYPASS_MATRIX_GEO = "0";
    expect(shouldBypassOrchestrationForCapability(undefined, undefined, BLACKCLOAK_GOAL)).toBe(false);
  });
  it("does not bypass brainstorming direct-start without deliverable", () => {
    expect(
      shouldBypassOrchestrationForCapability(
        undefined,
        "brainstorming",
        "humanize 这段文字，直接开始做",
      ),
    ).toBe(false);
  });
  it("does not bypass pure chat humanize without deliverable signal", () => {
    expect(
      shouldBypassOrchestrationForCapability(undefined, undefined, "帮我 humanize 一下这段话"),
    ).toBe(false);
  });
  it("spongebob research goal does not require matrix bypass but may via 须交付", () => {
    expect(shouldBypassOrchestrationForCapability("nova-research-user-general", undefined, SPONGEBOB_GOAL)).toBe(
      true,
    );
  });
});

describe("isDirectDeliverableWriteGoal", () => {
  it("requires deliverable signal and STDA phrase", () => {
    expect(isDirectDeliverableWriteGoal(BLACKCLOAK_GOAL, undefined)).toBe(true);
    expect(isDirectDeliverableWriteGoal("直接开始做", undefined)).toBe(false);
    expect(isDirectDeliverableWriteGoal(BLACKCLOAK_GOAL, "brainstorming")).toBe(false);
  });
});
