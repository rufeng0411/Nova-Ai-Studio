/** PD-SAAS-FORK: 0802 paddleboard + KM3 replay goals for VAP hardening. */

export const VAP_0802_REPLAY_CASES = [
  {
    id: "paddleboard-research",
    capabilitySlug: "nova-user-research",
    userGoal:
      "用「Nova-用户研究」做【车市水系浆板热】的八段式用户研究：画像、场景、痛点与决策因素。须交付：u-2026-08-02.html。页面需要真实场景配图。",
    expect: {
      queryPack: "generic",
      officialFirst: true,
    },
  },
  {
    id: "km3-geo",
    capabilitySlug: "geo-brand-full",
    userGoal:
      "帮【百路驰 KM3】做品牌 GEO 全案，按阶段一次执行。官网 https://www.bfgoodrich.com.cn/km3.html 产品图须本地化进任务目录。核心-2026-08-02.html",
    expect: {
      queryPack: "generic",
      hasOfficialUrl: true,
      directImageSample: "https://www.bfgoodrich.com.cn/images/km3/k1.jpg",
    },
  },
] as const;
