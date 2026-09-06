/**
 * PD-SAAS-FORK VAP P0-G: orchestrator acceptance (plan path).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  extractSourceUrlsFromGoal,
  shouldAutoResolveVisualAssets,
} from "../../src/saas/media/visualAssetPlatform/orchestrator.js";

describe("visual-asset-orchestrator", () => {
  const prev = process.env.PILOTDECK_VISUAL_ASSET_PLATFORM;

  beforeEach(() => {
    process.env.PILOTDECK_VISUAL_ASSET_PLATFORM = "shadow";
    process.env.PILOTDECK_AUTO_RESOLVE_VISUAL_ASSETS = "1";
  });

  afterEach(() => {
    if (prev == null) delete process.env.PILOTDECK_VISUAL_ASSET_PLATFORM;
    else process.env.PILOTDECK_VISUAL_ASSET_PLATFORM = prev;
  });

  it("extracts goal URLs for Phase-A", () => {
    const urls = extractSourceUrlsFromGoal(
      "图和资料要来自官网：https://zongheng.chery.cn/vehicle/g700-refit",
    );
    expect(urls[0]).toContain("zongheng.chery.cn");
  });

  it("auto-resolves visual goals", () => {
    expect(
      shouldAutoResolveVisualAssets({
        userGoal: "做 8 页幻灯，图来自官网",
        capabilitySlug: "nova-ppt-aesthetic-slides",
      }),
    ).toBe(true);
  });
});
