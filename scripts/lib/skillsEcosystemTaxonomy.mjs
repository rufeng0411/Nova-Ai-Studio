/**
 * Prefix-based taxonomy + needs_config for skills-ecosystem vendor packs.
 * PD-SAAS-FORK: prefix rules for pm/adv/aso/brand/fal/edu-sci vendor slugs.
 * Merged in capabilityHubTaxonomy.applyTaxonomyToSkill after SLUG_TAXONOMY.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isHubPackMember } from './capabilityHubPacks.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'skills', 'vendor', 'skills-ecosystem-manifest.json');

/** @type {Set<string>} */
let needsConfigSlugs = null;

function loadNeedsConfigSlugs() {
  if (needsConfigSlugs) return needsConfigSlugs;
  needsConfigSlugs = new Set();
  if (!existsSync(MANIFEST_PATH)) return needsConfigSlugs;
  try {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
    for (const s of manifest.skills || []) {
      if (s.needsConfig) needsConfigSlugs.add(s.vendoredSlug);
    }
  } catch {
    // ignore
  }
  return needsConfigSlugs;
}

/** Brand Build pack: duplicate nested folder slugs (mirror of mkt-brand-*). */
const MKT_BRAND_SKILLS_DUPLICATE_PREFIX = 'mkt-brand-skills-';

/** @deprecated Hub 已改为能力包单卡展示；保留导出以免外部脚本引用报错。 */
export const MKT_BRAND_SHOWCASE = new Set();
/** @deprecated */
export const MKT_ASO_SHOWCASE = new Set();

/** Slugs explicitly hidden per upgrade plan (表 C). */
export const HIDDEN_SLUGS = new Set([
  'github',
  'obsidian',
  'notion',
  'tmux',
  'ala-content-creator',
  'mkt-competitors',
  'mkt-competitor-profiling',
  'mkt-competitive-brief',
  'mkt-aso',
  'react-next-best-practices',
]);

