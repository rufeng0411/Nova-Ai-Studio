// PD-SAAS-FORK VAP: orchestrator helpers.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  extractSourceUrlsFromGoal,
  shouldAutoResolveVisualAssets,
} from "./orchestrator.js";

describe("visual asset orchestrator helpers", () => {
  const prev = process.env.PILOTDECK_VISUAL_ASSET_PLATFORM;

  beforeEach(() => {
    process.env.PILOTDECK_VISUAL_ASSET_PLATFORM = "shadow";
    process.env.PILOTDECK_AUTO_RESOLVE_VISUAL_ASSETS = "1";
  });

  afterEach(() => {
    if (prev == null) delete process.env.PILOTDECK_VISUAL_ASSET_PLATFORM;
    else process.env.PILOTDECK_VISUAL_ASSET_PLATFORM = prev;
  });

  it("extracts official product URL from goal", () => {
    const urls = extractSourceUrlsFromGoal(
      "图和资料要来自官网：https://zongheng.chery.cn/vehicle/g700-refit",
    );
    expect(urls.some((url) => url.includes("zongheng.chery.cn"))).toBe(true);
  });

  it("strips Chinese suffix accidentally glued to URL", () => {
    const urls = extractSourceUrlsFromGoal(
      "官网：https://zongheng.chery.cn/vehicle/g700-refit，8页16:9",
    );
    expect(urls[0]).toBe("https://zongheng.chery.cn/vehicle/g700-refit");
  });

  it("auto-resolves when official media required", () => {
    expect(
      shouldAutoResolveVisualAssets({
        userGoal: "图和资料要来自官网 https://zongheng.chery.cn/",
      }),
    ).toBe(true);
  });

  it("auto-resolves nova slides capability", () => {
    expect(
      shouldAutoResolveVisualAssets({
        userGoal: "做 8 页幻灯",
        capabilitySlug: "nova-ppt-aesthetic-slides",
      }),
    ).toBe(true);
  });

  it("skips VAP auto-resolve for nova-research without explicit visuals", () => {
    expect(
      shouldAutoResolveVisualAssets({
        userGoal: "帮我做 DeepSeek 竞品对标调研报告，须交付 competitor-benchmark-report.md",
        capabilitySlug: "nova-research-competitor",
      }),
    ).toBe(false);
  });

  it("allows nova-research when official media is required", () => {
    expect(
      shouldAutoResolveVisualAssets({
        userGoal: "图和资料要来自官网 https://example.com/product",
        capabilitySlug: "nova-research-competitor",
      }),
    ).toBe(true);
  });

  it("skips VAP auto-resolve for product launch without official imagery", () => {
    expect(
      shouldAutoResolveVisualAssets({
        userGoal: "帮我为【雷蛇 Pro click V2】做一套上市全案，按阶段一次性规划并执行",
      }),
    ).toBe(false);
  });

  it("allows product launch VAP when official media required", () => {
    expect(
      shouldAutoResolveVisualAssets({
        userGoal: "雷蛇 Pro click V2 上市全案，图和资料要来自官网 https://www.razer.com/",
      }),
    ).toBe(true);
  });

  it("bypasses auto-VAP for creative poster when prefer-generate is on", () => {
    const prevPrefer = process.env.PILOTDECK_PREFER_GENERATE_IMAGE;
    process.env.PILOTDECK_PREFER_GENERATE_IMAGE = "shadow";
    try {
      expect(
        shouldAutoResolveVisualAssets({
          userGoal: "做一张活动海报 HTML，主视觉要好看",
          capabilitySlug: "od-poster-hero",
        }),
      ).toBe(false);
    } finally {
      if (prevPrefer == null) delete process.env.PILOTDECK_PREFER_GENERATE_IMAGE;
      else process.env.PILOTDECK_PREFER_GENERATE_IMAGE = prevPrefer;
    }
  });

  it("keeps auto-VAP for creative goal when official imagery required", () => {
    const prevPrefer = process.env.PILOTDECK_PREFER_GENERATE_IMAGE;
    process.env.PILOTDECK_PREFER_GENERATE_IMAGE = "shadow";
    try {
      expect(
        shouldAutoResolveVisualAssets({
          userGoal: "海报 HTML，图和资料要来自官网 https://example.com/product",
          capabilitySlug: "od-poster-hero",
        }),
      ).toBe(true);
    } finally {
      if (prevPrefer == null) delete process.env.PILOTDECK_PREFER_GENERATE_IMAGE;
      else process.env.PILOTDECK_PREFER_GENERATE_IMAGE = prevPrefer;
    }
  });
});
