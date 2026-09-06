import { describe, expect, it } from "vitest";
import {
  deliverableBasenamesMatch,
  normalizeDeliverableBasenameCore,
  stripNumericPrefixBasename,
} from "./normalizeDeliverableBasename.js";

describe("normalizeDeliverableBasename", () => {
  it("strips numeric prefix from Agent numbered basenames", () => {
    expect(stripNumericPrefixBasename("01-aeo-audit-checklist.md")).toBe("aeo-audit-checklist.md");
  });

  it("core token matches geo alias variants (Pro click C5)", () => {
    expect(deliverableBasenamesMatch(
      "01-aeo-audit-checklist.md",
      "geo-aeo-audit-checklist.md",
      { tier0Profile: true },
    )).toBe(true);
    expect(deliverableBasenamesMatch(
      "01-aeo-audit-checklist.md",
      "audit-checklist.md",
      { tier0Profile: true },
    )).toBe(true);
    expect(deliverableBasenamesMatch(
      "research-brief.md",
      "brief.md",
      { tier0Profile: true },
    )).toBe(true);
  });

  it("does not fuzzy-match unrelated basenames without tier0", () => {
    expect(deliverableBasenamesMatch("battlecard.md", "talk-track.md")).toBe(false);
  });
});
