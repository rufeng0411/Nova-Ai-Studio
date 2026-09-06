import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseEngineTruthFromJsonl } from "../../scripts/lib/threeCaseSpeedRcaJsonlKpi.mjs";
import { evaluateThreeCaseGate } from "../../scripts/lib/threeCaseSpeedRcaGate.mjs";
import { THREE_CASE_SPEED_RCA_LIVE_CASES } from "../../scripts/lib/threeCaseSpeedRcaLiveCases.mjs";

describe("threeCaseSpeedRcaJsonlKpi", () => {
  it("parses first write time and footer progress from jsonl rows", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rca-jsonl-"));
    const jsonl = path.join(tmp, "sample.jsonl");
    const t0 = "2026-07-26T12:48:19.054Z";
    const rows = [
      {
        type: "session_deliverable_manifest",
        createdAt: t0,
        manifest: {
          slots: [
            { id: "a", status: "active", pathHint: "article.md" },
            { id: "b", status: "pending", pathHint: "zhihu.md" },
            { id: "c", status: "pending", pathHint: "xiaohongshu.md" },
            { id: "d", status: "pending", pathHint: "wechat.md" },
            { id: "e", status: "pending", pathHint: "douyin.md" },
            { id: "f", status: "pending", pathHint: "bilibili.md" },
            { id: "g", status: "pending", pathHint: "data-sources.md" },
          ],
        },
      },
      {
        type: "assistant_message",
        createdAt: "2026-07-26T12:49:14.740Z",
        message: {
          content: [
            {
              type: "tool_call",
              name: "write_file",
              input: { file_path: "artifacts/task-20260726-x/article.md" },
            },
          ],
        },
      },
      {
        type: "turn_acceptance_meta",
        createdAt: "2026-07-26T12:51:57.370Z",
        finality: "final",
        acceptanceStatus: "passed",
        verifiedPaths: [
          "artifacts/task-20260726-x/article.md",
          "artifacts/task-20260726-x/zhihu.md",
          "artifacts/task-20260726-x/xiaohongshu.md",
          "artifacts/task-20260726-x/wechat.md",
          "artifacts/task-20260726-x/douyin.md",
          "artifacts/task-20260726-x/bilibili.md",
          "artifacts/task-20260726-x/data-sources.md",
        ],
      },
    ];
    fs.writeFileSync(jsonl, rows.map((r) => JSON.stringify(r)).join("\n"));

    const truth = parseEngineTruthFromJsonl(jsonl);
    expect(truth.firstWriteFileMs).toBe(55686);
    expect(truth.footerProgress).toEqual({ done: 7, total: 7 });
    expect(truth.passed).toBe(true);
    expect(truth.writePathCount).toBe(1);

    const gate = evaluateThreeCaseGate(
      "blackcloak-matrix",
      THREE_CASE_SPEED_RCA_LIVE_CASES["blackcloak-matrix"],
      truth,
    );
    expect(gate.pass).toBe(true);
  });
});
