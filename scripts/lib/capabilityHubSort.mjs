/**
 * 能力中心：同一飞轮阶段内的展示排序。
 * 营销 / 品牌调研相关靠前；开发工具、与阶段弱相关的能力靠后。
 */
import { GEO_FLYWHEEL_STAGE_IDS } from './capabilityHubTaxonomy.mjs';
import { novaHubRank } from './hubCapabilityPresentation.mjs';

/** @type {Record<string, string[]>} */
export const STAGE_PRIMARY_ORDER = {
  education: [
    'teacher-lesson-planning',
    'teacher-homework-generation',
    'agent-study-plan',
    'agent-mistake-review',
    'agent-photo-question',
    'agent-socratic-tutor',
    'agent-homework-companion',
    'primary-math-mental-arithmetic',
    'junior-math-rj-textbook-sync',
    'senior-gaokao-sprint',
    'junior-zhongkao-sprint',
    'preschool-literacy-foundation',
  ],
  research: [
    'nova-research-general',
    'nova-research-user-general',
    'nova-research-industry-market',
    'nova-research-product-user',
    'nova-research-competitor',
    'nova-research-academic-professional',
    'mkt-customer-research',
    'mkt-competitor-profiling',
    'mkt-competitors',
    'tool-web-search',
    'mcp-firecrawl',
    'mcp-exa',
    'df-deep-research',
    'df-github-deep-research',
    'ala-fact-checker',
    'ala-decision-helper',
    'od-research-decision-room',
    'anth-docx',
  ],
  strategy: [
    'mkt-product-marketing',
    'mkt-content-strategy',
    'pd-geo',
    'mkt-marketing-plan',
    'mkt-marketing-psychology',
    'mkt-marketing-ideas',
    'mkt-launch',
    'mkt-pricing',
    'mkt-site-architecture',
    'mkt-revops',
    'pms-swot-analysis',
    'df-consulting-analysis',
    'ala-strategy-advisor',
    'ala-project-planner',
    'ala-sprint-planner',
    'pilotdeck-skills-migration',
    'find-skills',
    'skill-creator',
  ],
  create: [
    'nova-bento-slides',
    'nova-ppt-aesthetic-slides',
    'open-design',
    'social-creative-matrix',
    'content-flywheel',
    'cyber-ppt',
    'nova-ppt-aesthetic-slides',
    'ppt-master',
    'html-ppt',
    'anth-docx',
    'mkt-copywriting',
    'mkt-copy-editing',
    'mkt-image',
    'mkt-video',
    'mkt-ad-creative',
    'mkt-paywalls',
    'od-saas-landing',
    'od-social-carousel',
    'od-poster-hero',
    'od-email-marketing',
    'od-article-magazine',
    'od-deck-magazine',
    'od-mobile-app',
    'od-mobile-onboarding',
    'od-pricing-page',
    'od-pricing-upgrade',
    'od-release-notes-one-pager',
    'od-data-report',
    'od-dashboard',
    'od-faq-page',
    'od-login-flow',
    'od-resume',
    'od-8bit-orbit-video',
    'od-after-hours-editorial',
    'od-digits-fintech',
    'od-editorial-burgundy',
    'od-field-notes-editorial',
    'od-swiss-creative',
    'od-swiss-user-research-video',
    'od-weread-year-in-review-video',
    'ala-content-creator',
    'ala-content-writer',
    'ala-ux-designer',
    'df-image-generation',
    'df-video-generation',
    'df-ppt-generation',
    'df-frontend-design',
    'frontend-slides',
    'od-image-gen',
    'od-video-gen',
    'df-web-design-guidelines',
    'od-figma',
    'od-wireframe-sketch',
    'od-web-artifacts-builder',
  ],
  activate: [
    'nova-customer-acquisition-leads',
    'mkt-social',
    'mkt-emails',
    'mkt-cold-email',
    'mkt-community-marketing',
    'mkt-ads',
    'mkt-lead-magnets',
    'mkt-co-marketing',
    'mkt-referrals',
    'mkt-prospecting',
    'mkt-sales-enablement',
    'mkt-sms',
    'mkt-onboarding',
    'mkt-signup',
    'mkt-popups',
    'mkt-free-tools',
    'df-newsletter-generation',
    'df-podcast-generation',
    'ala-email-drafter',
  ],
  distribute: [
    'yixiaoer',
    'mkt-programmatic-seo',
    'mkt-directory-submissions',
    'mkt-schema',
    'mkt-aso',
  ],
  measure: [
    'mkt-ai-seo',
    'mkt-seo-audit',
    'mkt-analytics',
    'mkt-ab-testing',
    'mkt-cro',
    'mkt-churn-prevention',
    'df-data-analysis',
    'ala-data-analyst',
    'ala-visualization-expert',
    'df-chart-visualization',
  ],
  office: [
    'nova-bento-slides',
    'anth-pptx',
    'df-ppt-generation',
    'frontend-slides',
    'ppt-master',
    'html-ppt',
    'nova-ppt-aesthetic-slides',
    'anth-docx',
    'anth-xlsx',
    'anth-pdf',
  ],
  uncategorized: [],
};

