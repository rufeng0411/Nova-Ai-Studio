import { describe, expect, it } from "vitest";

import {
  classifyAutoRecoverySideEffectRisk,
} from "../../src/saas/autoRecoverySideEffectPolicy.js";

describe("autoRecoverySideEffectPolicy", () => {
  it("blocks public publish, delete, and payment side effects", () => {
    expect(classifyAutoRecoverySideEffectRisk({ userGoal: "自动公开发布到小红书" }).requiresUserConfirmation).toBe(true);
    expect(classifyAutoRecoverySideEffectRisk({ userGoal: "删除旧项目和历史记录" }).requiresUserConfirmation).toBe(true);
    expect(classifyAutoRecoverySideEffectRisk({ userGoal: "购买套餐并充值" }).requiresUserConfirmation).toBe(true);
  });

  it("allows non-public draft saves to continue", () => {
    const risk = classifyAutoRecoverySideEffectRisk({
      userGoal: "把内容存到平台草稿，不公开发布",
    });
    expect(risk.requiresUserConfirmation).toBe(false);
  });

  it("GEO: platform cancel user text does not trigger delete confirmation", () => {
    const risk = classifyAutoRecoverySideEffectRisk({
      userGoal: "小红书、知乎、公众号不用做了，增加白皮书",
    });
    expect(risk.requiresUserConfirmation).toBe(false);
  });

  it("GEO: assistant completed-delete narration does not trigger confirmation", () => {
    const risk = classifyAutoRecoverySideEffectRisk({
      userGoal: "继续交付 GEO 报告",
      assistantText: "已按您要求删除平台成稿相关文件。",
    });
    expect(risk.requiresUserConfirmation).toBe(false);
  });

  it("still blocks explicit public publish in user goal", () => {
    const risk = classifyAutoRecoverySideEffectRisk({
      userGoal: "自动公开发布到小红书",
    });
    expect(risk.requiresUserConfirmation).toBe(true);
    expect(risk.kind).toBe("public_publish");
  });
});
