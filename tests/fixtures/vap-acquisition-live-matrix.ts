/**
 * PD-SAAS-FORK VAP: live network acquisition matrix — failed replays + multi-theme.
 */
export type VapLiveMatrixCase = {
  id: string;
  category: "g700_replay" | "news" | "person" | "product" | "brand";
  title: string;
  userGoal: string;
  capabilitySlug?: string;
  minAssets: number;
  useG700Roots?: boolean;
  /** Require search tiers to be attempted when direct official fetch fails. */
  requireSearchTierAttempt?: boolean;
};

/** Historical G700 failures (2026-07-19 exports). */
export const VAP_G700_REPLAY_CASES: VapLiveMatrixCase[] = [
  {
    id: "nova-slides-official-20260719",
    category: "g700_replay",
    title: "Nova 美学幻灯 8 页官网配图",
    userGoal:
      "用「Nova-美学幻灯」把【G700】做成【8】页【16:9】，图和资料要来自官网：https://zongheng.chery.cn/vehicle/g700-refit，或懂车帝、汽车之家等权威网站",
    capabilitySlug: "nova-ppt-aesthetic-slides",
    minAssets: 3,
    useG700Roots: true,
    requireSearchTierAttempt: true,
  },
  {
    id: "campaign-full-20260719",
    category: "g700_replay",
    title: "品牌传播 Campaign 全案",
    userGoal:
      "帮我做【纵横-鸣镝G700】的品牌传播 campaign 全案，按阶段一次规划执行，产出存系统分配的任务目录；图和资料要来自官网：https://zongheng.chery.cn/vehicle/g700-refit，或懂车帝、汽车之家等权威网站",
    capabilitySlug: "brand-campaign-full",
    minAssets: 3,
    useG700Roots: true,
    requireSearchTierAttempt: true,
  },
  {
    id: "html-demo-official-20260719",
    category: "g700_replay",
    title: "HTML 演示 8 页 G700",
    userGoal:
      "用「HTML 演示」做【8】页【G700】动画演示：图和资料要来自官网：https://zongheng.chery.cn/vehicle/g700-refit",
    capabilitySlug: "html-ppt",
    minAssets: 3,
    useG700Roots: true,
    requireSearchTierAttempt: true,
  },
  {
    id: "hero-official-20260719",
    category: "g700_replay",
    title: "G700 品牌 Hero 官网",
    userGoal:
      "做一版纵横G700品牌官网 Hero：一句话定位 + 三个卖点 + 主按钮文案，石墨高级风；配图来自官网 https://zongheng.chery.cn/vehicle/g700-refit",
    capabilitySlug: "od-saas-landing",
    minAssets: 2,
    useG700Roots: true,
    requireSearchTierAttempt: true,
  },
];

/** Cross-theme acquisition smoke (one topic per category). */
export const VAP_THEME_MATRIX_CASES: VapLiveMatrixCase[] = [
  {
    id: "theme-news-20260719",
    category: "news",
    title: "新闻类：AI 产业政策配图",
    userGoal:
      "撰写一篇【2026 中国人工智能产业政策】短讯，配图须来自新华社、人民网、央视网等权威媒体官网",
    minAssets: 2,
    requireSearchTierAttempt: true,
  },
  {
    id: "theme-person-20260719",
    category: "person",
    title: "人物类：企业家公开形象",
    userGoal:
      "做一页【比亚迪 王传福】公开演讲人物介绍，配图须来自比亚迪官网或新华社/人民网等权威媒体",
    minAssets: 2,
    requireSearchTierAttempt: true,
  },
  {
    id: "theme-product-20260719",
    category: "product",
    title: "产品类：消费电子产品",
    userGoal:
      "整理【华为 Mate 70】产品卖点一页纸，配图须来自华为官网 product 页或权威科技媒体",
    minAssets: 3,
    requireSearchTierAttempt: true,
  },
  {
    id: "theme-brand-20260719",
    category: "brand",
    title: "品牌类：国际品牌视觉",
    userGoal:
      "输出【星巴克 Starbucks】品牌视觉一页 brief，主视觉须来自星巴克官网或官方新闻稿配图",
    minAssets: 2,
    requireSearchTierAttempt: true,
  },
];

export const VAP_LIVE_MATRIX_ALL: VapLiveMatrixCase[] = [
  ...VAP_G700_REPLAY_CASES,
  ...VAP_THEME_MATRIX_CASES,
];
