import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { irToAttachmentText } from "../../../src/saas/document-import/irToAttachmentText.js";

describe("irToAttachmentText", () => {
  it("wraps markdown and truncates", () => {
    const ir = {
      sourcePath: "a.md",
      sourceKind: "markdown" as const,
      blocks: [{ type: "paragraph" as const, text: "hello world" }],
    };
    const { text, truncated } = irToAttachmentText(ir, {
      maxChars: 100,
      maxTableRows: 200,
      sourcePath: "a.md",
      providerId: "mammoth-docx",
    });
    assert.match(text, /<attachment parsed="a.md" provider="mammoth-docx">/);
    assert.match(text, /hello world/);
    assert.equal(truncated, false);
  });

  it("truncates long markdown", () => {
    const ir = {
      sourcePath: "b.md",
      sourceKind: "markdown" as const,
      blocks: [{ type: "paragraph" as const, text: "x".repeat(500) }],
    };
    const { truncated } = irToAttachmentText(ir, {
      maxChars: 100,
      maxTableRows: 200,
      sourcePath: "b.md",
      providerId: "test",
    });
    assert.equal(truncated, true);
  });
});
