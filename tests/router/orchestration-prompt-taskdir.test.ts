import { describe, expect, it } from "vitest";
import { DEFAULT_ORCHESTRATION_PROMPT } from "../../src/router/config/schema.js";

describe("orchestration prompt task dir (P0-B)", () => {
  it("does not reference tmp_workspace", () => {
    expect(DEFAULT_ORCHESTRATION_PROMPT).not.toMatch(/tmp_workspace/i);
    expect(DEFAULT_ORCHESTRATION_PROMPT).toMatch(/task-artifact-dir/i);
  });
});
