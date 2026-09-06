/**
 * PD-SAAS-FORK VAP P0-B: discovery helpers.
 */
import { describe, expect, it } from "vitest";
import { createOfficialMediaDnsResolver } from "../../src/tool/builtin/web/publicHttpUrlPolicy.js";
import { discoverySatisfied } from "../../src/saas/media/visualAssetPlatform/discoveryPipeline.js";
import type { VisualAssetManifest } from "../../src/saas/media/visualAssetPlatform/types.js";

describe("discover-visual-assets", () => {
  it("exports DoH-backed official DNS resolver", () => {
    const resolver = createOfficialMediaDnsResolver(async () => []);
    expect(typeof resolver).toBe("function");
  });

  it("discoverySatisfied requires localized official/authority assets", () => {
    const empty: VisualAssetManifest = {
      version: 1,
      sessionId: "s",
      taskArtifactDir: "artifacts/t",
      goalVersion: 1,
      sourceUrls: [],
      updatedAt: new Date().toISOString(),
      assets: [],
      slotBindings: {},
      phase: "idle",
      autoDiscoverTriggered: false,
      errors: [],
    };
    expect(discoverySatisfied(empty, 1)).toBe(false);
    expect(
      discoverySatisfied({
        ...empty,
        assets: [{
          assetId: "a1",
          source: "official_fetch",
          rawPath: "artifacts/t/assets/raw/x.jpg",
          recommendedTier: "none",
          role: "product_hero",
          provenance: {},
          processingStatus: "skipped",
        }],
      }, 1),
    ).toBe(true);
  });
});
