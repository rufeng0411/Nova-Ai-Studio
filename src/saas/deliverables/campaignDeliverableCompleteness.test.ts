import { describe, expect, it } from "vitest";
import {
  buildBrandCampaignSdmSlots,
  buildWorldcupCampaignSdmSlots,
  isBrandCampaignFullCaseGoal,
  isWorldcupCampaignFullCaseGoal,
  resolveCampaignSdmSlots,
} from "./campaignDeliverableCompleteness.js";
import { parseNumberedDeliverableList } from "../taskState/sessionDeliverableManifest.js";

const BRAND_CAMPAIGN_GOAL = `帮我做【游戏《盛世天下》】的品牌传播 campaign 全案，按阶段一次规划执行。
标准成果清单：
1. 调研 .md
2. brief .docx
3. 海报
4. 社媒包
5. 草稿编号
6. 监测模板`;

const WORLDCUP_GOAL =
  "世界杯 campaign 全案：1. 调研报告 markdown 2. Campaign 策划 HTML 3. 传播 brief 4. 主视觉海报 5. 官方网站 6. 多平台内容 7. 发布草稿 8. 监测报告";

describe("campaignDeliverableCompleteness", () => {
  it("detects brand-campaign-full vs worldcup goals", () => {
    expect(isBrandCampaignFullCaseGoal(BRAND_CAMPAIGN_GOAL)).toBe(true);
    expect(isWorldcupCampaignFullCaseGoal(BRAND_CAMPAIGN_GOAL)).toBe(false);
    expect(isBrandCampaignFullCaseGoal(WORLDCUP_GOAL)).toBe(false);
    expect(isWorldcupCampaignFullCaseGoal(WORLDCUP_GOAL)).toBe(true);
  });

  it("resolves brand campaign to 6 slots without stage_website", () => {
    const slots = resolveCampaignSdmSlots({
      userGoal: BRAND_CAMPAIGN_GOAL,
      parseNumberedList: parseNumberedDeliverableList,
    });
    expect(slots).toHaveLength(6);
    expect(slots.some((slot) => slot.id === "stage_website")).toBe(false);
    expect(slots.some((slot) => slot.id === "stage_plan_html")).toBe(false);
    expect(slots.some((slot) => slot.stageId === "brief")).toBe(true);
  });

  it("resolves worldcup campaign to 8 slots with stage_website", () => {
    const slots = resolveCampaignSdmSlots({
      userGoal: WORLDCUP_GOAL,
      parseNumberedList: parseNumberedDeliverableList,
    });
    expect(slots).toHaveLength(8);
    expect(slots[4]?.id).toBe("stage_website");
    expect(slots[1]?.id).toBe("stage_plan_html");
  });

  it("buildBrandCampaignSdmSlots defaults to 6 required slots", () => {
    const slots = buildBrandCampaignSdmSlots();
    expect(slots).toHaveLength(6);
    expect(slots.map((slot) => slot.stageId)).toEqual([
      "research",
      "brief",
      "visual",
      "platform",
      "draft",
      "monitoring",
    ]);
  });

  it("buildWorldcupCampaignSdmSlots keeps legacy 8-phase schema", () => {
    const slots = buildWorldcupCampaignSdmSlots();
    expect(slots).toHaveLength(8);
    expect(slots.map((slot) => slot.id)).toContain("stage_website");
  });

  it("0717: 产品名含世界杯但显式标准清单仍为 6 槽", () => {
    const goal = `世界杯版本雷蛇 campaign 全案
标准成果清单：
1. 调研 .md
2. brief .docx
3. 海报
4. 社媒包
5. 草稿编号
6. 监测模板`;
    expect(isBrandCampaignFullCaseGoal(goal)).toBe(true);
    expect(isWorldcupCampaignFullCaseGoal(goal)).toBe(false);
    const slots = resolveCampaignSdmSlots({
      userGoal: goal,
      parseNumberedList: parseNumberedDeliverableList,
    });
    expect(slots).toHaveLength(6);
    expect(slots.some((slot) => slot.id === "stage_website")).toBe(false);
  });
});
