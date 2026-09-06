import { describe, expect, it } from "vitest";
import { shouldEmbedFullPdfBase64 } from "./AttachmentResolver.js";

describe("shouldEmbedFullPdfBase64", () => {
  it("skips full PDF base64 when extracted text is long enough", () => {
    expect(shouldEmbedFullPdfBase64(200)).toBe(false);
    expect(shouldEmbedFullPdfBase64(480)).toBe(false);
  });

  it("keeps base64 when extracted text is short", () => {
    expect(shouldEmbedFullPdfBase64(0)).toBe(true);
    expect(shouldEmbedFullPdfBase64(199)).toBe(true);
  });
});
