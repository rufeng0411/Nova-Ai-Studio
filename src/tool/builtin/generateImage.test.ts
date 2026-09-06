import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_INLINE_IMAGE_BYTES,
  resolveMaxInlineImageBytes,
  shouldInlineGeneratedImage,
} from "./generateImage.js";

describe("shouldInlineGeneratedImage", () => {
  it("inlines small images (cheap for the rare vision-critique flow)", () => {
    expect(shouldInlineGeneratedImage(100 * 1024, DEFAULT_MAX_INLINE_IMAGE_BYTES)).toBe(true);
    expect(shouldInlineGeneratedImage(DEFAULT_MAX_INLINE_IMAGE_BYTES, DEFAULT_MAX_INLINE_IMAGE_BYTES)).toBe(true);
  });

  it("does NOT inline a large hero image (path/file block only — prevents request bloat)", () => {
    // ~2MB PNG: the exact class that ballooned the request to ~880k tokens and died with "fetch failed".
    expect(shouldInlineGeneratedImage(2 * 1024 * 1024, DEFAULT_MAX_INLINE_IMAGE_BYTES)).toBe(false);
    expect(shouldInlineGeneratedImage(DEFAULT_MAX_INLINE_IMAGE_BYTES + 1, DEFAULT_MAX_INLINE_IMAGE_BYTES)).toBe(false);
  });

  it("does NOT inline an empty buffer", () => {
    expect(shouldInlineGeneratedImage(0, DEFAULT_MAX_INLINE_IMAGE_BYTES)).toBe(false);
  });
});

describe("resolveMaxInlineImageBytes", () => {
  it("defaults to 512KB when unset or invalid", () => {
    expect(resolveMaxInlineImageBytes(undefined)).toBe(DEFAULT_MAX_INLINE_IMAGE_BYTES);
    expect(resolveMaxInlineImageBytes("not-a-number")).toBe(DEFAULT_MAX_INLINE_IMAGE_BYTES);
    expect(DEFAULT_MAX_INLINE_IMAGE_BYTES).toBe(512 * 1024);
  });

  it("honours an explicit override (incl. 0 to disable inlining entirely)", () => {
    expect(resolveMaxInlineImageBytes("1048576")).toBe(1048576);
    expect(resolveMaxInlineImageBytes("0")).toBe(0);
  });
});
