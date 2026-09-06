import { describe, expect, it } from "vitest";
import {
  excludesCreativeGenerateImage,
  isCreativePreferGenActive,
  shouldRouteCreativeGenerateImage,
  wantsCreativeGenerateImage,
} from "./creativeGenerateImageIntent.js";

const preferOn = { PILOTDECK_PREFER_GENERATE_IMAGE: "shadow" };
const preferOff = { PILOTDECK_PREFER_GENERATE_IMAGE: "off" };
const imageReady = { ...preferOn, GOOGLE_API_KEY: "AIza-test" };

describe("creativeGenerateImageIntent", () => {
  it("includes poster / hero goals and visual slugs", () => {
    expect(wantsCreativeGenerateImage("做一张科技风活动海报 HTML")).toBe(true);
    expect(wantsCreativeGenerateImage("帮我做封面图", "od-poster-hero")).toBe(true);
    expect(wantsCreativeGenerateImage("产品介绍", "od-saas-landing")).toBe(true);
  });

  it("bare 配图 alone is not enough without visual co-signal", () => {
    expect(wantsCreativeGenerateImage("补充一下配图说明文字")).toBe(false);
    expect(wantsCreativeGenerateImage("落地页要配图和 HTML")).toBe(true);
  });

  it("excludes official / wireframe / OKR / research-md", () => {
    expect(excludesCreativeGenerateImage("做南美旅游落地页，用官网产品图。")).toBe(true);
    expect(excludesCreativeGenerateImage("团队 OKR 页", "od-team-okrs")).toBe(true);
    expect(excludesCreativeGenerateImage("线框草图", "od-wireframe-sketch")).toBe(true);
    expect(excludesCreativeGenerateImage("写行业调研报告，须交付：report.md")).toBe(true);
  });

  it("isCreativePreferGenActive respects flag and exclusions", () => {
    expect(isCreativePreferGenActive({
      goal: "做一张科技风活动海报 HTML",
      env: preferOn,
    })).toBe(true);
    expect(isCreativePreferGenActive({
      goal: "做一张科技风活动海报 HTML",
      env: preferOff,
    })).toBe(false);
    expect(isCreativePreferGenActive({
      goal: "官网产品图落地页",
      env: preferOn,
    })).toBe(false);
  });

  it("shouldRouteCreativeGenerateImage requires image API ready", () => {
    expect(shouldRouteCreativeGenerateImage({
      goal: "做一张科技风活动海报 HTML",
      env: preferOn,
    })).toBe(false);
    expect(shouldRouteCreativeGenerateImage({
      goal: "做一张科技风活动海报 HTML",
      env: imageReady,
    })).toBe(true);
  });
});
