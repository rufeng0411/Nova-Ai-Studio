/**
 * PD-SAAS-FORK 0731: four-line research/distill RCA fixtures (export goals).
 * Used by deliverableChecklistAuthority / sdm / heal / distill unit gates.
 */

export const CASE_75A2313F = {
  sessionIdShort: "75a2313f",
  slug: "nova-research-industry-market",
  goal:
    "用「Nova-行业市场」写【人工智能企业级agent行业】市场研究报告：规模、产业链、PEST/SWOT 与进入建议。须交付：industry-market-report.md。\n写入系统分配任务目录。",
  expectedPathHint: "industry-market-report.md",
} as const;

export const CASE_F84F63E3 = {
  sessionIdShort: "f84f63e3",
  slug: "nova-research-user-general",
  goal:
    "参考分析附件内容，用「Nova-用户研究」做八段式用户研究：画像、场景、痛点与决策因素。须交付：user-research-report.md。\n写入系统分配任务目录。",
  expectedPathHint: "user-research-report.md",
} as const;

export const CASE_A0676B9C = {
  sessionIdShort: "a0676b9c",
  slug: "",
  goal: "围绕【人工智能agent SaaS】做正式调研报告：检索→综述 md→图表→Word，三步一口气做完。",
  expectedHints: [
    "01-sources-and-synthesis.md",
    "03-report-body.md",
    "report.docx",
  ],
} as const;

export const CASE_DISTILL_WUXIAOBO = {
  sessionIdShort: "e26bc87e",
  slug: "",
  goal:
    "请深度蒸馏【吴晓波】完整写作底层逻辑：精准复刻此人专属语感、口头禅、句式长短节奏、观点切入方式、叙事结构。",
} as const;

export const CASE_DISTILL_XIAOMI = {
  sessionIdShort: "8151e01f",
  slug: "",
  goal:
    "请深度蒸馏小米危机公关方法论：提炼可复用的应对框架与话术节奏，输出成一份可执行笔记。",
} as const;
