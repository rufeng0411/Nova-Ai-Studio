import { describe, expect, it } from "vitest";

import {
  buildDeliverableLedgerFromEntries,
  buildLedgerBackedTurnMetaMap,
  mergeDeliverableLedgerRecords,
  type TaskDeliverableLedgerRecord,
} from "./taskDeliverableLedger.js";

const baseRecord: TaskDeliverableLedgerRecord = {
  taskId: "task-1",
  sessionId: "web-s_ledger",
  turnId: "turn-1",
  tenantId: "default",
  workspaceRoot: "F:/Ai-pilotdeck/.saas-dev-data/tenants/default/cloud-storage/users/1/workspaces/w1",
  goalVersion: 1,
  apiPath: "artifacts/campaign/demo/index.html",
  resolvedPath: "artifacts/campaign/demo/index.html",
  hintDir: "artifacts/campaign/demo",
  turnArtifactDir: "artifacts/campaign/demo",
  basename: "index.html",
  previewKind: "html",
  sizeBytes: 128,
  source: "tool",
  validationStatus: "verified",
  displayRole: "primary",
  acceptanceRole: "required",
  resolvedBy: "exact",
};

describe("taskDeliverableLedger", () => {
  it("dedupes by turn and resolved path while preserving the strongest record", () => {
    const records = mergeDeliverableLedgerRecords([
      { ...baseRecord, validationStatus: "missing", source: "manual_reference" },
      { ...baseRecord, validationStatus: "softVerified", source: "legacyMeta", sizeBytes: 0 },
      baseRecord,
    ]);

    expect(records).toHaveLength(1);
    expect(records[0]?.validationStatus).toBe("verified");
    expect(records[0]?.source).toBe("tool");
    expect(records[0]?.sizeBytes).toBe(128);
  });

  it("projects ledger records into turn meta using resolved paths", () => {
    const meta = buildLedgerBackedTurnMetaMap([
      baseRecord,
      {
        ...baseRecord,
        apiPath: "brief.docx",
        resolvedPath: "artifacts/campaign/demo/brief.docx",
        basename: "brief.docx",
        previewKind: "docx",
      },
    ]);

    expect(meta.get("turn-1")).toEqual({
      turnArtifactDir: "artifacts/campaign/demo",
      verifiedPaths: [
        "artifacts/campaign/demo/index.html",
        "artifacts/campaign/demo/brief.docx",
      ],
      alignmentStatus: "aligned",
    });
  });

  it("falls back to legacy turn_deliverable_meta when no ledger rows exist", () => {
    const meta = buildLedgerBackedTurnMetaMap([], [
      {
        type: "turn_deliverable_meta",
        turnId: "turn-legacy",
        turnArtifactDir: "artifacts/campaign/legacy",
        verifiedPaths: ["artifacts/campaign/legacy/index.html"],
        alignmentStatus: "aligned",
      },
    ]);

    expect(meta.get("turn-legacy")?.verifiedPaths).toEqual([
      "artifacts/campaign/legacy/index.html",
    ]);
  });

  it("parses append-only ledger rows from transcript entries", () => {
    const records = buildDeliverableLedgerFromEntries([
      {
        type: "task_deliverable_ledger",
        sessionId: "web-s_ledger",
        turnId: "turn-1",
        sequence: 1,
        createdAt: "2026-06-23T00:00:00.000Z",
        record: baseRecord,
      },
    ]);

    expect(records).toEqual([baseRecord]);
  });
});
