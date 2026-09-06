import { describe, expect, it } from "vitest";

import {
  assessOfficialSearchQueryShadow,
  assessSubjectGroundingShadow,
  buildOfficialMediaSearchQuery,
  extractCanonicalSubject,
  validateSearchQueryIncludesSubject,
} from "./subjectGroundingPolicy.js";

describe("subjectGroundingPolicy", () => {
  it("extracts canonical subject from explicit block and brand model", () => {
    const explicit = extractCanonicalSubject({
      userGoal: "【完整主体】鸣镝 G700 智能手表",
    });
    expect(explicit?.subject).toContain("鸣镝");
    expect(explicit?.source).toBe("explicit_block");

    const brand = extractCanonicalSubject({
      userGoal: "为鸣镝 G700 做官网配图",
    });
    expect(brand?.subject).toMatch(/G700/i);
    expect(brand?.aliases.length).toBeGreaterThan(0);
  });

  it("requires full subject in official media search queries", () => {
    const subject = extractCanonicalSubject({
      userGoal: "【完整主体】鸣镝 G700",
    })!;
    expect(validateSearchQueryIncludesSubject("G700 官方图", subject)).toBe(false);
    expect(
      validateSearchQueryIncludesSubject(
        buildOfficialMediaSearchQuery(subject, "官方产品图"),
        subject,
      ),
    ).toBe(true);
  });

  it("records shadow diffs for bare model queries and missing subject", () => {
    const subject = extractCanonicalSubject({
      userGoal: "鸣镝 G700 官网",
    })!;
    expect(assessOfficialSearchQueryShadow({
      query: "G700 hero",
      subject,
    }).reason).toBe("bare_model_query");
    expect(assessSubjectGroundingShadow({
      text: "竞品智能手表市场概览",
      subject,
    }).ok).toBe(false);
  });
});