const L2_MARKETING_SLUGS = new Set(['yixiaoer', 'social-creative-matrix', 'anth-docx', 'open-design', 'pd-geo']);

const TOOL_SLUGS = new Set([
  'ala-code-reviewer',
  'ala-debugger',
  'ala-fullstack-developer',
  'ala-python-expert',
  'df-bootstrap',
  'df-claude-to-deerflow',
  'df-code-documentation',
  'df-skill-creator',
  'df-smoke-test',
  'df-surprise-me',
  'df-vercel-deploy-claimable',
  'find-skills',
  'skill-creator',
  'pilotdeck-skills-migration',
  'karpathy-guidelines',
  'minimax-pdf',
  'od-figma',
  'od-wireframe-sketch',
  'od-web-artifacts-builder',
  'df-web-design-guidelines',
]);

/**
 * @param {string} slug
 * @param {string} stage
 * @param {{ integration_level?: string }} [meta]
 * @returns {number}
 */
export function computeHubSortPriority(slug, stage, meta = {}) {
  const primary = STAGE_PRIMARY_ORDER[stage];
  if (Array.isArray(primary)) {
    const idx = primary.indexOf(slug);
    if (idx >= 0) return idx;
  }

  let priority = 400;

  if (L2_MARKETING_SLUGS.has(slug)) priority = 50;
  else if (slug.startsWith('mkt-')) priority = 120;
  else if (slug.startsWith('od-') && stage === 'create') priority = 280;
  else if (slug.startsWith('od-')) priority = 650;
  else if (slug.startsWith('df-') || slug.startsWith('ala-')) priority = 450;
  else if (slug.startsWith('pms-')) priority = 180;

  if (TOOL_SLUGS.has(slug)) priority = Math.max(priority, 720);
  if (meta.integration_level === 'L2' && !L2_MARKETING_SLUGS.has(slug)) {
    priority -= 30;
  }

  return priority;
}

/**
 * @param {{ slug: string; stage: string; stage_order?: number; hub_sort?: number; integration_level?: string }} a
 * @param {{ slug: string; stage: string; stage_order?: number; hub_sort?: number; integration_level?: string }} b
 */
export function compareCapabilitiesForHub(a, b) {
  const geoOrder = (item) => {
    if (item.major_category !== 'geo') return 999;
    const idx = GEO_FLYWHEEL_STAGE_IDS?.indexOf(item.geo_stage);
    return idx >= 0 ? idx : 999;
  };
  const starsA = typeof a.hub_recommend_stars === 'number' ? 6 - a.hub_recommend_stars : 99;
  const starsB = typeof b.hub_recommend_stars === 'number' ? 6 - b.hub_recommend_stars : 99;
  const novaA = novaHubRank(a.slug);
  const novaB = novaHubRank(b.slug);
  if (a.major_category === 'geo' && b.major_category === 'geo') {
    const stageCmp = geoOrder(a) - geoOrder(b);
    if (stageCmp !== 0) return stageCmp;
    if (a.geo_stage === b.geo_stage) {
      if (novaA !== novaB) return novaA - novaB;
      const sortA = typeof a.hub_sort === 'number' ? a.hub_sort : computeHubSortPriority(a.slug, a.stage, a);
      const sortB = typeof b.hub_sort === 'number' ? b.hub_sort : computeHubSortPriority(b.slug, b.stage, b);
      if (sortA !== sortB) return sortA - sortB;
    }
    if (starsA !== starsB) return starsA - starsB;
    return a.slug.localeCompare(b.slug);
  }
  if (
    a.category_subtag === 'office_slides'
    && b.category_subtag === 'office_slides'
  ) {
    if (novaA !== novaB) return novaA - novaB;
    if (starsA !== starsB) return starsA - starsB;
    const sortA = typeof a.hub_sort === 'number' ? a.hub_sort : computeHubSortPriority(a.slug, a.stage, a);
    const sortB = typeof b.hub_sort === 'number' ? b.hub_sort : computeHubSortPriority(b.slug, b.stage, b);
    if (sortA !== sortB) return sortA - sortB;
    return a.slug.localeCompare(b.slug);
  }
  if (novaA !== novaB) return novaA - novaB;
  if (a.stage_order !== b.stage_order) return (a.stage_order ?? 999) - (b.stage_order ?? 999);
  if (starsA !== starsB) return starsA - starsB;
  const sortA = typeof a.hub_sort === 'number' ? a.hub_sort : computeHubSortPriority(a.slug, a.stage, a);
  const sortB = typeof b.hub_sort === 'number' ? b.hub_sort : computeHubSortPriority(b.slug, b.stage, b);
  if (sortA !== sortB) return sortA - sortB;
  return a.slug.localeCompare(b.slug);
}
