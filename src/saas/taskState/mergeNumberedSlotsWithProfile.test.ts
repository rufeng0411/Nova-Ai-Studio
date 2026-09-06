import { describe, expect, it } from "vitest";
import {
  mergeNumberedSlotsWithProfile,
  parseOptionalSlotFromLabel,
  shouldBindGeoProfileForGoal,
} from "./mergeNumberedSlotsWithProfile.js";
import { parseNumberedDeliverableList } from "./sessionDeliverableManifest.js";

const GEO_GOAL = [
  "Razer Pro Click GEO，七步：",
  "1. geo-aeo-audit 审计清单",
  "2. 关键词调研",
  "3. 平台成稿",
  "4. 引用优化",
  "5. schema.jsonld",
  "6. citability 评分",
  "7. visibility-report.html 可见度报告",
].join("\n");

describe("mergeNumberedSlotsWithProfile", () => {
  it("geo merge adds pathHints including 01-aeo-audit-checklist.md", () => {
    const slots = parseNumberedDeliverableList(GEO_GOAL);
    const merged = mergeNumberedSlotsWithProfile(slots, "geo", GEO_GOAL);
    const auditHints = merged[0]?.pathHints ?? [];
    expect(auditHints.some((hint) => hint.includes("01-aeo-audit-checklist.md"))).toBe(true);
    expect(auditHints.some((hint) => hint.includes("geo-aeo-audit-checklist.md"))).toBe(true);
  });

  it("optional slot from label prefix", () => {
    const parsed = parseOptionalSlotFromLabel("可选：小红书草稿");
    expect(parsed.required).toBe(false);
    expect(parsed.label).toBe("小红书草稿");
  });

  it("growth 8-step goal must not bind geo profile", () => {
    const goal = "增长全案八步：邮件培育、程序化 SEO、复盘报告";
    expect(shouldBindGeoProfileForGoal(goal, "mkt-growth")).toBe(false);
  });

  it("geo slug still binds geo profile", () => {
    expect(shouldBindGeoProfileForGoal("任意目标", "pd-geo")).toBe(true);
  });

  it("growth full case with read_skill pd-geo in workflow must not bind geo", () => {
    const goal = [
      "帮我为 SaaS 产品做增长全案",
      "5. read_skill pd-geo",
      "标准成果清单：",
      "1. market-research.md",
      "2. positioning-pricing.md",
      "3. landing.html",
      "4. programmatic-seo-template.html",
      "5. geo-keywords.md",
      "6. email-sequence.md",
      "7. ads-plan.md",
      "8. retrospective-template.md",
    ].join("\n");
    expect(shouldBindGeoProfileForGoal(goal, "pd-geo")).toBe(false);
    expect(shouldBindGeoProfileForGoal(goal, "saas-growth-full")).toBe(false);
  });
});
