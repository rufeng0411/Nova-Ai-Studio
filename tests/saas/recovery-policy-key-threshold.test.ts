import { describe, expect, it } from "vitest";
import { hardFailThresholdForToolError } from "../../src/saas/resilience/recoveryPolicy.js";

describe("hardFailThresholdForToolError", () => {
  it("uses三确 threshold for missing key messages", () => {
    expect(hardFailThresholdForToolError("MinerU 未配置，请在设置中填写 Token")).toBe(3);
  });

  it("uses 1 for unambiguous auth", () => {
    expect(hardFailThresholdForToolError("401 unauthorized")).toBe(1);
  });
});
