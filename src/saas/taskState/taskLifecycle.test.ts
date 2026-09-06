import { describe, expect, it } from "vitest";

import {
  chooseRecoveryOwner,
  classifyElicitationKind,
  resolveTaskLifecycleStatus,
  taskLifecycleStatusLabels,
  type TaskLifecycleInput,
} from "./taskLifecycle.js";

describe("taskLifecycle contract", () => {
  it("classifies preference elicitation separately from required user action", () => {
    expect(classifyElicitationKind({
      question: "请选择本次活动的视觉风格",
      options: ["清凉国风（推荐）", "现代极简", "京味复古", "按默认方案继续"],
      hasDefaultOption: true,
    })).toBe("preference");

    expect(classifyElicitationKind({
      question: "请上传源文件或配置 API Key 后继续",
      requiredReason: "missing_attachment",
    })).toBe("required");
  });

  it("prioritizes recovery owners without allowing UI duplicate resumes", () => {
    expect(chooseRecoveryOwner(["stale_turn", "engine_auto_continue"])).toBe("engine_auto_continue");
    expect(chooseRecoveryOwner(["engine_auto_continue", "deliverable_repair"])).toBe("deliverable_repair");
    expect(chooseRecoveryOwner(["deliverable_repair", "infra_interrupt"])).toBe("infra_interrupt");
    expect(chooseRecoveryOwner(["ui_incomplete_deliverable", "stale_turn"])).toBe("ui_incomplete_deliverable");
  });

  it("resolves lifecycle status from blocker, validation, and turn outcome evidence", () => {
    const base: TaskLifecycleInput = {
      userGoal: "输出 Word(.docx)，产出存 artifacts/ 报路径",
      assistantText: "开始执行，先整理资料",
      completion: { verified: [], missing: [], broken: [] },
    };

    expect(resolveTaskLifecycleStatus({
      ...base,
      blocker: { kind: "required", reason: "missing_key" },
    }).status).toBe("user_action_required");

    expect(resolveTaskLifecycleStatus({
      ...base,
      elicitation: { kind: "preference", hasDefaultOption: true },
    }).status).toBe("preference_elicitation");

    expect(resolveTaskLifecycleStatus({
      ...base,
      completion: { verified: [], missing: ["artifacts/brief.docx"], broken: [] },
    }).status).toBe("repairable");

    expect(resolveTaskLifecycleStatus({
      ...base,
      completion: { verified: ["artifacts/brief.docx"], missing: [], broken: [] },
    }).status).toBe("done");

    expect(resolveTaskLifecycleStatus({
      ...base,
      turnOutcome: { aborted: true, userAborted: false },
    }).status).toBe("repairable");
  });

  it("exports stable labels for UI and telemetry", () => {
    expect(taskLifecycleStatusLabels.preference_elicitation.zh).toBe("定制任务偏好");
    expect(taskLifecycleStatusLabels.user_action_required.zh).toBe("需要您处理");
    expect(Object.keys(taskLifecycleStatusLabels)).toContain("failed_unrecoverable");
  });
});
