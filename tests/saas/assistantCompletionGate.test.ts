import { describe, expect, it } from "vitest";
import {
  assistantClaimsDeliverableComplete,
  gateAssistantCompletionText,
} from "../../src/saas/deliverables/assistantCompletionGate.js";

describe("assistantCompletionGate", () => {
  it("detects Chinese completion claims", () => {
    expect(assistantClaimsDeliverableComplete("三份均已交付，任务已完成。")).toBe(true);
    expect(assistantClaimsDeliverableComplete("仍在补齐 landing.html")).toBe(false);
  });

  it("shadow mode appends disclaimer when acceptance not passed", () => {
    process.env.PILOTDECK_ASSISTANT_COMPLETION_GATE = "shadow";
    const result = gateAssistantCompletionText(
      { text: "任务已完成。", acceptanceStatus: "needs_repair" },
      "zh-CN",
    );
    expect(result.gated).toBe(true);
    expect(result.text).toContain("系统验收尚未全部通过");
  });

  it("sanitizes internal terms in shadow mode", () => {
    process.env.PILOTDECK_ASSISTANT_COMPLETION_GATE = "shadow";
    const result = gateAssistantCompletionText(
      { text: "acceptanceStatus needs_repair 请继续。", acceptanceStatus: "needs_repair" },
      "zh-CN",
    );
    expect(result.text).toContain("清单仍有项在对齐中");
    expect(result.text).not.toContain("needs_repair");
  });

  it("appends scope footnote for out-of-scope task paths", () => {
    process.env.PILOTDECK_ASSISTANT_COMPLETION_GATE = "shadow";
    const result = gateAssistantCompletionText(
      {
        text: "请查看 artifacts/task-other-id/report.md",
        acceptanceStatus: "needs_repair",
        taskArtifactDir: "artifacts/task-current-id",
      },
      "zh-CN",
    );
    expect(result.text).toContain("本任务目录");
  });

  it("0731: certificateComplete=false gates even when acceptance passed", () => {
    process.env.PILOTDECK_ASSISTANT_COMPLETION_GATE = "enforce";
    const result = gateAssistantCompletionText(
      {
        text: "任务已完成，全部交付物已存在。",
        acceptanceStatus: "passed",
        certificateComplete: false,
      },
      "zh-CN",
    );
    expect(result.gated).toBe(true);
    expect(result.text).toContain("系统验收尚未全部通过");
  });

  it("0731: passed + certificateComplete=true does not gate", () => {
    process.env.PILOTDECK_ASSISTANT_COMPLETION_GATE = "enforce";
    const result = gateAssistantCompletionText(
      {
        text: "任务已完成。",
        acceptanceStatus: "passed",
        certificateComplete: true,
      },
      "zh-CN",
    );
    expect(result.gated).toBe(false);
    expect(result.text).toBe("任务已完成。");
  });

  it("0731-fail-A: completion claim gated when acceptance not passed", () => {
    process.env.PILOTDECK_ASSISTANT_COMPLETION_GATE = "shadow";
    const result = gateAssistantCompletionText(
      {
        text: "任务已完成，全部交付物已存在，PWA 电商站已就绪。",
        acceptanceStatus: "needs_repair",
      },
      "zh-CN",
    );
    expect(result.gated).toBe(true);
    expect(result.text).toContain("系统验收尚未全部通过");
  });
});
