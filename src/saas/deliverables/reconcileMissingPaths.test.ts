import { describe, expect, it } from "vitest";
import {
  reconcileMissingPaths,
  stripCampaignPngMissingWhenHtmlVerified,
  stripPptxVerifiedSlidePngMissing,
} from "./reconcileMissingPaths.js";

describe("reconcileMissingPaths", () => {
  it("drops bare drafts/zhihu.md when verified has full artifacts path", () => {
    const missing = reconcileMissingPaths({
      missing: ["drafts/zhihu.md"],
      verified: ["artifacts/geo/雷蛇灵刃/drafts/zhihu.md"],
    });
    expect(missing).toEqual([]);
  });

  it("keeps truly missing paths", () => {
    const missing = reconcileMissingPaths({
      missing: ["artifacts/geo/雷蛇灵刃/drafts/missing.md"],
      verified: ["artifacts/geo/雷蛇灵刃/drafts/zhihu.md"],
    });
    expect(missing.length).toBe(1);
  });

  it("strips slide PNG from missing when pptx verified", () => {
    const missing = stripPptxVerifiedSlidePngMissing({
      missing: ["artifacts/slides-x/slide-01-cover.png"],
      verified: ["artifacts/ppt/ROG.pptx"],
      capabilitySlug: "ppt-master",
      userGoal: "原生可编辑 PPT",
    });
    expect(missing).toEqual([]);
  });

  it("drops missing when verified basename differs only by spaces", () => {
    const missing = reconcileMissingPaths({
      missing: ["artifacts/task-geo/世界杯2026 调研.md"],
      verified: ["artifacts/task-geo/世界杯2026调研.md"],
    });
    expect(missing).toEqual([]);
  });

  it("strips campaign poster PNG when verified HTML poster exists", () => {
    const missing = stripCampaignPngMissingWhenHtmlVerified({
      missing: ["artifacts/campaign/razer-2026/04-key-visual-poster.png"],
      verified: ["artifacts/campaign/razer-2026/04-key-visual-poster.html"],
    });
    expect(missing).toEqual([]);
  });
});
