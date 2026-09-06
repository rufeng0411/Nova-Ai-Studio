/** PD-SAAS-FORK: three-case speed RCA replay fixtures (2026-07-26). */

export const BLACKCLOAK_MATRIX_GOAL =
  "写一篇【黑袍纠察队】深度长文，再 humanize 成五平台口吻，写入系统分配任务目录，直接开始做";

export const GEO_BRAND_FULL_GOAL =
  "帮【www.novapage.online】做品牌 GEO 全案，按阶段一次执行";

export const SPONGEBOB_US_RESEARCH_GOAL =
  "用「Nova-用户研究」做【海绵宝宝手机】的八段式用户研究：画像、场景、痛点与决策因素。须交付：user-research-report.md。写入系统分配任务目录。";

export const THREE_CASE_SPEED_RCA_FIXTURES = [
  {
    caseId: "blackcloak-matrix",
    goal: BLACKCLOAK_MATRIX_GOAL,
    capabilitySlug: "humanizer",
    expectBypassOrch: true,
    forbiddenSlotHints: ["01-topics", "02-longform", "03-social-slices"],
    maxSlots: 8,
  },
  {
    caseId: "geo-brand-full",
    goal: GEO_BRAND_FULL_GOAL,
    capabilitySlug: undefined,
    expectBypassOrch: true,
    forbiddenSlotHints: ["01-topics", "02-longform", "03-social-slices"],
    maxSlots: 12,
  },
  {
    caseId: "spongebob-us-research",
    goal: SPONGEBOB_US_RESEARCH_GOAL,
    capabilitySlug: "nova-research-user-general",
    expectBypassOrch: true,
    forbiddenSlotHints: ["01-topics", "02-longform", "03-social-slices"],
    maxSlots: 4,
  },
] as const;
