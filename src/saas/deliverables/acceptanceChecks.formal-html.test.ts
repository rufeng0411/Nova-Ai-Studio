import { afterEach, describe, expect, it } from "vitest";
import { evaluateCandidate } from "./acceptanceChecks.js";

describe("acceptanceChecks formal HTML shadow", () => {
  afterEach(() => {
    delete process.env.PILOTDECK_HTML_FORMAL_ACCEPTANCE;
  });

  it("does not veto informal HTML in shadow", () => {
    process.env.PILOTDECK_HTML_FORMAL_ACCEPTANCE = "shadow";
    const failures = evaluateCandidate({
      path: "artifacts/task-x/report.html",
      exists: true,
      sizeBytes: 80,
      kind: "html",
      textPreview: "<p>hello</p>",
    });
    expect(failures.some((item) => item.reason === "invalid_html")).toBe(false);
  });

  it("still fails empty files", () => {
    const failures = evaluateCandidate({
      path: "artifacts/task-x/empty.pptx",
      exists: true,
      sizeBytes: 0,
      kind: "pptx",
      binaryHeader: Buffer.from("not-pk"),
    });
    expect(failures.some((item) => item.reason === "broken")).toBe(true);
  });

  it("still fails pptx without PK header", () => {
    const failures = evaluateCandidate({
      path: "artifacts/task-x/shell.pptx",
      exists: true,
      sizeBytes: 64,
      kind: "pptx",
      binaryHeader: "not-a-zip-header!!!!",
    });
    expect(failures.some((item) => item.reason === "broken")).toBe(true);
  });
});
