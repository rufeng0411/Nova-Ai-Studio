import { describe, expect, it } from "vitest";
import { resolveToolRecoveryProfile, toToolRecoveryOptions } from "./resolveToolRecoveryProfile.js";

describe("resolveToolRecoveryProfile", () => {
  it("uses geo audit recovery for mkt-ai-seo instead of research-report", () => {
    const profile = resolveToolRecoveryProfile({
      slug: "mkt-ai-seo",
      userGoal: "世界杯决赛 AI 搜索审计",
    });
    expect(profile.geoAudit).toBe(true);
    expect(profile.researchReport).toBe(false);
    expect(toToolRecoveryOptions(profile)).toEqual({ geoAudit: true });
  });

  it("keeps research recovery for nova-research slugs", () => {
    const profile = resolveToolRecoveryProfile({
      slug: "nova-research-market",
      userGoal: "行业调研报告",
    });
    expect(profile.researchReport).toBe(true);
    expect(profile.geoAudit).toBe(false);
  });
});
