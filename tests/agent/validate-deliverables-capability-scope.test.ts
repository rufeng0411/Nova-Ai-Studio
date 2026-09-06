import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateEngineDeliverables } from "../../src/agent/deliverables/validateDeliverablesEngine.js";

describe("deliverable validation capability completion mode", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("does not create false incomplete results for strategy consultation", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "pd-capability-consultation-"));
    tempDirs.push(cwd);

    const result = await validateEngineDeliverables({
      cwd,
      messages: [{
        role: "assistant",
        content: [{ type: "text", text: "下面是三条战略建议。" }],
      }],
      userGoal: "请生成战略报告",
      capabilitySlug: "ala-strategy-advisor",
      completionMode: "consultation",
    } as Parameters<typeof validateEngineDeliverables>[0] & {
      completionMode: "consultation";
    });

    expect(result).toBeNull();
  });
});
