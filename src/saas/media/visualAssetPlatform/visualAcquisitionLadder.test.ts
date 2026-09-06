import { describe, expect, it } from "vitest";
import {
  ACQUISITION_TIER_ORDER,
  buildAcquisitionFailureMessage,
  isAcquisitionLadderExhausted,
  recordAcquisitionAttempt,
  type AcquisitionAttempt,
} from "./visualAcquisitionLadder.js";

describe("visualAcquisitionLadder", () => {
  it("is not exhausted until all tiers attempted with zero assets", () => {
    const attempts: AcquisitionAttempt[] = [];
    recordAcquisitionAttempt(attempts, {
      tier: "official_direct",
      method: "fetch",
      target: "https://example.com",
      ok: false,
    });
    expect(isAcquisitionLadderExhausted(attempts, 0, 1)).toBe(false);
  });

  it("is exhausted when every tier was tried and still no assets", () => {
    const attempts: AcquisitionAttempt[] = [];
    for (const tier of ACQUISITION_TIER_ORDER) {
      recordAcquisitionAttempt(attempts, {
        tier,
        method: "mock",
        target: tier,
        ok: false,
      });
    }
    expect(isAcquisitionLadderExhausted(attempts, 0, 1)).toBe(true);
    expect(buildAcquisitionFailureMessage(attempts, "zh-CN")).toMatch(
      /已按安全策略依次尝试多种配图渠道/,
    );
  });

  it("is not exhausted when min assets satisfied", () => {
    const attempts: AcquisitionAttempt[] = [];
    expect(isAcquisitionLadderExhausted(attempts, 2, 1)).toBe(false);
  });
});
