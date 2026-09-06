import { describe, expect, it, beforeEach } from "vitest";

import { ES9_FOUR_FORMAT_VAP_GOAL } from "../../../tests/fixtures/es9-four-format-vap-case.js";
import {
  applyParallelGroupHints,
  compileSessionDeliverableManifest,
  type SessionDeliverableManifest,
} from "./sessionDeliverableManifest.js";
import { matchPathToSequentialGate } from "./sequentialDeliverableGate.js";

describe("sequentialDeliverableGate", () => {
  beforeEach(() => {
    process.env.PILOTDECK_SEQUENTIAL_DELIVERABLES = "1";
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    process.env.PILOTDECK_SDM_PARSE_MUST_DELIVER = "1";
    process.env.PILOTDECK_CHECKLIST_AUTHORITY_TEMPLATES = "1";
    process.env.PILOTDECK_SDM_HTML_REPORT_ALIAS = "1";
    process.env.PILOTDECK_PARALLEL_OFFICE_EXPORT = "enforce";
  });

  it("tags ES9 four-format manifest with office-export parallelGroup", () => {
    const manifest = compileSessionDeliverableManifest({
      userGoal: ES9_FOUR_FORMAT_VAP_GOAL,
      turnId: "t1",
    });
    expect(manifest).toBeTruthy();
    const exportSlots = manifest!.slots.filter((s) => s.parallelGroup === "office-export");
    expect(exportSlots.length).toBeGreaterThanOrEqual(2);
    for (const slot of exportSlots) {
      expect(slot.stageId).toBe("stage_office_export");
      expect(slot.sourcePathHint).toBeTruthy();
    }
  });

  it("allows parallel office export when source md verified", () => {
    const base: SessionDeliverableManifest = applyParallelGroupHints(
      {
        manifestVersion: 1,
        goalVersion: 1,
        sessionGoalAnchor: "es9",
        baselineLocked: true,
        currentStageId: "stage_office_export",
        slots: [
          {
            id: "md",
            label: "report.md",
            kind: "markdown",
            pathHint: "report.md",
            required: true,
            stageId: "stage_report",
            status: "done",
          },
          {
            id: "pdf",
            label: "PDF",
            kind: "pdf",
            pathHint: "report.pdf",
            required: true,
            stageId: "stage_office_export",
            parallelGroup: "office-export",
            sourcePathHint: "report.md",
            status: "active",
          },
          {
            id: "docx",
            label: "Word",
            kind: "docx",
            pathHint: "report.docx",
            required: true,
            stageId: "stage_office_export",
            parallelGroup: "office-export",
            sourcePathHint: "report.md",
            status: "active",
          },
        ],
      },
      ES9_FOUR_FORMAT_VAP_GOAL,
    );

    const pdfGate = matchPathToSequentialGate(
      "artifacts/task-demo/report.pdf",
      base,
      { toolName: "export_document", verifiedPaths: ["artifacts/task-demo/report.md"] },
    );
    expect(pdfGate.allowed).toBe(true);
    expect(pdfGate.parallelGroup).toBe("office-export");
  });

  it("tags one-article-matrix platform drafts with matrix-platform-drafts parallelGroup", () => {
    const goal =
      "写一篇【黑袍纠察队】深度长文，再 humanize 成五平台口吻，写入系统分配任务目录，直接开始做";
    const manifest = compileSessionDeliverableManifest({
      userGoal: goal,
      capabilitySlug: "humanizer",
      turnId: "t-matrix",
    });
    expect(manifest).toBeTruthy();
    const hinted = applyParallelGroupHints(manifest!, goal);
    const platformSlots = hinted.slots.filter((s) => s.parallelGroup === "matrix-platform-drafts");
    expect(platformSlots.length).toBeGreaterThanOrEqual(5);
    const articleSlot = hinted.slots.find((s) => /article\.md/i.test(s.pathHint ?? ""));
    expect(articleSlot?.parallelGroup).toBeUndefined();
  });
});
