import { describe, expect, it } from "vitest";
import {
  buildToolRecoveryUserMessage,
  TOOL_RECOVERY_PPT_ZH,
} from "../../src/agent/loop/toolFailureRecovery.js";
import {
  resolveToolRecoveryProfile,
  toToolRecoveryOptions,
} from "../../src/saas/resolveToolRecoveryProfile.js";

describe("tool-recovery-ppt", () => {
  it("anth-pptx slug uses ppt recovery without index.html", () => {
    const profile = resolveToolRecoveryProfile({
      slug: "anth-pptx",
      userGoal: "生成pptx",
    });
    expect(profile.pptDeliverable).toBe(true);
    const msg = buildToolRecoveryUserMessage([], "zh-CN", toToolRecoveryOptions(profile));
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    expect(text).toContain("ocr_to_editable_pptx");
    expect(text).toContain("export_document");
    expect(text).toContain("禁止 read_skill export_document");
    expect(text).not.toMatch(/index\.html/);
    expect(text).not.toMatch(/mobile mockup/i);
  });

  it("default slug uses html-oriented recovery", () => {
    const profile = resolveToolRecoveryProfile({ slug: "random-skill" });
    const msg = buildToolRecoveryUserMessage([], "zh-CN", toToolRecoveryOptions(profile));
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    expect(text).not.toContain(TOOL_RECOVERY_PPT_ZH.slice(0, 20));
  });

  it("userGoal pptx activates ppt profile", () => {
    const profile = resolveToolRecoveryProfile({
      userGoal: "导出可编辑pptx",
    });
    expect(profile.pptDeliverable).toBe(true);
  });

  it("brainstorm escalated with pptx uses ppt recovery", () => {
    const profile = resolveToolRecoveryProfile({
      slug: "persona-foo",
      majorCategory: "brainstorming",
      userGoal: "导出pptx报告",
    });
    expect(profile.brainstormEscalated).toBe(true);
    expect(profile.pptDeliverable).toBe(true);
    const opts = toToolRecoveryOptions(profile);
    expect(opts.pptDeliverable).toBe(true);
    expect(opts.chatFirst).toBeUndefined();
  });
});
