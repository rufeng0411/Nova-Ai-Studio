import { describe, expect, it } from "vitest";
import {
  extractDeliverableSessionUserGoal,
  isAmbiguousFollowUpText,
} from "../../src/saas/deliverableSessionGoal.js";

describe("deliverableSessionGoal", () => {
  it("ignores question-mark follow-ups and keeps ROG social matrix goal", () => {
    const originalGoal = [
      "帮我把【ROG大油条】做成国内社媒矩阵，一次做完并存 artifacts/social-matrix/",
      "写 brief 与创意锚点；四套比例配图；多平台文案；存小红书草稿。直接开始做。",
    ].join("\n");
    const messages = [
      { role: "user", content: [{ type: "text", text: originalGoal }] },
      { role: "user", content: [{ type: "text", text: "任务没有完成啊，什么意思啊？" }] },
      { role: "user", content: [{ type: "text", text: "？？" }] },
    ];
    expect(extractDeliverableSessionUserGoal(messages)).toBe(originalGoal);
  });

  it("detects ambiguous follow-up punctuation", () => {
    expect(isAmbiguousFollowUpText("？？")).toBe(true);
    expect(isAmbiguousFollowUpText("???")).toBe(true);
    expect(isAmbiguousFollowUpText("帮我把【ROG大油条】做成国内社媒矩阵")).toBe(false);
  });
});
