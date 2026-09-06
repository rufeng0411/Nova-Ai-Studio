import { describe, expect, it } from "vitest";

import {
  appendResearchSource,
  createEmptyResearchSourceLedger,
  RESEARCH_SOURCE_LEDGER_MAX_ENTRIES,
  summarizeResearchSources,
  validateChapterSourceCitations,
} from "./researchSourceLedger.js";

describe("researchSourceLedger", () => {
  it("dedupes by urlHash and contentHash within bounded ledger", () => {
    let ledger = createEmptyResearchSourceLedger();
    const first = appendResearchSource({
      ledger,
      kind: "web_fetch",
      canonicalUrl: "https://example.com/a?utm=1",
      content: "鸣镝 G700 产品详情页正文内容足够长".repeat(4),
      title: "鸣镝 G700 官方",
      subjectAnchor: "鸣镝 G700",
      accepted: true,
    });
    expect(first.accepted).toBe(true);
    ledger = first.ledger;

    const duplicate = appendResearchSource({
      ledger,
      kind: "web_fetch",
      canonicalUrl: "https://example.com/a",
      content: "鸣镝 G700 产品详情页正文内容足够长".repeat(4),
      title: "鸣镝 G700 官方",
      subjectAnchor: "鸣镝 G700",
      accepted: true,
    });
    expect(duplicate.accepted).toBe(false);
    expect(duplicate.ledger.entries).toHaveLength(1);
  });

  it("caps entries at 32", () => {
    let ledger = createEmptyResearchSourceLedger();
    for (let index = 0; index < RESEARCH_SOURCE_LEDGER_MAX_ENTRIES + 2; index += 1) {
      const result = appendResearchSource({
        ledger,
        kind: "web_fetch",
        canonicalUrl: `https://example.com/page-${index}`,
        content: `鸣镝 G700 正文 ${index} `.repeat(8),
        subjectAnchor: "鸣镝 G700",
        accepted: true,
      });
      ledger = result.ledger;
    }
    expect(ledger.entries.length).toBeLessThanOrEqual(RESEARCH_SOURCE_LEDGER_MAX_ENTRIES);
  });

  it("validates chapter citations against accepted ledger entries", () => {
    let ledger = createEmptyResearchSourceLedger();
    const ids: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const result = appendResearchSource({
        ledger,
        kind: "web_fetch",
        canonicalUrl: `https://brand.example/${index}`,
        content: `鸣镝 G700 调研来源 ${index} `.repeat(6),
        subjectAnchor: "鸣镝 G700",
        accepted: true,
      });
      ledger = result.ledger;
      if (result.entry?.sourceId) ids.push(result.entry.sourceId);
    }
    expect(summarizeResearchSources(ledger).acceptedCount).toBe(3);
    expect(validateChapterSourceCitations({
      ledger,
      sectionCitations: [{ sectionId: "用户画像", sourceIds: ["src_missing"] }],
      minDistinctAccepted: 3,
      minSubjectHits: 2,
    }).some((failure) => failure.reason === "missing_source")).toBe(true);
  });
});