/** Prefix rules applied when no explicit SLUG_TAXONOMY entry overrides hidden_in_hub. */
export const PREFIX_TAXONOMY_RULES = [
  { prefix: 'pms-', stage: 'brainstorming', major_category: 'brainstorming', category_subtag: 'methodology', task_group: 'general' },
  { prefix: 'pmd-', stage: 'brainstorming', major_category: 'brainstorming', category_subtag: 'methodology', task_group: 'general' },
  { prefix: 'humanizer', stage: 'creation', major_category: 'creation', category_subtag: 'polish', task_group: 'copy', secondary_categories: ['creation'] },
  { prefix: 'unslop', stage: 'creation', major_category: 'creation', category_subtag: 'polish', task_group: 'copy', secondary_categories: ['creation'] },
  { prefix: 'anth-pptx', stage: 'office', major_category: 'office', category_subtag: 'office_slides', secondary_categories: ['office'] },
  { prefix: 'anth-xlsx', stage: 'office', major_category: 'office', category_subtag: 'office_sheets', secondary_categories: ['office'] },
  { prefix: 'anth-mcp-builder', stage: 'development', major_category: 'development', category_subtag: 'dev_mcp' },
  { prefix: 'anth-canvas-design', stage: 'creation', major_category: 'creation', category_subtag: 'create_visual' },
  { prefix: 'mkt-claude-seo', major_category: 'geo', geo_stage: 'geo_technical', task_group: 'seo_visibility', hub_recommend_stars: 4 },
  { prefix: 'mkt-last30days', stage: 'research', major_category: 'marketing', task_group: 'brand_sentiment' },
  { prefix: 'mkt-email-bible', stage: 'activate', major_category: 'marketing', task_group: 'email' },
  { prefix: 'mkt-x-article-publisher', stage: 'distribute', major_category: 'marketing', task_group: 'global_social' },
  { prefix: 'mkt-typefully', stage: 'distribute', major_category: 'marketing', task_group: 'global_social' },
  { prefix: 'mkt-screenshots', stage: 'create', major_category: 'marketing', task_group: 'ad_visual' },
  { prefix: 'mkt-dmp-', stage: 'strategy', major_category: 'marketing', task_group: 'campaign_full' },
  { prefix: 'mkt-adv-', stage: 'activate', major_category: 'marketing', task_group: 'paid' },
  { prefix: 'mkt-aso-', stage: 'distribute', major_category: 'marketing', task_group: 'app_store' },
  { prefix: 'mkt-brand-', stage: 'strategy', major_category: 'marketing', task_group: 'brand_geo', secondary_categories: ['creation', 'office'] },
  { prefix: 'create-color-expert', stage: 'creation', major_category: 'creation', category_subtag: 'create_visual' },
  { prefix: 'create-taste-skill', stage: 'creation', major_category: 'creation', category_subtag: 'create_web' },
  { prefix: 'create-taste-', stage: 'creation', major_category: 'creation', category_subtag: 'create_web' },
  { prefix: 'ppt-gorden-', stage: 'create', major_category: 'marketing', task_group: 'deck_report', secondary_categories: ['office', 'creation'], category_subtag: 'office_slides' },
  { prefix: 'cyber-ppt', stage: 'create', major_category: 'marketing', task_group: 'deck_report', secondary_categories: ['office', 'creation'], category_subtag: 'office_slides' },
  { prefix: 'create-ui-', stage: 'creation', major_category: 'creation', category_subtag: 'create_web' },
  { prefix: 'create-threejs-', stage: 'creation', major_category: 'creation', category_subtag: 'create_web' },
  { prefix: 'create-youtube-clipper', stage: 'creation', major_category: 'creation', category_subtag: 'create_video', secondary_categories: ['marketing'], task_group: 'video' },
  { prefix: 'create-nanobanana-ppt', stage: 'office', major_category: 'office', category_subtag: 'office_slides', secondary_categories: ['creation', 'marketing'], task_group: 'deck_report' },
  { prefix: 'create-ai-music', stage: 'creation', major_category: 'creation', category_subtag: 'create_audio' },
  { prefix: 'create-wonda', stage: 'creation', major_category: 'creation', category_subtag: 'create_video' },
  { prefix: 'video-db-', stage: 'creation', major_category: 'creation', category_subtag: 'create_video' },
  { prefix: 'fal-', stage: 'creation', major_category: 'creation', category_subtag: 'create_video', task_group: 'video', secondary_categories: ['marketing'], secondary_task_groups: ['video'], secondary_stages: ['create'] },
  { prefix: 'office-minimax-', stage: 'office', major_category: 'office', category_subtag: 'office_docs' },
  { prefix: 'office-epub', stage: 'office', major_category: 'office', category_subtag: 'office_docs' },
  { prefix: 'office-ecom', stage: 'office', major_category: 'office', category_subtag: 'office_sheets' },
  { prefix: 'office-nutrient', stage: 'office', major_category: 'office', category_subtag: 'office_docs' },
  { prefix: 'dev-playwright', stage: 'development', major_category: 'development', category_subtag: 'dev_test' },
  { prefix: 'dev-next-best-practices', stage: 'development', major_category: 'development', category_subtag: 'dev_frontend' },
  { prefix: 'dev-sentry', stage: 'development', major_category: 'development', category_subtag: 'dev_deploy' },
  { prefix: 'dev-hamel-', stage: 'development', major_category: 'development', category_subtag: 'dev_test' },
  { prefix: 'brainstorm-structured', stage: 'brainstorming', major_category: 'brainstorming', category_subtag: 'methodology' },
  { prefix: 'edu-recursive-research', stage: 'education', major_category: 'education', category_subtag: 'academic_research', education_bands: ['academic_research'] },
  { prefix: 'edu-tutor-skills', stage: 'education', major_category: 'education', category_subtag: 'academic_research', education_bands: ['general'] },
  { prefix: 'fc-firecrawl-', stage: 'research', major_category: 'marketing', task_group: 'web_fetch' },
  { prefix: 'web-just-scrape', stage: 'research', major_category: 'marketing', task_group: 'web_fetch' },
  { prefix: 'create-frontend-design', stage: 'creation', major_category: 'creation', category_subtag: 'create_web' },
  { prefix: 'create-ui-ux-pro-max', stage: 'creation', major_category: 'creation', category_subtag: 'create_web' },
  { prefix: 'create-vid-', stage: 'creation', major_category: 'creation', category_subtag: 'create_video' },
  { prefix: 'create-ai-video-gen', stage: 'creation', major_category: 'creation', category_subtag: 'create_video' },
  { prefix: 'remotion-best-practices', stage: 'creation', major_category: 'creation', category_subtag: 'create_video' },
  { prefix: 'legal-lav-', stage: 'office', major_category: 'office', category_subtag: 'legal_compliance', hidden_in_hub: true },
  { prefix: 'lpm-', stage: 'office', major_category: 'office', category_subtag: 'legal_compliance', hidden_in_hub: true },
  { prefix: 'legal-risk-assessment', stage: 'office', major_category: 'office', category_subtag: 'legal_compliance' },
  { prefix: 'legal-response', stage: 'office', major_category: 'office', category_subtag: 'legal_compliance' },
  // PD-SAAS-FORK: 企业合规原子默认隐藏；前台仅 virtual 卡
  { prefix: 'zh-', stage: 'enterprise_compliance', major_category: 'enterprise_compliance', hidden_in_hub: true },
  { prefix: 'zhxx-', stage: 'enterprise_compliance', major_category: 'enterprise_compliance', hidden_in_hub: true },
  { prefix: 'bid-', stage: 'enterprise_compliance', major_category: 'enterprise_compliance', hidden_in_hub: true },
  { prefix: 'biaoshu-', stage: 'enterprise_compliance', major_category: 'enterprise_compliance', hidden_in_hub: true },
  { prefix: 'comp-', stage: 'enterprise_compliance', major_category: 'enterprise_compliance', category_subtag: 'comp_ops_reg' },
  { prefix: 'tax-', stage: 'enterprise_compliance', major_category: 'enterprise_compliance', category_subtag: 'comp_tax_accounting', hidden_in_hub: true },
  { prefix: 'edu-fun-', stage: 'education', major_category: 'education', education_bands: ['edu_fun'] },
  { prefix: 'edu-sci-', stage: 'education', major_category: 'education', category_subtag: 'academic_research', education_bands: ['academic_research'], hidden_in_hub: true },
];

