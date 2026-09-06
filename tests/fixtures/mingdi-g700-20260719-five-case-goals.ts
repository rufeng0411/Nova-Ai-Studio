/**
 * PD-SAAS-FORK VAP: desensitized goals from 2026-07-19 five real UI cases.
 * Replay-only KPIs — live Gateway is P1.
 */
export type MingdiFiveCaseFixture = {
  id: string;
  title: string;
  userGoal: string;
  expectOfficialOnly: boolean;
  expectLocalizedOfficialImagesMin: number;
  forbiddenTags: string[];
  historicalFailureTags: string[];
};

export const MINGDI_G700_20260719_FIVE_CASES: MingdiFiveCaseFixture[] = [
  {
    id: "geo-full-20260719",
    title: "GEO 六阶段全案",
    userGoal:
      "帮【纵横-鸣镝G700】做品牌 GEO 全案，按阶段一次执行，存系统分配的任务目录，每阶段报路径。",
    expectOfficialOnly: false,
    expectLocalizedOfficialImagesMin: 0,
    forbiddenTags: [],
    historicalFailureTags: [],
  },
  {
    id: "nova-slides-official-20260719",
    title: "Nova 美学幻灯 8 页官网配图",
    userGoal:
      "用「Nova-美学幻灯」把【G700】做成【8】页【16:9】，图和资料要来自官网：https://zongheng.chery.cn/vehicle/g700-refit",
    expectOfficialOnly: true,
    expectLocalizedOfficialImagesMin: 1,
    forbiddenTags: ["forbidden_generate_image", "unlabeled_degrade"],
    historicalFailureTags: ["official_media_violation", "slide_count_drift"],
  },
  {
    id: "campaign-full-20260719",
    title: "品牌传播 Campaign 全案",
    userGoal:
      "帮我做【纵横-鸣镝G700】的品牌传播 campaign 全案，按阶段一次规划执行，产出存系统分配的任务目录。图和资料优先来自官网 https://zongheng.chery.cn/",
    expectOfficialOnly: true,
    expectLocalizedOfficialImagesMin: 1,
    forbiddenTags: ["forbidden_generate_image", "unlabeled_degrade"],
    historicalFailureTags: ["forbidden_generate_image", "unlabeled_degrade"],
  },
  {
    id: "html-demo-official-20260719",
    title: "HTML 演示 8 页官网资料",
    userGoal:
      "用「HTML 演示」做【8】页【G700】动画演示：图和资料要来自官网：https://zongheng.chery.cn/vehicle/g700-refit",
    expectOfficialOnly: true,
    expectLocalizedOfficialImagesMin: 1,
    forbiddenTags: ["unlabeled_degrade"],
    historicalFailureTags: ["unlabeled_degrade"],
  },
  {
    id: "launch-full-20260719",
    title: "上市全案",
    userGoal:
      "帮我为【纵横-鸣镝G700】做一套上市全案，按阶段一次性规划并执行，每阶段产出存系统分配的任务目录。配图来自官网 https://zongheng.chery.cn/",
    expectOfficialOnly: true,
    expectLocalizedOfficialImagesMin: 1,
    forbiddenTags: ["forbidden_generate_image"],
    historicalFailureTags: ["needs_repair_honest"],
  },
];
