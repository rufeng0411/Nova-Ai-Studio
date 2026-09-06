import { describe, expect, it } from "vitest";

import type { CanonicalMessage } from "../../model/index.js";
import { extractLatestNonSyntheticUserText } from "./AgentLoop.js";
import { extractDeliverableSessionUserGoal } from "../../saas/deliverableSessionGoal.js";

function user(text: string, metadata?: CanonicalMessage["metadata"]): CanonicalMessage {
  return {
    role: "user",
    content: [{ type: "text", text }],
    metadata,
  };
}

describe("AgentLoop goal extraction", () => {
  it("ignores persisted acceptance repair prompts even when metadata is missing", () => {
    const originalGoal = "帮我把上述报告做成动态可视化HTML";
    const repairPrompt = [
      "最终交付验收未通过。不要询问用户，不要重做已通过的部分，请直接按缺口继续补齐或修复。",
      "原始用户目标：帮我把上述报告做成动态可视化HTML",
      "已通过验收的成果：",
      "artifacts/rog-intelligence-20260623/index.html",
      "缺失成果：",
      "*.docx",
      "下一步要求：",
      "请基于本轮已有成果继续制作，不要重复已通过验收的文件。",
    ].join("\n");

    expect(extractLatestNonSyntheticUserText([
      user(originalGoal),
      user(repairPrompt),
    ])).toBe(originalGoal);
  });

  it("keeps original deliverable goal when user sends task-not-done follow-up", () => {
    const originalGoal = [
      "帮我把【ROG大油条】做成国内社媒矩阵，一次做完并存 artifacts/social-matrix/",
      "写 brief 与创意锚点；四套比例配图；多平台文案；存小红书草稿。直接开始做，做完告诉我目录和草稿编号。",
    ].join("\n");
    expect(extractDeliverableSessionUserGoal([
      user(originalGoal),
      user("任务没有完成啊，什么意思啊？"),
    ])).toBe(originalGoal);
    expect(extractLatestNonSyntheticUserText([
      user(originalGoal),
      user("？？"),
    ])).toBe(originalGoal);
  });
});
