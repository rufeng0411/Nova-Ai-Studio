import { describe, expect, it } from "vitest";
import type { OfficialSourceRoot } from "../officialSourceRoots.js";
import {
  filterOfficialRootsForGoal,
  goalMentionsOfficialRoot,
  sourceUrlMatchesOfficialRoot,
} from "./officialRootsGoalFilter.js";

const CHERY_ROOT: OfficialSourceRoot = {
  id: "zongheng-chery",
  rootUrl: "https://zongheng.chery.cn/",
  sourceTier: "brand_official",
  includeSubdomains: true,
  matchHints: ["奇瑞", "纵横", "G700"],
};

const NIKE_ROOT: OfficialSourceRoot = {
  id: "nike-official",
  rootUrl: "https://www.nike.com/",
  sourceTier: "brand_official",
  includeSubdomains: true,
  matchHints: ["Nike", "耐克"],
};

describe("officialRootsGoalFilter", () => {
  it("matches explicit goal URL to registry root by domain", () => {
    expect(
      sourceUrlMatchesOfficialRoot(
        "https://zongheng.chery.cn/vehicle/g700-refit",
        CHERY_ROOT,
      ),
    ).toBe(true);
    expect(
      sourceUrlMatchesOfficialRoot(
        "https://www.nike.com/world-cup",
        NIKE_ROOT,
      ),
    ).toBe(true);
  });

  it("does not activate unrelated registry roots for another brand goal", () => {
    const nikeGoal =
      "用「Nova-产品用研」为【世界杯2026 Nike 球鞋新品】HTML版本图文报告，图片要使用官方或权威图";
    expect(
      filterOfficialRootsForGoal([CHERY_ROOT], { userGoal: nikeGoal }),
    ).toEqual([]);
    expect(
      filterOfficialRootsForGoal([CHERY_ROOT, NIKE_ROOT], { userGoal: nikeGoal }).map((r) => r.id),
    ).toEqual(["nike-official"]);
  });

  it("uses registry matchHints (config) instead of code allowlists", () => {
    expect(
      goalMentionsOfficialRoot("纵横 G700 上市全案", CHERY_ROOT),
    ).toBe(true);
    expect(
      goalMentionsOfficialRoot("Nike 世界杯球鞋报告", CHERY_ROOT),
    ).toBe(false);
  });

  it("derives hostname hints from rootUrl for any brand", () => {
    expect(
      goalMentionsOfficialRoot("世界杯 Nike 球鞋新品", NIKE_ROOT),
    ).toBe(true);
  });
});
