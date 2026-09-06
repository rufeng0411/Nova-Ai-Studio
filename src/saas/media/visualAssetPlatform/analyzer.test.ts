// PD-SAAS-FORK VAP: analyzer unit tests.
import { describe, expect, it } from "vitest";
import { analyzeVisualAsset } from "./analyzer.js";

describe("analyzeVisualAsset", () => {
  it("marks logo as none (no matting)", () => {
    const result = analyzeVisualAsset({
      rawPath: "artifacts/task/assets/raw/brand-logo.png",
      source: "official_fetch",
      altText: "logo",
    });
    expect(result.role).toBe("logo");
    expect(result.recommendedTier).toBe("none");
    expect(result.needsMatting).toBe(false);
  });

  it("uses resize_only for geo reports", () => {
    const result = analyzeVisualAsset({
      rawPath: "artifacts/task/assets/raw/product.jpg",
      source: "official_fetch",
      capabilitySlug: "geo-serp-analysis",
      subject: "鸣镝G700",
      sourceUrl: "https://zongheng.chery.cn/g700.jpg",
    });
    expect(result.recommendedTier).toBe("resize_only");
    expect(result.suggestedRecipes).toContain("report_inline");
  });

  it("uses matting_compose for nova product slides", () => {
    const result = analyzeVisualAsset({
      rawPath: "artifacts/task/assets/raw/g700-hero.jpg",
      source: "official_fetch",
      capabilitySlug: "nova-ppt-aesthetic-slides",
      slotId: "slide-01-product",
      subject: "G700",
      altText: "product hero",
    });
    expect(result.recommendedTier).toBe("matting_compose");
    expect(result.needsMatting).toBe(true);
  });

  it("uses crop_fit for lifestyle scene", () => {
    const result = analyzeVisualAsset({
      rawPath: "artifacts/task/assets/raw/road-scene.jpg",
      source: "authority_site",
      altText: "lifestyle scene outdoor",
      capabilitySlug: "html-demo",
      slotId: "hero-banner",
    });
    expect(result.recommendedTier).toBe("crop_fit");
  });
});
