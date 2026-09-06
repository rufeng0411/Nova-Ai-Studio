/**
 * PD-SAAS-FORK: Three-case speed RCA live case definitions (2026-07-26).
 */

export const THREE_CASE_SPEED_RCA_CASE_IDS = [
  'spongebob-us-research',
  'blackcloak-matrix',
  'geo-brand-full',
];

/** @type {Record<string, import('./runThreeCaseSpeedRcaLiveGateway.mjs').ThreeCaseLiveSpec>} */
export const THREE_CASE_SPEED_RCA_LIVE_CASES = {
  'spongebob-us-research': {
    caseId: 'spongebob-us-research',
    label: '海绵宝宝用户研究',
    goal:
      '用「Nova-用户研究」做【海绵宝宝手机】的八段式用户研究：画像、场景、痛点与决策因素。须交付：user-research-report.md。写入系统分配任务目录。',
    capabilitySlug: 'nova-research-user-general',
    gate: {
      firstWriteFileMs: 180_000,
      repairCount: 0,
      tmpWorkspaceCount: 0,
      footerProgressMin: { done: 2, total: 2 },
    },
  },
  'blackcloak-matrix': {
    caseId: 'blackcloak-matrix',
    label: '黑袍纠察队一文多发',
    goal:
      '写一篇【黑袍纠察队】深度长文，再 humanize 成五平台口吻，写入系统分配任务目录，直接开始做',
    capabilitySlug: 'humanizer',
    gate: {
      firstWriteFileMs: 120_000,
      repairCount: 3,
      tmpWorkspaceCount: 0,
      footerProgressMin: { done: 7, total: 7 },
    },
  },
  'geo-brand-full': {
    caseId: 'geo-brand-full',
    label: '品牌 GEO 全案',
    goal: '帮【www.novapage.online】做品牌 GEO 全案，按阶段一次执行',
    gate: {
      firstWriteFileMs: 180_000,
      repairCount: 1,
      tmpWorkspaceCount: 0,
      footerProgressMin: { done: 7, total: 7 },
    },
  },
};
