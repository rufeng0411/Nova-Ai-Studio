import { describe, expect, it } from "vitest";

import {
  CASE_12FC6055,
  CASE_HTML_DOCX_PDF,
  CASE_PDF_SOURCE_NOTES,
  CASE_TRUE_PPT,
  CASE_WEEKLY_PPT,
  gateOfficeKindsByImperative,
  hasImperativeOfficeFormat,
  sanitizeGoalForKindInference,
} from "./goalKindSanitize.js";

describe("goalKindSanitize", () => {
  it("CASE_12FC6055 strips locators and absence; no leftover PDF/PPT as kinds", () => {
    const sanitized = sanitizeGoalForKindInference(CASE_12FC6055);
    expect(sanitized).toMatch(/知乎/);
    expect(sanitized).toMatch(/选题/);
    expect(sanitized).toMatch(/檽糯映画/);
    expect(sanitized).not.toMatch(/PDF 中的/i);
    expect(sanitized).not.toMatch(/在 PPT 里没有展示/);
    expect(hasImperativeOfficeFormat(sanitized, "pdf")).toBe(false);
    expect(hasImperativeOfficeFormat(sanitized, "pptx")).toBe(false);
    expect(gateOfficeKindsByImperative(["pdf", "pptx"], sanitized)).toEqual([]);
  });

  it("does not treat a source PDF mention as a required pdf kind", () => {
    const sanitized = sanitizeGoalForKindInference(CASE_PDF_SOURCE_NOTES);
    expect(sanitized).toMatch(/PDF/);
    expect(hasImperativeOfficeFormat(sanitized, "pdf")).toBe(false);
    expect(gateOfficeKindsByImperative(["pdf"], sanitized)).toEqual([]);
  });

  it("keeps true PPT / weekly pptx / html+docx+pdf imperatives", () => {
    expect(hasImperativeOfficeFormat(CASE_TRUE_PPT, "pptx")).toBe(true);
    expect(hasImperativeOfficeFormat(CASE_WEEKLY_PPT, "pptx")).toBe(true);
    const dual = sanitizeGoalForKindInference(CASE_HTML_DOCX_PDF);
    expect(hasImperativeOfficeFormat(dual, "docx")).toBe(true);
    expect(hasImperativeOfficeFormat(dual, "pdf")).toBe(true);
    expect(gateOfficeKindsByImperative(["html", "docx", "pdf"], dual)).toEqual([
      "html",
      "docx",
      "pdf",
    ]);
  });
});
