// PD-SAAS-FORK VAP: official media requirement compilation.
import { describe, expect, it } from "vitest";
import {
  compileOfficialMediaRequirement,
  hasExplicitOfficialMediaSourceRequirement,
  hasUrlBackedMediaPreference,
} from "./officialMediaRequirement.js";

describe("officialMediaRequirement", () => {
  it("matches 图和资料要来自官网 as official_only", () => {
    const goal =
      "用「Nova-美学幻灯」把【G700】做成【8】页，图和资料要来自官网：https://zongheng.chery.cn/vehicle/g700-refit";
    expect(hasExplicitOfficialMediaSourceRequirement(goal)).toBe(true);
    const req = compileOfficialMediaRequirement(goal);
    expect(req.officialMediaPolicy).toBe("official_only");
    expect(req.forbidGenerateImage).toBe(true);
    expect(req.allowPlaceholders).toBe(false);
  });

  it("matches 来自官网 without 官方 keyword", () => {
    expect(
      hasExplicitOfficialMediaSourceRequirement("配图来自官网 zongheng.chery.cn"),
    ).toBe(true);
  });

  it("treats URL + media intent as official_preferred when not official_only", () => {
    const goal = "帮我做 landing 页，参考 https://example.com/product，要有配图";
    expect(hasUrlBackedMediaPreference(goal)).toBe(true);
    const req = compileOfficialMediaRequirement(goal);
    expect(req.officialMediaPolicy).toBe("official_preferred");
  });

  it("keeps none for pure chat without media source", () => {
    const req = compileOfficialMediaRequirement("帮我分析一下市场趋势");
    expect(req.officialMediaPolicy).toBe("none");
    expect(req.forbidGenerateImage).toBe(false);
  });

  it("adds platform_verified when 懂车帝/汽车之家 mentioned", () => {
    const req = compileOfficialMediaRequirement(
      "图和资料要来自官网，或懂车帝、汽车之家等权威网站",
    );
    expect(req.allowedSourceTiers).toContain("platform_verified_official");
  });
});
