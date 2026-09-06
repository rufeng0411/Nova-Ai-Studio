import { describe, expect, it } from "vitest";

import { analyzeVisualAsset } from "../../src/saas/media/visualAssetPlatform/analyzer.js";
import { VISUAL_ASSET_RECIPE_MATRIX } from "../fixtures/visual-asset-recipe-matrix.js";

describe("visual asset recipe matrix", () => {
  for (const sample of VISUAL_ASSET_RECIPE_MATRIX) {
    it(`${sample.id} tier matches ${sample.expectedTier}`, () => {
      const result = analyzeVisualAsset({
        rawPath: `assets/raw/${sample.id}.png`,
        source: "official_fetch",
        sourceUrl: "https://zongheng.chery.cn/hero.png",
        capabilitySlug: sample.capabilitySlug,
        slotId: sample.slotId,
        altText: sample.role.replace(/_/gu, " "),
        subject: "G700",
      });
      expect(result.recommendedTier).toBe(sample.expectedTier);
      if (sample.forbidMatting) {
        expect(result.recommendedTier).not.toBe("matting_compose");
      }
    });
  }
});