const NEEDS_CONFIG_HINTS = {
  'fal-': '在设置 → 能力接入中心填写 fal.ai API Key（FAL_KEY）。',
  'mkt-typefully': '在设置 → 能力接入中心填写 Typefully API Key。',
  'video-db-': '在设置 → 能力接入中心填写 VideoDB API Key。',
  'create-ai-music': '在设置 → 能力接入中心填写音乐生成 API Key。',
  'create-wonda': '在设置 → 能力接入中心填写 Wonda / 多模态 API Key。',
  'office-nutrient': '在设置 → 能力接入中心填写 Nutrient DWS API Key。',
  'dev-sentry': '在设置 → 能力接入中心填写 Sentry DSN 或组织 Token。',
  'fc-firecrawl-': '在设置 → 能力接入中心填写 Firecrawl API Key（FIRECRAWL_API_KEY）。',
  'web-just-scrape': '部分抓取栈可能需要 ScrapeGraph API Key，请查阅上游说明。',
  'create-ai-video-gen': '视频生成步骤优先继承模型池中的 Seedance/视频 Key。',
  'create-nanobanana-ppt': '生图步骤优先继承模型池中的 Google（AIza）Key；未配置时请在能力接入中心补充。',
};

function applyBrandPackSecondary(item, patch) {
  const slug = item.slug || '';
  if (!slug.startsWith('mkt-brand-') || slug.startsWith(MKT_BRAND_SKILLS_DUPLICATE_PREFIX)) return patch;
  const sec = new Set(patch.secondary_categories || item.secondary_categories || []);
  if (/design|visual|frontend|landing|wireframe|logo|art-direction|ui|web/i.test(slug)) {
    sec.add('creation');
  }
  if (/docx|xlsx|pdf|email|collab|notion/i.test(slug)) {
    sec.add('office');
  }
  if (/code-review|security|deploy|test|qa|monitoring/i.test(slug)) {
    sec.add('development');
  }
  if (sec.size) patch.secondary_categories = [...sec];
  return patch;
}

export function applySkillsEcosystemTaxonomy(item) {
  const slug = item.slug || '';
  let patch = {};

  if (HIDDEN_SLUGS.has(slug)) {
    patch.hidden_in_hub = true;
  }

  if (slug.startsWith(MKT_BRAND_SKILLS_DUPLICATE_PREFIX)) {
    patch.hidden_in_hub = true;
  } else if (isHubPackMember(slug)) {
    patch.hidden_in_hub = true;
  } else if (slug.startsWith('fc-firecrawl-') && slug !== 'fc-firecrawl-cli' && slug !== 'fc-firecrawl-search') {
    patch.hidden_in_hub = true;
  }

  for (const rule of PREFIX_TAXONOMY_RULES) {
    if (slug === rule.prefix || slug.startsWith(rule.prefix)) {
      patch = { ...patch, ...rule };
      break;
    }
  }

  const nc = loadNeedsConfigSlugs();
  if (nc.has(slug)) {
    patch.availability = 'needs_config';
    for (const [prefix, hint] of Object.entries(NEEDS_CONFIG_HINTS)) {
      if (slug.startsWith(prefix) || slug === prefix.replace(/-$/, '')) {
        patch.setup_hint = hint;
        break;
      }
    }
    if (!patch.setup_hint) {
      patch.setup_hint = '在设置 → 能力接入中心填写对应 API Key 后保存并重启。';
    }
  }

  // NanoBanana inherits Google key — mark available when model pool has Google (runtime resolves status)
  if (slug === 'create-nanobanana-ppt') {
    patch.availability = 'available';
    patch.setup_hint = '生图步骤优先继承模型池 Google Key；未配置 Google 时在设置中补充。';
  }

  patch = applyBrandPackSecondary(item, patch);
  return { ...item, ...patch };
}
