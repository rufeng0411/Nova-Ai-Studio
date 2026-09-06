import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CanonicalMessage } from "../../model/index.js";
import { ToolResultBudget } from "./ToolResultBudget.js";

function toolResultMessage(text: string, toolCallId = "call_0"): CanonicalMessage {
  return {
    role: "user",
    content: [{ type: "tool_result", toolCallId, content: [{ type: "text", text }] }],
  };
}

describe("ToolResultBudget", () => {
  let dir = "";

  afterEach(async () => {
    dir = "";
  });

  it("does not reuse spill preview across turns with the same toolCallId (ES9 RCA)", async () => {
    dir = await mkdtemp(join(tmpdir(), "tool-result-budget-"));
    const budget = new ToolResultBudget({ toolResultsDir: dir, maxResultSizeChars: 100 });

    const skillBody = `# PPT Master Skill\n${"x".repeat(500)}`;
    const reportBody = `# 蔚来ES9技术调研报告\n${"y".repeat(500)}`;

    const turnA = await budget.applyToMessage(toolResultMessage(skillBody, "call_0"), {
      turnId: "turn-a",
    });
    const turnB = await budget.applyToMessage(toolResultMessage(reportBody, "call_0"), {
      turnId: "turn-b",
    });

    const blockA = turnA.content[0];
    const blockB = turnB.content[0];
    expect(blockA?.type).toBe("tool_result_reference");
    expect(blockB?.type).toBe("tool_result_reference");
    if (blockA?.type !== "tool_result_reference" || blockB?.type !== "tool_result_reference") return;

    expect(blockA.preview).toContain("PPT Master Skill");
    expect(blockB.preview).toContain("蔚来ES9技术调研报告");
    expect(blockA.path).not.toBe(blockB.path);

    const onDiskB = await readFile(blockB.path, "utf8");
    expect(onDiskB).toContain("蔚来ES9技术调研报告");
  });
});
