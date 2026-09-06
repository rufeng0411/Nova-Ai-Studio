/**
 * PD-SAAS-FORK VAP P0-H: generate_image ingest helpers.
 */
import { describe, expect, it } from "vitest";
import {
  applyAnalysisToEntry,
  analyzeVisualAsset,
} from "../../src/saas/media/visualAssetPlatform/analyzer.js";
import { createIngestedEntry } from "../../src/saas/media/visualAssetPlatform/manifestStore.js";

describe("generate-image-ingest", () => {
  it("tags generate_image source and avoids high subjectMatch inflation", () => {
    const analysis = analyzeVisualAsset({
      rawPath: "artifacts/t/assets/raw/ai.png",
      source: "generate_image",
      subject: "G700",
      altText: "G700",
    });
    expect(analysis.subjectMatch).not.toBe("high");
    const entry = applyAnalysisToEntry(
      {
        ...createIngestedEntry({
          source: "generate_image",
          rawPath: "artifacts/t/assets/raw/ai.png",
          recommendedTier: analysis.recommendedTier,
          role: analysis.role,
        }),
        assetId: "va_gen_test",
      },
      analysis,
    );
    expect(entry.source).toBe("generate_image");
  });
});
