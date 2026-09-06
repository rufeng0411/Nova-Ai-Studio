import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectImportKind, isOfficeImportKind, maxBytesForKind } from "../../../src/saas/document-import/detectImportKind.js";

describe("detectImportKind", () => {
  it("maps extensions", () => {
    assert.equal(detectImportKind("a.pdf"), "pdf");
    assert.equal(detectImportKind("a.docx"), "docx");
    assert.equal(detectImportKind("a.xlsx"), "xlsx");
    assert.equal(detectImportKind("a.pptx"), "pptx");
    assert.equal(detectImportKind("a.csv"), "csv");
    assert.equal(detectImportKind("a.bin"), "unknown");
  });

  it("office kind helper", () => {
    assert.equal(isOfficeImportKind("docx"), true);
    assert.equal(isOfficeImportKind("pdf"), false);
  });

  it("max bytes per kind", () => {
    const limits = { pdf: 100, office: 50 };
    assert.equal(maxBytesForKind("pdf", limits), 100);
    assert.equal(maxBytesForKind("xlsx", limits), 50);
  });
});
