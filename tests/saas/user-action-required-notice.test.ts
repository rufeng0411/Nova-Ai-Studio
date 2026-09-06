import { describe, expect, it } from "vitest";
import { buildUserActionRequiredNotice } from "../../src/saas/taskContinuationPolicy.js";

describe("userActionRequiredNotice", () => {
  it("missing key notice has 3 steps", () => {
    const n = buildUserActionRequiredNotice({
      blocker: {
        type: "missing_key",
        fingerprint: "missing_key:mineru",
        serviceId: "mineru",
        alternateHints: [],
        unambiguous: false,
      },
      confirmedAttempts: 3,
      locale: "zh-CN",
    });
    expect(n.steps.length).toBeGreaterThanOrEqual(3);
    expect(n.reason).toMatch(/3/);
    expect(n.reason).toMatch(/OCR|MinerU/);
    expect(n.steps[0]).toMatch(/文档 OCR/);
  });

  it("mineru notice differs from generic export notice", () => {
    const exportNotice = buildUserActionRequiredNotice({
      blocker: {
        type: "missing_key",
        fingerprint: "missing_key:export",
        serviceId: "export",
        alternateHints: [],
        unambiguous: false,
      },
      confirmedAttempts: 3,
      locale: "zh-CN",
    });
    expect(exportNotice.steps[0]).toMatch(/文档导出/);
    expect(exportNotice.reason).not.toMatch(/OCR/);
  });
});
