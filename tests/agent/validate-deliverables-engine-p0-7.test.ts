import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  validateEngineDeliverables,
} from "../../src/agent/deliverables/validateDeliverablesEngine.js";
import type { CanonicalMessage } from "../../src/model/index.js";
import type {
  SessionGoalQualityContract,
} from "../../src/saas/constraints/goalQualityContract.js";
import type {
  SessionDeliverableManifest,
} from "../../src/saas/taskState/sessionDeliverableManifest.js";

const TASK_DIR = "artifacts/task-p0-7";
const REPORT_PATH = `${TASK_DIR}/report.md`;

function manifest(): SessionDeliverableManifest {
  return {
    manifestVersion: 1,
    goalVersion: 1,
    sessionGoalAnchor: `请完成报告并写入 ${REPORT_PATH}`,
    taskArtifactDir: TASK_DIR,
    baselineLocked: true,
    slots: [{
      id: "report",
      label: "报告",
      kind: "markdown",
      required: true,
      pathHint: REPORT_PATH,
      status: "active",
    }],
  };
}

function qualityContract(): SessionGoalQualityContract {
  return {
    contractVersion: 1,
    subjectAnchor: "鸣镝 G700",
    subjectAliases: ["鸣镝G700"],
    exactQuantityAssertions: [{ unit: "section", exact: 2 }],
    officialMediaPolicy: "none",
    allowedSourceTiers: [],
    allowPlaceholders: true,
    forbidGenerateImage: false,
  };
}

function messages(): CanonicalMessage[] {
  return [
    {
      role: "user",
      content: [{ type: "text", text: `请完成报告并写入 ${REPORT_PATH}` }],
    },
    {
      role: "assistant",
      content: [{ type: "text", text: `报告已完成：${REPORT_PATH}` }],
    },
  ];
}

describe("validateDeliverablesEngine P0-7 quality draft", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "pilotdeck-p0-7-engine-"));
    await mkdir(join(cwd, "artifacts", "task-p0-7"), { recursive: true });
    await writeFile(
      join(cwd, ...REPORT_PATH.split("/")),
      [
        "# 无关产品概览",
        "这是一份包含完整背景、用户洞察、目标和证据说明的正式报告正文。",
        "## 数据结论",
        "这里继续提供足够长的分析、判断依据、行动建议和验收说明。",
      ].join("\n\n"),
      "utf8",
    );
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    process.env.PILOTDECK_DELIVERABLE_CERTIFICATE_V2 = "shadow";
    process.env.PILOTDECK_CONTRACT_AUTHORITY_V2 = "shadow";
    process.env.PILOTDECK_OFFICIAL_MEDIA_V2 = "off";
  });

  afterEach(async () => {
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
    delete process.env.PILOTDECK_DELIVERABLE_CERTIFICATE_V2;
    delete process.env.PILOTDECK_CONTRACT_AUTHORITY_V2;
    delete process.env.PILOTDECK_OFFICIAL_MEDIA_V2;
    delete process.env.PILOTDECK_CONTENT_QUALITY_V2;
    await rm(cwd, { recursive: true, force: true });
  });

  it("applies quality after structural ground truth and returns no certificate", async () => {
    process.env.PILOTDECK_CONTENT_QUALITY_V2 = "enforce";

    const result = await validateEngineDeliverables({
      cwd,
      messages: messages(),
      userGoal: manifest().sessionGoalAnchor,
      sessionManifest: manifest(),
      qualityContract: qualityContract(),
    });

    expect(result).not.toBeNull();
    expect(result?.verified).toContain(REPORT_PATH);
    expect(result?.qualityCompletion).toBe("needs_repair");
    expect(result?.enforcedQualityCompletion).toBe("needs_repair");
    expect(result?.acceptance).toBe("needs_repair");
    expect(result?.qualityFailures).toContainEqual(
      expect.objectContaining({ checkId: "content.subject_anchor" }),
    );
    expect(result).not.toHaveProperty("acceptanceCertificate");
  });

  it("records the same quality defect in shadow without vetoing acceptance", async () => {
    process.env.PILOTDECK_CONTENT_QUALITY_V2 = "shadow";

    const result = await validateEngineDeliverables({
      cwd,
      messages: messages(),
      userGoal: manifest().sessionGoalAnchor,
      sessionManifest: manifest(),
      qualityContract: qualityContract(),
    });

    expect(result?.acceptance).toBe("passed");
    expect(result?.qualityCompletion).toBe("needs_repair");
    expect(result?.enforcedQualityCompletion).toBe("not_applicable");
    expect(result).not.toHaveProperty("acceptanceCertificate");
  });
});
