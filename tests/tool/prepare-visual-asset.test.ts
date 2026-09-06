/**
 * PD-SAAS-FORK VAP P0-F: analyzer tier selection.
 */
import { describe, expect, it } from "vitest";
import { analyzeVisualAsset } from "../../src/saas/media/visualAssetPlatform/analyzer.js";

describe("prepare-visual-asset", () => {
  it("GEO uses resize_only", () => {
    const result = analyzeVisualAsset({
      rawPath: "a.jpg",
      source: "official_fetch",
      capabilitySlug: "geo-serp-analysis",
    });
    expect(result.recommendedTier).toBe("resize_only");
  });

  it("nova product slide uses matting_compose", () => {
    const result = analyzeVisualAsset({
      rawPath: "g700.jpg",
      source: "official_fetch",
      capabilitySlug: "nova-ppt-aesthetic-slides",
      slotId: "slide-01",
      altText: "product hero",
    });
    expect(result.recommendedTier).toBe("matting_compose");
  });

  it("logo skips prepare", () => {
    const result = analyzeVisualAsset({
      rawPath: "logo.png",
      source: "official_fetch",
      altText: "brand logo",
    });
    expect(result.recommendedTier).toBe("none");
  });
});
