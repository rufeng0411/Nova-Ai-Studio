import { describe, expect, it } from "vitest";
import { isBrandGeoFullCaseGoal, resolveProfile } from "./deliverableCapabilityProfiles.js";

describe("resolveProfile Tier-0", () => {
  const geoGoal = "帮【雷蛇灵刃】做品牌 GEO 全案，按阶段一次执行，存 artifacts_geo_【品牌名】_ 每阶段 numbered";
  const campaignGoal = "帮我做【雷蛇2026主题】的品牌传播 campaign 全案，按阶段一次规划执行，产出存 artifacts/campaign 调研 策划 brief 主视觉 发布 监测";

  it("GEO full case resolves to geo not social_matrix", () => {
    expect(isBrandGeoFullCaseGoal(geoGoal)).toBe(true);
    const profile = resolveProfile(undefined, undefined, `${geoGoal} 小红书草稿`);
    expect(profile.id).toBe("geo");
  });

  it("Campaign full case resolves to campaign not visual_canvas", () => {
    const profile = resolveProfile(undefined, undefined, `${campaignGoal} 海报 主视觉`);
    expect(profile.id).toBe("campaign");
  });

  it("mkt-ads resolves dedicated mkt_ads profile before content", () => {
    const profile = resolveProfile("mkt-ads", "marketing", "试一下付费投放");
    expect(profile.id).toBe("mkt_ads");
  });

  it("weekly-update PPT with 封面 resolves ppt not visual_canvas", () => {
    const goal =
      "简约周会更新 PPT (weekly-update)\n要求：\n封面：团队名称\n议程：议题\n项目进展：工作\n关键数据：指标\n总结与行动项：负责人";
    const profile = resolveProfile(undefined, undefined, goal);
    expect(profile.id).toBe("ppt");
    expect(profile.id).not.toBe("visual_canvas");
  });

  it("Showcase OD dashboard/pricing without slug resolve design not default", () => {
    expect(resolveProfile(undefined, undefined, "企业后台管理仪表盘 (dashboard)\n描述：数据监控").id).toBe(
      "design",
    );
    expect(resolveProfile(undefined, undefined, "定价卡片 (Pricing Card)\n页面组件").id).toBe("design");
  });

  it("0717: image-generation resolves single-image before visual_canvas", () => {
    const profile = resolveProfile("image-generation", undefined, "阿根廷VS西班牙 9:16 海报");
    expect(profile.id).toBe("single-image");
    expect(
      profile.executionContract?.requiredDeliverables.some((d) => /canvas-manifest/i.test(String(d))) ?? false,
    ).toBe(false);
  });
});
