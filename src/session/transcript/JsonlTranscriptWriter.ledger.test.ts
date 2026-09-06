import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { JsonlTranscriptWriter } from "./JsonlTranscriptWriter.js";
import type { TaskDeliverableLedgerRecord } from "../../saas/taskState/taskDeliverableLedger.js";

describe("JsonlTranscriptWriter deliverable ledger", () => {
  it("appends task_deliverable_ledger rows", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pd-ledger-writer-"));
    const writer = new JsonlTranscriptWriter({
      path: join(dir, "session.jsonl"),
      now: () => new Date("2026-06-23T00:00:00.000Z"),
    });
    const record: TaskDeliverableLedgerRecord = {
      taskId: "task-1",
      sessionId: "web-s_writer",
      turnId: "turn-1",
      apiPath: "index.html",
      resolvedPath: "artifacts/demo/index.html",
      source: "tool",
      validationStatus: "verified",
      displayRole: "primary",
      acceptanceRole: "required",
      resolvedBy: "ledger",
    };

    await writer.recordTaskDeliverableLedger("web-s_writer", "turn-1", record);

    const line = (await readFile(join(dir, "session.jsonl"), "utf8")).trim();
    expect(JSON.parse(line)).toMatchObject({
      type: "task_deliverable_ledger",
      sessionId: "web-s_writer",
      turnId: "turn-1",
      sequence: 1,
      createdAt: "2026-06-23T00:00:00.000Z",
      record,
    });
  });
});
