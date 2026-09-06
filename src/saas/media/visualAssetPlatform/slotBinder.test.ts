// PD-SAAS-FORK VAP: slot binder unit tests.
import { describe, expect, it } from "vitest";
import { bindAssetsToSlots } from "./slotBinder.js";
import type { VisualAssetManifest } from "./types.js";

function manifest(assets: VisualAssetManifest["assets"]): VisualAssetManifest {
  return {
    version: 1,
    sessionId: "s1",
    taskArtifactDir: "artifacts/task-test",
    goalVersion: 1,
    sourceUrls: [],
    updatedAt: new Date().toISOString(),
    assets,
    slotBindings: {},
    phase: "phase_a",
    autoDiscoverTriggered: true,
    errors: [],
  };
}

describe("bindAssetsToSlots", () => {
  it("binds official product photo to poster slot", () => {
    const result = bindAssetsToSlots(
      manifest([
        {
          assetId: "va_official",
          source: "official_fetch",
          rawPath: "artifacts/task-test/assets/raw/a.jpg",
          preparedPath: "artifacts/task-test/assets/prepared/a.png",
          recommendedTier: "matting_compose",
          role: "product_hero",
          subjectMatch: "high",
          provenance: {},
          processingStatus: "ok",
        },
        {
          assetId: "va_gen",
          source: "generate_image",
          rawPath: "artifacts/task-test/assets/raw/fake.png",
          recommendedTier: "none",
          role: "unknown",
          subjectMatch: "low",
          provenance: {},
          processingStatus: "skipped",
        },
      ]),
      [{ slotId: "kv-poster", label: "主视觉海报", kind: "image" }],
    );
    expect(result.slotBindings["kv-poster"]).toBe("va_official");
    expect(result.verifiedPaths[0]).toContain("prepared");
  });
});
