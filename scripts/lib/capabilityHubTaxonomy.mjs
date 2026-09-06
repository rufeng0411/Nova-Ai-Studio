// PD-SAAS-FORK: capability hub taxonomy (flywheel pills, major categories, virtual cards)
/**
 * 能力中心分类体系：飞轮子类、大分类、slug 映射、虚拟能力卡。
 * 供 generate-capabilities-catalog.mjs 与 UI 共用。
 */
import { applySkillsEcosystemTaxonomy } from './skillsEcosystemTaxonomy.mjs';
import {
  FINANCE_SUBTAGS,
  FINANCE_SLUG_TAXONOMY,
  FINANCE_VIRTUAL_CAPABILITIES,
} from './financeHubTaxonomy.mjs';
import {
  ENTERPRISE_COMPLIANCE_SUBTAGS,
  ENTERPRISE_COMPLIANCE_SLUG_TAXONOMY,
  ENTERPRISE_COMPLIANCE_VIRTUAL_CAPABILITIES,
} from './enterpriseComplianceHubTaxonomy.mjs';
import { ENTERPRISE_CONSULT_SLUG_TAXONOMY } from './enterpriseConsultHubTaxonomy.mjs';
import {
  ENTERPRISE_MCP_BATCH1_VIRTUAL_CAPABILITIES,
  MCP_NOTION_COLLAB_HUB_PATCH,
} from './enterpriseMcpBatch1Hub.mjs';

export const FLYWHEEL_STAGE_IDS = [
  'research',
  'strategy',
  'create',
  'activate',
  'distribute',
  'measure',
];

/** PD-SAAS-FORK: GEO 独立 Tab 专业六段 L2 */
export const GEO_FLYWHEEL_STAGE_IDS = [
  'geo_baseline',
  'geo_strategy',
  'geo_citability',
  'geo_technical',
  'geo_distribution',
  'geo_monitor',
];

/** @type {Record<string, { label: string; stage_order: number; summary: string }>} */
export const GEO_STAGE_LABELS = {
  geo_baseline: { label: '基线调研', stage_order: 1, summary: 'AI 问句库、竞品在模型中的可见度、站点/品牌基线' },
  geo_strategy: { label: '策略定位', stage_order: 2, summary: '关键词矩阵、内容缺口、GTM/定位与全案编排' },
  geo_citability: { label: '可引用内容', stage_order: 3, summary: '事实密度、可摘录段落、平台成稿' },
  geo_technical: { label: '技术与结构', stage_order: 4, summary: 'robots/llms.txt/schema/页面 AI 可达' },
  geo_distribution: { label: '发布与分发', stage_order: 5, summary: '程序化页、邮件触达、国内草稿' },
  geo_monitor: { label: '监测与迭代', stage_order: 6, summary: '主流大模型收录矩阵、多引擎可见度、趋势对比与双格式报告' },
};

export const MAJOR_CATEGORY_ORDER = [
  'marketing',
  'media',
  'geo',
  'finance',
  'enterprise_compliance',
  'office',
  'creation',
  'development',
  'brainstorming',
  'education',
];

/** PD-SAAS-FORK: 媒体 Tab L2 赛道 */
export const MEDIA_LANE_IDS = ['media_ooh', 'media_digital'];

/** @type {Record<string, { label: string; lane_order: number; summary: string }>} */
export const MEDIA_LANE_LABELS = {
  media_ooh: { label: '户外媒体投放', lane_order: 1, summary: '大牌/公交/商场/DOOH 策略与制作规格' },
  media_digital: { label: '数字媒体投放', lane_order: 2, summary: '付费广告账户、创意、上线与优化' },
};

/** @type {Record<string, Array<{ id: string; label: string; step_order: number; summary?: string }>>} */
export const MEDIA_WORKFLOW_STEPS = {
  media_ooh: [
    { id: 'ooh_brief', label: '定目标与 Brief', step_order: 1, summary: '目标、人群、地域、预算' },
    { id: 'ooh_strategy', label: '媒介策略与预算', step_order: 2, summary: '户外占比、周期、渠道 mix' },
    { id: 'ooh_planning', label: '点位与场景', step_order: 3, summary: '大牌/公交/商场/DOOH' },
    { id: 'ooh_creative', label: '创意与制作规格', step_order: 4, summary: '3 秒可读、尺寸与 manifest' },
    { id: 'ooh_traffic', label: '上刊与监播', step_order: 5, summary: '上刊清单、监播要点' },
    { id: 'ooh_measure', label: '效果与结案', step_order: 6, summary: '到店/品牌 lift、结案' },
  ],
  media_digital: [
    { id: 'dig_brief', label: '定目标与 Brief', step_order: 1, summary: 'KPI、预算、受众' },
    { id: 'dig_plan', label: '渠道与媒介计划', step_order: 2, summary: '平台组合、预算切分' },
    { id: 'dig_setup', label: '账户与追踪', step_order: 3, summary: '结构、像素、受众' },
    { id: 'dig_creative', label: '创意生产', step_order: 4, summary: '多版素材' },
    { id: 'dig_launch', label: '上线与预算', step_order: 5, summary: '上线清单、初始出价' },
    { id: 'dig_optimize', label: '优化与实验', step_order: 6, summary: 'ROAS/CPA、A/B' },
    { id: 'dig_report', label: '报表与归因', step_order: 7, summary: '周报/结案' },
  ],
};

export function capabilityMatchesMediaLane(item, laneId) {
  if (!laneId || laneId === 'all') return true;
  if (item.media_lane === laneId) return true;
  const secondary = item.secondary_media_lanes || [];
  return secondary.includes(laneId);
}

export function capabilityMatchesMediaStep(item, stepId) {
  if (!stepId || stepId === 'all') return true;
  if (item.media_workflow_step === stepId) return true;
  const secondary = item.secondary_media_workflow_steps || [];
  return secondary.includes(stepId);
}

/** @type {Record<string, Array<{ id: string; label: string; group_order: number; summary: string }>>} */
export const FLYWHEEL_TASK_GROUPS = {
  research: [
    { id: 'user_market', label: '用户与市场', group_order: 1, summary: '搞清楚客户与竞品是谁' },
    { id: 'market_landscape', label: '行业与趋势', group_order: 2, summary: '行业扫描、趋势与深度调研' },
    { id: 'competitive_intel', label: '竞争情报', group_order: 3, summary: '竞品对比与情报摘要' },
    { id: 'brand_sentiment', label: '品牌与舆情', group_order: 4, summary: '品牌提及、评论与社媒舆情' },
    { id: 'deep_research', label: '深度调研', group_order: 5, summary: '多源信息、行业与趋势' },
    { id: 'web_fetch', label: '联网抓取', group_order: 6, summary: '搜索、抓取竞品网页' },
    { id: 'verify', label: '验真与收敛', group_order: 7, summary: '核对事实、辅助决策' },
    { id: 'deliverable', label: '调研交付', group_order: 8, summary: '决策页、Brief 文档' },
    { id: 'general', label: '其他', group_order: 99, summary: '未归入以上子类' },
  ],
  strategy: [
    { id: 'plan_direction', label: '营销方向', group_order: 1, summary: '年度计划与创意方向' },
    { id: 'campaign_full', label: '活动全案', group_order: 2, summary: '目标、渠道、日历与 KPI' },
    { id: 'brand_geo', label: '品牌与搜索', group_order: 3, summary: '品牌定位与 AI 搜索策略' },
    { id: 'gtm', label: '产品与市场', group_order: 4, summary: '上市、定价与 B2B 收入' },
    { id: 'decision', label: '决策框架', group_order: 5, summary: 'SWOT 与咨询分析' },
    { id: 'deliverable', label: '策略交付', group_order: 6, summary: '预算表、汇报 PPT、Brief' },
    { id: 'general', label: '其他', group_order: 99, summary: '未归入以上子类' },
  ],
  create: [
    { id: 'brand_qc', label: '品牌与总控', group_order: 1, summary: '设计总控与出稿前审稿' },
    { id: 'copy', label: '文案与长文', group_order: 2, summary: '广告文案、润色与长文' },
    { id: 'ad_visual', label: '广告图与主视觉', group_order: 3, summary: '投放图、海报与生图' },
    { id: 'web_page', label: '官网与落地页', group_order: 4, summary: '官网、定价与 FAQ 页' },
    { id: 'social', label: '社媒设计', group_order: 5, summary: '矩阵包、轮播与 EDM 页' },
    { id: 'video', label: '视频与短片', group_order: 6, summary: '营销视频与 HTML 转视频' },
    { id: 'deck_report', label: '比稿与报告', group_order: 7, summary: '演示稿、Deck 与结案' },
    { id: 'design_collab', label: '设计协作', group_order: 8, summary: 'Figma 等设计稿协作' },
    { id: 'general', label: '其他', group_order: 99, summary: '未归入以上子类' },
  ],
  activate: [
    { id: 'social', label: '社媒内容', group_order: 1, summary: '内容与排期策略' },
    { id: 'email', label: '邮件触达', group_order: 2, summary: '邮件序列与 Newsletter' },
    { id: 'b2b_outreach', label: 'B2B 拓客', group_order: 3, summary: '冷邮件与销售赋能' },
    { id: 'paid', label: '付费投放', group_order: 4, summary: '广告策略与账户数据' },
    { id: 'acquire', label: '获客转化', group_order: 5, summary: 'Lead、弹窗与注册' },
    { id: 'community', label: '社区与裂变', group_order: 6, summary: '社区、推荐与联名' },
    { id: 'lifecycle', label: '生命周期', group_order: 7, summary: '激活、短信与播客' },
    { id: 'sales_enablement', label: '销售赋能', group_order: 8, summary: 'Battlecard、话术与销售培训' },
    { id: 'general', label: '其他', group_order: 99, summary: '未归入以上子类' },
  ],
  distribute: [
    { id: 'cn_social', label: '国内发布', group_order: 1, summary: '小红书、抖音等国内平台' },
    { id: 'global_social', label: '海外发布', group_order: 2, summary: 'LinkedIn、X 等海外平台' },
    { id: 'seo_scale', label: 'SEO 规模化', group_order: 3, summary: '批量页面与结构化数据' },
    { id: 'app_store', label: '应用商店', group_order: 4, summary: 'ASO 与应用上架' },
    { id: 'go_live', label: '上线检查', group_order: 5, summary: '上线清单与邮件发布' },
    { id: 'general', label: '其他', group_order: 99, summary: '未归入以上子类' },
  ],
  measure: [
    { id: 'metrics', label: '指标归因', group_order: 1, summary: '看数据、做归因' },
    { id: 'experiment', label: '实验优化', group_order: 2, summary: 'A/B 与转化率优化' },
    { id: 'seo_visibility', label: '搜索可见度', group_order: 3, summary: 'SEO 与 AI 可见度' },
    { id: 'data_feed', label: '数据接入', group_order: 4, summary: '投放、SEO、社媒数据' },
    { id: 'retention', label: '留存', group_order: 5, summary: '流失预防与留存' },
    { id: 'reporting', label: '深度复盘', group_order: 6, summary: '分析与图表' },
    { id: 'general', label: '其他', group_order: 99, summary: '未归入以上子类' },
  ],
};

/** PD-SAAS-FORK: GEO Tab L3 子类（按 geo_stage 映射 task_group） */
export const GEO_TASK_GROUPS = {
  geo_baseline: [
    { id: 'market_landscape', label: '关键词与 SERP', group_order: 1, summary: '挖词、SERP、问句库' },
    { id: 'competitive_intel', label: '竞品与基线', group_order: 2, summary: '竞品可见度、对比分析' },
    { id: 'seo_visibility', label: '快检与审计', group_order: 3, summary: 'AI 搜索快检、可见度初筛' },
    { id: 'general', label: '其他', group_order: 99, summary: '未归入以上子类' },
  ],
  geo_strategy: [
    { id: 'brand_geo', label: '全案与策略', group_order: 1, summary: 'GEO 全案、定位与 GTM' },
    { id: 'market_landscape', label: '内容缺口', group_order: 2, summary: '关键词矩阵与缺口分析' },
    { id: 'general', label: '其他', group_order: 99, summary: '未归入以上子类' },
  ],
  geo_citability: [
    { id: 'copy', label: '可引用成稿', group_order: 1, summary: '优化、成稿与引用评分' },
    { id: 'social', label: '平台草稿', group_order: 2, summary: '多平台成稿' },
    { id: 'general', label: '其他', group_order: 99, summary: '未归入以上子类' },
  ],
  geo_technical: [
    { id: 'seo_visibility', label: '技术审计', group_order: 1, summary: 'AEO、爬虫、页面审计' },
    { id: 'seo_scale', label: '结构化数据', group_order: 2, summary: 'schema、llms.txt' },
    { id: 'general', label: '其他', group_order: 99, summary: '未归入以上子类' },
  ],
  geo_distribution: [
    { id: 'seo_scale', label: '规模化发布', group_order: 1, summary: '程序化 SEO、邮件触达' },
    { id: 'general', label: '其他', group_order: 99, summary: '未归入以上子类' },
  ],
  geo_monitor: [
    { id: 'metrics', label: '收录与监测', group_order: 1, summary: '十一模型、排名跟踪' },
    { id: 'brand_sentiment', label: '品牌舆情', group_order: 2, summary: '提及、评论挖掘' },
    { id: 'seo_visibility', label: '可见度报告', group_order: 3, summary: '双格式报告、MCP' },
    { id: 'reporting', label: '深度复盘', group_order: 4, summary: '分析与图表' },
    { id: 'general', label: '其他', group_order: 99, summary: '未归入以上子类' },
  ],
};

export const MAJOR_CATEGORIES = {
  media: {
    label: '媒体',
    stage_order: 7,
    summary: '户外与数字媒体投放全流程',
  },
  geo: {
    label: 'GEO',
    stage_order: 8,
    summary: 'AI 搜索可见度与 AEO 全流程',
  },
  finance: {
    label: '金融',
    stage_order: 8.5,
    summary: '现代金融学 × AI 金融：投研建模、指标、估值、FP&A 与金融科技',
    subtags: FINANCE_SUBTAGS,
  },
  enterprise_compliance: {
    label: '企业',
    stage_order: 8.7,
    summary: '中国大陆经营监管、合同招投标、人力、公司商事、惠企政策与公关传播',
    subtags: ENTERPRISE_COMPLIANCE_SUBTAGS,
  },
  office: {
    label: '办公',
    stage_order: 9,
    summary: '文档、表格、演示与协作',
    subtags: [
      { id: 'office_docs', label: '文档与 PDF', subtag_order: 1 },
      { id: 'office_sheets', label: '表格与报表', subtag_order: 2 },
      { id: 'office_slides', label: '演示与汇报', subtag_order: 3 },
      { id: 'office_google', label: 'Google 套件', subtag_order: 4 },
      { id: 'office_collab', label: '协作与知识库', subtag_order: 5 },
      { id: 'office_comms', label: '内部沟通', subtag_order: 6 },
      { id: 'legal_compliance', label: '法务合规', subtag_order: 7 },
    ],
  },
  creation: {
    label: '创作',
    stage_order: 10,
    summary: '设计、视频、图像与 OD 全库',
    subtags: [
      { id: 'create_visual', label: '品牌视觉', subtag_order: 1 },
      { id: 'create_web', label: '网页与原型', subtag_order: 2 },
      { id: 'create_social', label: '社媒全模板', subtag_order: 3 },
      { id: 'create_video', label: '视频工程', subtag_order: 4 },
      { id: 'create_image', label: '图像高级', subtag_order: 5 },
      { id: 'create_copy', label: '文案与音频', subtag_order: 6 },
      { id: 'create_audio', label: '音频', subtag_order: 7 },
      { id: 'polish', label: '润色', subtag_order: 8 },
      { id: 'create_product', label: '产品向页面', subtag_order: 9 },
    ],
  },
  development: {
    label: '开发',
    stage_order: 11,
    summary: '工程、测试、部署与平台工具',
    subtags: [
      { id: 'dev_review', label: '代码审查', subtag_order: 1 },
      { id: 'dev_stack', label: '语言与全栈', subtag_order: 2 },
      { id: 'dev_frontend', label: '前端规范', subtag_order: 3 },
      { id: 'dev_test', label: '测试与质量', subtag_order: 4 },
      { id: 'dev_deploy', label: '部署', subtag_order: 5 },
      { id: 'dev_mcp', label: 'MCP 构建', subtag_order: 6 },
      { id: 'dev_platform', label: '平台工具', subtag_order: 7 },
    ],
  },
  brainstorming: {
    label: '脑爆',
    stage_order: 12,
    summary: '用不同视角脑暴、拆解问题与激发创意',
    subtags: [
      { id: 'celebrity_mind', label: '名人思维', subtag_order: 1 },
      { id: 'methodology', label: '方法论', subtag_order: 2 },
      { id: 'enterprise_consult', label: '企业咨询', subtag_order: 3 },
    ],
  },
};

export const SLUG_TAXONOMY = {
  'mkt-customer-research': { task_group: 'user_market' },
  'mkt-competitive-brief': { task_group: 'competitive_intel', hidden_in_hub: true, major_category: 'geo', geo_stage: 'geo_baseline' },
  'mkt-competitor-profiling': { task_group: 'competitive_intel', hidden_in_hub: true, major_category: 'geo', geo_stage: 'geo_baseline' },
  'mkt-competitors': { task_group: 'competitive_intel', hidden_in_hub: true, major_category: 'geo', geo_stage: 'geo_baseline' },
  'mkt-competitive-intel': { task_group: 'competitive_intel', major_category: 'geo', geo_stage: 'geo_baseline', hub_sort: 3, hub_recommend_stars: 4 },
  'mkt-brand-mention': { stage: 'measure', task_group: 'brand_sentiment', major_category: 'geo', geo_stage: 'geo_monitor', hub_recommend_stars: 4 },
  'mkt-review-mining': { task_group: 'brand_sentiment', major_category: 'geo', geo_stage: 'geo_monitor', hub_recommend_stars: 4 },
  'df-deep-research': { task_group: 'market_landscape', secondary_task_groups: ['deep_research'] },
  'df-github-deep-research': { task_group: 'market_landscape', secondary_task_groups: ['deep_research'] },
  'df-consulting-analysis': { stage: 'research', task_group: 'market_landscape' },
  'geo-keyword-research': { major_category: 'geo', geo_stage: 'geo_baseline', task_group: 'market_landscape', hub_sort: 1, hub_recommend_stars: 5 },
  'geo-competitor-analysis': { major_category: 'geo', geo_stage: 'geo_baseline', task_group: 'competitive_intel', hub_sort: 1, hub_recommend_stars: 5 },
  'geo-content-gap-analysis': { major_category: 'geo', geo_stage: 'geo_strategy', task_group: 'market_landscape', hub_sort: 2, hub_recommend_stars: 4 },
  'geo-serp-analysis': { major_category: 'geo', geo_stage: 'geo_baseline', task_group: 'market_landscape', hub_sort: 2, hub_recommend_stars: 4 },
  'geo-content-optimizer': { major_category: 'geo', geo_stage: 'geo_citability', task_group: 'copy', hub_sort: 1, hub_recommend_stars: 5 },
  'geo-seo-content-writer': { major_category: 'geo', geo_stage: 'geo_citability', task_group: 'copy', hub_sort: 2, hub_recommend_stars: 5 },
  'geo-citability': { major_category: 'geo', geo_stage: 'geo_citability', task_group: 'copy', hub_sort: 3, hub_recommend_stars: 5 },
  'geo-technical-seo': { major_category: 'geo', geo_stage: 'geo_technical', task_group: 'seo_visibility', hub_sort: 2, hub_recommend_stars: 5 },
  'geo-on-page-audit': { major_category: 'geo', geo_stage: 'geo_technical', task_group: 'seo_visibility', hub_sort: 3, hub_recommend_stars: 4 },
  'geo-rank-track': { major_category: 'geo', geo_stage: 'geo_monitor', task_group: 'metrics', hub_sort: 3, hub_recommend_stars: 5 },
  'geo-aeo-audit': { major_category: 'geo', geo_stage: 'geo_technical', task_group: 'seo_visibility', hub_sort: 1, hub_recommend_stars: 5 },
  'geo-cn-crawlers': { major_category: 'geo', geo_stage: 'geo_technical', task_group: 'seo_visibility', hub_sort: 4, hub_recommend_stars: 5 },
  'geo-visibility-probe': { major_category: 'geo', geo_stage: 'geo_monitor', task_group: 'metrics', hub_sort: 1, hub_recommend_stars: 5 },
  'geo-backlink-analyzer': { major_category: 'geo', geo_stage: 'geo_monitor', task_group: 'reporting', hub_recommend_stars: 3 },
  'geo-performance-reporter': { major_category: 'geo', geo_stage: 'geo_monitor', task_group: 'reporting', hub_recommend_stars: 4 },
  'geo-monitor-hub': { major_category: 'geo', geo_stage: 'geo_monitor', task_group: 'metrics', hub_sort: 2, hub_recommend_stars: 5, integration_level: 'L2' },
  'geo-monitor-report': { major_category: 'geo', geo_stage: 'geo_monitor', task_group: 'metrics', hub_sort: 4, hub_recommend_stars: 5, integration_level: 'L2' },
  'geo-dual-report': { major_category: 'geo', geo_stage: 'geo_monitor', task_group: 'seo_visibility', hub_sort: 5, hub_recommend_stars: 4, integration_level: 'L2' },
  'mcp-geo-optimizer': { major_category: 'geo', geo_stage: 'geo_technical', hub_recommend_stars: 5, availability: 'needs_config' },
  'mcp-ai-seo': { major_category: 'geo', geo_stage: 'geo_technical', hub_recommend_stars: 4, availability: 'needs_config' },
  'mcp-agent-aeo': { major_category: 'geo', geo_stage: 'geo_monitor', hub_recommend_stars: 5, availability: 'needs_config' },
  'mkt-email-sequence': { major_category: 'geo', geo_stage: 'geo_distribution', hub_recommend_stars: 4 },
  'mkt-draft-content': { stage: 'activate', task_group: 'social', major_category: 'geo', geo_stage: 'geo_citability', hub_recommend_stars: 4 },
  'mkt-content-creation': { stage: 'create', task_group: 'copy', major_category: 'geo', geo_stage: 'geo_citability', hub_recommend_stars: 4 },
  'mkt-performance-report': {
    stage: 'measure',
    task_group: 'metrics',
    major_category: 'geo',
    geo_stage: 'geo_monitor',
    hub_recommend_stars: 3,
    secondary_categories: ['media'],
    secondary_media_lanes: ['media_ooh', 'media_digital'],
    secondary_media_workflow_steps: ['ooh_measure', 'dig_report'],
  },
  'ala-deep-research': { task_group: 'deep_research', hidden_in_hub: true },
  'tool-web-search': { task_group: 'web_fetch', availability: 'needs_config' },
  'mcp-firecrawl': { task_group: 'web_fetch', availability: 'needs_config' },
  'mcp-playwright': { stage: 'development', major_category: 'development', category_subtag: 'dev_test', availability: 'ready' },
  'mcp-exa': { task_group: 'web_fetch', availability: 'needs_config' },
  'ala-fact-checker': { task_group: 'verify' },
  'ala-decision-helper': { task_group: 'verify' },
  'od-research-decision-room': { task_group: 'deliverable' },
  'anth-docx': { task_group: 'deliverable', secondary_categories: ['office'], category_subtag: 'office_docs' },
  'df-systematic-literature-review': { stage: 'education', major_category: 'education', education_bands: ['academic_research'], category_subtag: 'academic_research', hub_sort: 20 },
  'df-academic-paper-review': { stage: 'education', major_category: 'education', education_bands: ['academic_research'], category_subtag: 'academic_research', hub_sort: 15 },
  'ala-academic-researcher': { stage: 'education', major_category: 'education', education_bands: ['academic_research'], category_subtag: 'academic_research', hub_sort: 40 },
  'college-academic-writing': { stage: 'education', major_category: 'education', education_bands: ['academic_research'], category_subtag: 'academic_research', hub_sort: 35 },
  'anth-pdf': { stage: 'education', major_category: 'education', education_bands: ['academic_research'], category_subtag: 'academic_research', hub_sort: 5, secondary_categories: ['office'] },
  'ora-brainstorm-research': { stage: 'education', major_category: 'education', education_bands: ['academic_research'], category_subtag: 'academic_research', hub_sort: 8 },
  'ora-research-manager': { stage: 'education', major_category: 'education', education_bands: ['academic_research'], category_subtag: 'academic_research', hub_sort: 10 },
  'ora-rigor-reviewer': { stage: 'education', major_category: 'education', education_bands: ['academic_research'], category_subtag: 'academic_research', hub_sort: 12 },
  'ora-ml-paper-writing': { stage: 'education', major_category: 'education', education_bands: ['academic_research'], category_subtag: 'academic_research', hub_sort: 18 },
  'ora-systems-paper-writing': { stage: 'education', major_category: 'education', education_bands: ['academic_research'], category_subtag: 'academic_research', hub_sort: 22 },
  'ora-academic-plotting': { stage: 'education', major_category: 'education', education_bands: ['academic_research'], category_subtag: 'academic_research', hub_sort: 25 },
  'nova-research-general': { stage: 'research', major_category: 'marketing', task_group: 'deep_research', hub_sort: 8 },
  'nova-research-user-general': { stage: 'research', major_category: 'marketing', task_group: 'user_market', hub_sort: 8 },
  'nova-research-industry-market': { stage: 'research', major_category: 'marketing', task_group: 'market_landscape', hub_sort: 8 },
  'nova-research-product-user': { stage: 'research', major_category: 'marketing', task_group: 'user_market', hub_sort: 12 },
  'nova-research-competitor': { stage: 'research', major_category: 'marketing', task_group: 'competitive_intel', hub_sort: 8 },
  'nova-research-academic-professional': { stage: 'education', major_category: 'education', education_bands: ['academic_research'], category_subtag: 'academic_research', hub_sort: 6, secondary_categories: ['office'] },
  'nova-ppt-aesthetic-slides': { stage: 'create', major_category: 'marketing', task_group: 'deck_report', hub_sort: 2, hub_recommend_stars: 5, secondary_categories: ['office'], category_subtag: 'office_slides' },
  'nova-customer-acquisition-leads': { stage: 'activate', major_category: 'marketing', task_group: 'acquire', hub_sort: 8 },
  'ala-code-reviewer': { stage: 'development', major_category: 'development', category_subtag: 'dev_review' },
  'ala-debugger': { stage: 'development', major_category: 'development', category_subtag: 'dev_review' },
  'df-code-documentation': { stage: 'development', major_category: 'development', category_subtag: 'dev_review' },
  'ala-fullstack-developer': { stage: 'development', major_category: 'development', category_subtag: 'dev_stack' },
  'ala-python-expert': { stage: 'development', major_category: 'development', category_subtag: 'dev_stack' },
  'df-web-design-guidelines': { stage: 'development', major_category: 'development', category_subtag: 'dev_frontend', secondary_categories: ['creation'] },
  'df-frontend-design': { stage: 'development', major_category: 'development', category_subtag: 'dev_frontend', secondary_categories: ['creation'] },
  'df-smoke-test': { stage: 'development', major_category: 'development', category_subtag: 'dev_test' },
  'df-vercel-deploy-claimable': { stage: 'development', major_category: 'development', category_subtag: 'dev_deploy' },
  'df-bootstrap': { stage: 'development', major_category: 'development', category_subtag: 'dev_deploy' },
  'df-claude-to-deerflow': { stage: 'development', major_category: 'development', category_subtag: 'dev_mcp' },
  'df-find-skills': { stage: 'development', major_category: 'development', category_subtag: 'dev_platform' },
  'df-skill-creator': { stage: 'development', major_category: 'development', category_subtag: 'dev_platform' },
  'find-skills': { stage: 'development', major_category: 'development', category_subtag: 'dev_platform' },
  'skill-creator': { stage: 'development', major_category: 'development', category_subtag: 'dev_platform' },
  'pilotdeck-skills-migration': { stage: 'development', major_category: 'development', category_subtag: 'dev_platform' },
  'df-surprise-me': { stage: 'development', major_category: 'development', category_subtag: 'dev_platform' },
  'ala-editor': { stage: 'office', major_category: 'office', category_subtag: 'office_docs' },
  'ala-meeting-notes': { stage: 'office', major_category: 'office', category_subtag: 'office_comms' },
  'ala-technical-writer': { stage: 'office', major_category: 'office', category_subtag: 'office_docs' },
  'mkt-marketing-plan': {
    task_group: 'plan_direction',
    secondary_categories: ['media'],
    secondary_media_lanes: ['media_digital'],
    secondary_media_workflow_steps: ['dig_plan'],
  },
  'mkt-marketing-ideas': { task_group: 'plan_direction' },
  'mkt-marketing-psychology': { task_group: 'plan_direction' },
  'mkt-campaign-plan': {
    stage: 'strategy',
    task_group: 'campaign_full',
    availability: 'available',
    secondary_categories: ['media'],
    secondary_media_lanes: ['media_ooh', 'media_digital'],
    secondary_media_workflow_steps: ['ooh_brief', 'dig_brief'],
  },
  'mkt-launch': { task_group: 'campaign_full' },
  'mkt-content-strategy': { task_group: 'campaign_full' },
  'mkt-brand-strategy': { stage: 'strategy', task_group: 'brand_geo', availability: 'available' },
  'pd-geo': { stage: 'strategy', task_group: 'brand_geo', major_category: 'geo', geo_stage: 'geo_strategy', hub_sort: 1, hub_recommend_stars: 5, integration_level: 'L2' },
  'mkt-site-architecture': { task_group: 'brand_geo' },
  'mkt-product-marketing': { task_group: 'gtm' },
  'pms-swot-analysis': { task_group: 'decision' },
  'ala-strategy-advisor': { task_group: 'decision' },
  'ala-project-planner': { stage: 'development', major_category: 'development', category_subtag: 'dev_platform' },
  'ala-sprint-planner': { stage: 'development', major_category: 'development', category_subtag: 'dev_platform' },
  'mkt-strategy-deck': { stage: 'strategy', task_group: 'deliverable', availability: 'available', secondary_categories: ['office'] },
  'open-design': { task_group: 'brand_qc', secondary_categories: ['creation'], category_subtag: 'create_visual' },
  'mkt-brand-review': { stage: 'create', task_group: 'brand_qc', availability: 'available' },
  'mkt-copywriting': { task_group: 'copy' },
  'mkt-copy-editing': { task_group: 'copy' },
  'od-article-magazine': { task_group: 'copy', secondary_categories: ['creation'], category_subtag: 'create_copy' },
  'mkt-ad-creative': {
    task_group: 'ad_visual',
    secondary_categories: ['media'],
    secondary_media_lanes: ['media_ooh', 'media_digital'],
    secondary_media_workflow_steps: ['ooh_creative', 'dig_creative'],
  },
  'mkt-image': { task_group: 'ad_visual' },
  'tool-generate-image': { task_group: 'ad_visual', availability: 'needs_config' },
  'od-poster-hero': { task_group: 'ad_visual', secondary_categories: ['creation'], category_subtag: 'create_visual' },
  'df-image-generation': { task_group: 'ad_visual', secondary_categories: ['creation'], category_subtag: 'create_image' },
  'od-image-gen': { task_group: 'ad_visual', secondary_categories: ['creation'], category_subtag: 'create_image' },
  'od-saas-landing': { task_group: 'web_page', secondary_categories: ['creation'], category_subtag: 'create_web' },
  'od-pricing-page': { task_group: 'web_page', secondary_categories: ['creation'], category_subtag: 'create_web' },
  'od-pricing-upgrade': { task_group: 'web_page', secondary_categories: ['creation'], category_subtag: 'create_web' },
  'mkt-paywalls': { task_group: 'web_page' },
  'od-faq-page': { task_group: 'web_page', secondary_categories: ['creation'], category_subtag: 'create_web' },
  'od-release-notes-one-pager': { task_group: 'web_page', secondary_categories: ['creation'], category_subtag: 'create_web' },
  // Batch B (2026-08-03): curated OD surface skills — Hub visible unless hidden_in_hub
  'od-waitlist-page': { stage: 'creation', major_category: 'creation', category_subtag: 'create_web', task_group: 'web_page', secondary_categories: ['creation'], hub_sort: 20 },
  'od-web-prototype': { stage: 'creation', major_category: 'creation', category_subtag: 'create_web', task_group: 'web_page', secondary_categories: ['creation'], hub_sort: 21 },
  'od-team-okrs': { stage: 'creation', major_category: 'creation', category_subtag: 'create_web', task_group: 'web_page', secondary_categories: ['creation'], hub_sort: 22 },
  'od-kanban-board': { stage: 'creation', major_category: 'creation', category_subtag: 'create_web', task_group: 'web_page', secondary_categories: ['creation'], hub_sort: 23 },
  'od-meeting-notes': { stage: 'creation', major_category: 'creation', category_subtag: 'create_web', task_group: 'web_page', secondary_categories: ['creation', 'office'], hub_sort: 24 },
  'od-docs-page': { stage: 'creation', major_category: 'creation', category_subtag: 'create_web', task_group: 'web_page', secondary_categories: ['creation'], hub_sort: 25 },
  'od-blog-post': { stage: 'creation', major_category: 'creation', category_subtag: 'create_web', task_group: 'web_page', secondary_categories: ['creation'], hub_sort: 26 },
  'od-finance-report': { stage: 'creation', major_category: 'creation', category_subtag: 'create_web', task_group: 'web_page', secondary_categories: ['creation', 'office'], hub_sort: 27 },
  'od-hr-onboarding': { stage: 'creation', major_category: 'creation', category_subtag: 'create_web', task_group: 'web_page', secondary_categories: ['creation', 'office'], hub_sort: 28 },
  'od-pm-spec': { stage: 'creation', major_category: 'creation', category_subtag: 'create_web', task_group: 'web_page', secondary_categories: ['creation', 'office'], hub_sort: 29 },
  'od-gamified-app': { stage: 'creation', major_category: 'creation', category_subtag: 'create_web', task_group: 'web_page', secondary_categories: ['creation'], hub_sort: 30 },
  'od-deck-swiss': { stage: 'creation', major_category: 'creation', category_subtag: 'create_web', task_group: 'web_page', secondary_categories: ['creation'], hub_sort: 31 },
  'od-social-x-card': { stage: 'create', major_category: 'marketing', task_group: 'social', secondary_categories: ['creation'], category_subtag: 'create_social', hub_sort: 18 },
  'od-creative-director': { stage: 'creation', major_category: 'creation', category_subtag: 'create_visual', hidden_in_hub: true },
  'od-wireframe-mobile-flow': { stage: 'creation', major_category: 'creation', category_subtag: 'create_web', hidden_in_hub: true },
  'social-creative-matrix': { task_group: 'social', hub_sort: 1, hub_recommend_stars: 5, integration_level: 'L2' },
  'content-flywheel': {
    stage: 'create',
    major_category: 'marketing',
    task_group: 'social',
    hub_sort: 2,
    hub_recommend_stars: 5,
    integration_level: 'L2',
  },
  'viral-article-generator': {
    stage: 'create',
    major_category: 'marketing',
    task_group: 'copy',
    secondary_categories: ['creation'],
    category_subtag: 'create_copy',
    hub_sort: 3,
    hub_recommend_stars: 5,
    integration_level: 'L2',
    availability: 'available',
    setup_hint: '无需 Python 依赖；交付 Markdown 四文件（简报/母稿/金句/渠道）。当前可写 T1-1/T1-2，其余风格仅推荐预告。',
  },
  'od-social-carousel': { task_group: 'social', secondary_categories: ['creation'], category_subtag: 'create_social' },
  'od-email-marketing': { task_group: 'social', secondary_categories: ['creation'], category_subtag: 'create_social' },
  'mkt-video': { task_group: 'video' },
  'tool-generate-video': { task_group: 'video', availability: 'needs_config' },
  'tool-generate-speech': { task_group: 'audio', availability: 'needs_config' },
  'tool-transcribe-audio': { task_group: 'audio', availability: 'needs_config' },
  'tool-render-html-video': { task_group: 'video', availability: 'needs_config' },
  'hf-hyperframes': { stage: 'create', major_category: 'marketing', task_group: 'video', hub_sort: 1, secondary_categories: ['creation'], category_subtag: 'create_video' },
  'hf-product-launch-video': { stage: 'create', major_category: 'marketing', task_group: 'video', hub_sort: 2, secondary_categories: ['creation'], category_subtag: 'create_video' },
  'hf-motion-graphics': { stage: 'create', major_category: 'marketing', task_group: 'video', hub_sort: 3, secondary_categories: ['creation'], category_subtag: 'create_video' },
  'hf-general-video': { stage: 'create', major_category: 'marketing', task_group: 'video', hub_sort: 4, secondary_categories: ['creation'], category_subtag: 'create_video' },
  'hf-faceless-explainer': { stage: 'create', major_category: 'marketing', task_group: 'video', hub_sort: 5, secondary_categories: ['creation'], category_subtag: 'create_video' },
  'hf-slideshow': { stage: 'create', major_category: 'marketing', task_group: 'video', hub_sort: 6, secondary_categories: ['creation'], category_subtag: 'create_video' },
  'hf-figma': { stage: 'creation', major_category: 'creation', category_subtag: 'create_video', hub_sort: 50, hidden_in_hub: true },
  'hf-hyperframes-core': { hidden_in_hub: true, task_group: 'video', secondary_categories: ['creation'], category_subtag: 'create_video' },
  'hf-hyperframes-animation': { hidden_in_hub: true, task_group: 'video', secondary_categories: ['creation'], category_subtag: 'create_video' },
  'hf-hyperframes-keyframes': { hidden_in_hub: true, task_group: 'video', secondary_categories: ['creation'], category_subtag: 'create_video' },
  'hf-hyperframes-creative': { hidden_in_hub: true, task_group: 'video', secondary_categories: ['creation'], category_subtag: 'create_video' },
  'hf-hyperframes-registry': { hidden_in_hub: true, task_group: 'video', secondary_categories: ['creation'], category_subtag: 'create_video' },
  'hf-media-use': { hidden_in_hub: true, task_group: 'video', secondary_categories: ['creation'], category_subtag: 'create_video' },
  'hf-pr-to-video': { hidden_in_hub: true, task_group: 'video', secondary_categories: ['creation'], category_subtag: 'create_video' },
  'hf-embedded-captions': { hidden_in_hub: true, task_group: 'video', secondary_categories: ['creation'], category_subtag: 'create_video' },
  'hf-talking-head-recut': { hidden_in_hub: true, task_group: 'video', secondary_categories: ['creation'], category_subtag: 'create_video' },
  'hf-music-to-video': { hidden_in_hub: true, task_group: 'video', secondary_categories: ['creation'], category_subtag: 'create_video' },
  'hf-remotion-to-hyperframes': { hidden_in_hub: true, task_group: 'video', secondary_categories: ['creation'], category_subtag: 'create_video' },
  // PD-SAAS-FORK: 已 pin「网站一键成片」— 禁止 hidden_in_hub（Hub 审计 20260812）
  'hf-website-to-video': { stage: 'create', major_category: 'marketing', task_group: 'video', hub_sort: 7, secondary_categories: ['creation'], category_subtag: 'create_video', hidden_in_hub: false },
  'hf-hyperframes-cli': { stage: 'create', major_category: 'marketing', task_group: 'video', hub_sort: 40, secondary_categories: ['creation'], category_subtag: 'create_video', hidden_in_hub: true },
  'hf-hyperframes-media': { stage: 'create', major_category: 'marketing', task_group: 'video', hub_sort: 41, secondary_categories: ['creation'], category_subtag: 'create_video', hidden_in_hub: true },
  'hf-gsap': { stage: 'creation', major_category: 'creation', category_subtag: 'create_video', hub_sort: 45, hidden_in_hub: true },
  'mkt-brand-video': { stage: 'create', task_group: 'video', availability: 'available', secondary_categories: ['creation'], category_subtag: 'create_video', hidden_in_hub: false, hub_sort: 4 },
  'remotion-video': { stage: 'create', major_category: 'marketing', task_group: 'video', hub_sort: 12, secondary_categories: ['creation'], category_subtag: 'create_video' },
  'mkt-dmp-video-script': { stage: 'strategy', major_category: 'marketing', task_group: 'campaign_full', secondary_categories: ['creation'], category_subtag: 'create_video', hidden_in_hub: false, hub_sort: 5 },
  'create-vid-scriptwriting': { stage: 'creation', major_category: 'creation', category_subtag: 'create_video', hub_sort: 1, integration_level: 'L1', availability: 'available' },
  'create-vid-saas-demo-script': { stage: 'creation', major_category: 'creation', category_subtag: 'create_video', hub_sort: 2, integration_level: 'L1', availability: 'available' },
  'create-vid-seedance-prompt': { stage: 'creation', major_category: 'creation', category_subtag: 'create_video', hub_sort: 3, integration_level: 'L1', availability: 'available' },
  'create-vid-seedance-codec': { stage: 'creation', major_category: 'creation', category_subtag: 'create_video', hub_sort: 4, integration_level: 'L1', availability: 'available' },
  'create-vid-visual-prompt': { stage: 'creation', major_category: 'creation', category_subtag: 'create_video', hub_sort: 5, integration_level: 'L1', availability: 'available' },
  'create-vid-director': { stage: 'creation', major_category: 'creation', category_subtag: 'create_video', hub_sort: 6, integration_level: 'L1', availability: 'available' },
  'create-vid-storyboard-pack': { stage: 'creation', major_category: 'creation', category_subtag: 'create_video', hub_sort: 7, integration_level: 'L1', availability: 'available' },
  'create-vid-seedance-series': { stage: 'creation', major_category: 'creation', category_subtag: 'create_video', hub_sort: 8, integration_level: 'L1', availability: 'available' },
  'create-vid-viral-copy': { stage: 'creation', major_category: 'creation', category_subtag: 'create_video', secondary_categories: ['marketing'], secondary_stages: ['create'], secondary_task_groups: ['copy'], hub_sort: 9, integration_level: 'L2', availability: 'needs_config', setup_hint: '对标抖音链接解析需 Python 与 yt-dlp；纯文案创作可不装依赖。' },
  'df-video-generation': { task_group: 'video', secondary_categories: ['creation'], category_subtag: 'create_video' },
  'od-video-gen': { task_group: 'video', hidden_in_hub: true, secondary_categories: ['creation'], category_subtag: 'create_video' },
  'od-8bit-orbit-video': { task_group: 'video', secondary_categories: ['creation'], category_subtag: 'create_video' },
  'od-after-hours-editorial': { task_group: 'video', secondary_categories: ['creation'], category_subtag: 'create_video' },
  'od-editorial-burgundy': { task_group: 'video', secondary_categories: ['creation'], category_subtag: 'create_video' },
  'od-field-notes-editorial': { task_group: 'video', secondary_categories: ['creation'], category_subtag: 'create_video' },
  'od-swiss-creative': { task_group: 'video', secondary_categories: ['creation'], category_subtag: 'create_video' },
  'od-swiss-user-research-video': { task_group: 'video', secondary_categories: ['creation'], category_subtag: 'create_video' },
  'od-weread-year-in-review-video': { task_group: 'video', secondary_categories: ['creation'], category_subtag: 'create_video' },
  'mkt-pitch-deck': { stage: 'create', task_group: 'deck_report', availability: 'available', secondary_categories: ['office'] },
  'od-deck-magazine': { task_group: 'deck_report', secondary_categories: ['creation'], category_subtag: 'create_visual' },
  'frontend-slides': { stage: 'office', major_category: 'office', task_group: 'deck_report', secondary_categories: ['office'], category_subtag: 'office_slides' },
  'html-ppt': { stage: 'create', major_category: 'marketing', task_group: 'deck_report', secondary_categories: ['office', 'creation'], category_subtag: 'create_slides', hub_sort: 4, hub_recommend_stars: 4 },
  'cyber-ppt': {
    stage: 'create',
    major_category: 'marketing',
    task_group: 'deck_report',
    secondary_categories: ['office', 'creation'],
    category_subtag: 'office_slides',
    hub_sort: 1,
    hub_recommend_stars: 5,
    integration_level: 'L2',
  },
  'ppt-gorden-super': {
    stage: 'create',
    major_category: 'marketing',
    task_group: 'deck_report',
    secondary_categories: ['office', 'creation'],
    category_subtag: 'office_slides',
    hub_sort: 9,
    hub_recommend_stars: 5,
    integration_level: 'L2',
    availability: 'needs_config',
  },
  'ppt-gorden-image-gen': {
    stage: 'create',
    major_category: 'marketing',
    task_group: 'deck_report',
    secondary_categories: ['office', 'creation'],
    category_subtag: 'office_slides',
    hub_sort: 10,
    hub_recommend_stars: 4,
    integration_level: 'L2',
    availability: 'needs_config',
  },
  'ppt-gorden-image2pptx': {
    stage: 'create',
    major_category: 'marketing',
    task_group: 'deck_report',
    secondary_categories: ['office', 'creation'],
    category_subtag: 'office_slides',
    hub_sort: 11,
    hub_recommend_stars: 4,
    integration_level: 'L2',
  },
  'create-taste-skill': { stage: 'creation', major_category: 'creation', category_subtag: 'create_web', hub_sort: 5, hub_recommend_stars: 5 },
  'create-taste-skill-v1': { stage: 'creation', major_category: 'creation', category_subtag: 'create_web', hidden_in_hub: true, hub_sort: 99 },
  'create-taste-gpt': { stage: 'creation', major_category: 'creation', category_subtag: 'create_web', hidden_in_hub: true, hub_sort: 99 },
  'create-taste-brandkit': { stage: 'creation', major_category: 'creation', category_subtag: 'create_visual', hub_sort: 6, hub_recommend_stars: 4 },
  'create-taste-imagegen-web': { stage: 'creation', major_category: 'creation', category_subtag: 'create_visual', hub_sort: 7, hub_recommend_stars: 4, availability: 'needs_config' },
  'create-taste-imagegen-mobile': { stage: 'creation', major_category: 'creation', category_subtag: 'create_visual', hub_sort: 8, hub_recommend_stars: 4, availability: 'needs_config' },
  'create-taste-image-to-code': { stage: 'creation', major_category: 'creation', category_subtag: 'create_web', hub_sort: 9, hub_recommend_stars: 4 },
  'create-taste-redesign': { stage: 'creation', major_category: 'creation', category_subtag: 'create_web', hub_sort: 10, hub_recommend_stars: 4 },
  'create-taste-minimalist': { stage: 'creation', major_category: 'creation', category_subtag: 'create_web', hub_sort: 11, hub_recommend_stars: 3 },
  'create-taste-brutalist': { stage: 'creation', major_category: 'creation', category_subtag: 'create_web', hub_sort: 3, hub_recommend_stars: 5 },
  'create-taste-soft': { stage: 'creation', major_category: 'creation', category_subtag: 'create_web', hub_sort: 13, hub_recommend_stars: 3 },
  'create-taste-stitch': { stage: 'creation', major_category: 'creation', category_subtag: 'create_web', hub_sort: 14, hub_recommend_stars: 3 },
  'create-taste-output': { stage: 'creation', major_category: 'creation', category_subtag: 'create_web', hub_sort: 15, hub_recommend_stars: 3 },
  'ppt-master': {
    stage: 'create',
    major_category: 'marketing',
    task_group: 'deck_report',
    secondary_categories: ['office'],
    category_subtag: 'office_slides',
    hub_sort: 3,
    hub_recommend_stars: 4,
    integration_level: 'L2',
    availability: 'needs_config',
    setup_hint: '需 Python 3.10+ 与 pip install -r requirements.txt；高质量模型与可选 OPENAI/GEMINI/PEXELS Key 见 skill 内 .env.example。',
  },
  'edu-sci-timesfm-forecasting': {
    stage: 'office',
    major_category: 'office',
    category_subtag: 'office_sheets',
    task_group: 'reporting',
    secondary_categories: ['education'],
    education_bands: ['academic_research'],
    hidden_in_hub: false,
    hub_sort: 18,
    integration_level: 'L2',
    availability: 'needs_config',
    setup_hint: '需 Python 3.10+、pip install timesfm[torch] 与约 800MB 模型缓存；首次运行须 bash scripts/check_system.py。',
  },
  'df-ppt-generation': { stage: 'office', major_category: 'office', task_group: 'deck_report', secondary_categories: ['office'], category_subtag: 'office_slides' },
  'mkt-campaign-report': {
    stage: 'create',
    task_group: 'deck_report',
    availability: 'available',
    secondary_categories: ['office', 'media'],
    secondary_media_lanes: ['media_ooh', 'media_digital'],
    secondary_media_workflow_steps: ['ooh_measure', 'dig_report'],
  },
  'od-data-report': { task_group: 'deck_report', secondary_categories: ['creation'], category_subtag: 'create_visual' },
  'mcp-figma': { task_group: 'design_collab', availability: 'needs_config' },
  'od-figma': { task_group: 'design_collab', secondary_categories: ['creation'], category_subtag: 'create_visual' },
  'od-resume': { stage: 'creation', major_category: 'creation', category_subtag: 'create_product' },
  'od-login-flow': { stage: 'creation', major_category: 'creation', category_subtag: 'create_product' },
  'od-mobile-app': { stage: 'creation', major_category: 'creation', category_subtag: 'create_product' },
  'od-mobile-onboarding': { stage: 'creation', major_category: 'creation', category_subtag: 'create_product' },
  'od-dashboard': { stage: 'creation', major_category: 'creation', category_subtag: 'create_product' },
  'od-wireframe-sketch': { stage: 'creation', major_category: 'creation', category_subtag: 'create_web', hidden_in_hub: true },
  'od-web-artifacts-builder': { stage: 'creation', major_category: 'creation', category_subtag: 'create_web', hidden_in_hub: true },
  'ala-content-creator': { stage: 'creation', major_category: 'creation', category_subtag: 'create_copy', hidden_in_hub: true },
  'ala-content-writer': { stage: 'creation', major_category: 'creation', category_subtag: 'create_copy', hidden_in_hub: true },
  'ala-ux-designer': { stage: 'creation', major_category: 'creation', category_subtag: 'create_visual', hidden_in_hub: true },
  'df-podcast-generation': { task_group: 'lifecycle', secondary_categories: ['creation'], category_subtag: 'create_copy' },
  'mkt-social': { task_group: 'social' },
  'mkt-emails': { task_group: 'email' },
  'ala-email-drafter': { task_group: 'email', hidden_in_hub: true },
  'df-newsletter-generation': { task_group: 'email' },
  'mkt-cold-email': { task_group: 'b2b_outreach' },
  'mkt-prospecting': { task_group: 'b2b_outreach' },
  'mkt-sales-enablement': { task_group: 'b2b_outreach' },
  'mkt-ads': {
    task_group: 'paid',
    secondary_categories: ['media'],
    secondary_media_lanes: ['media_digital'],
    secondary_media_workflow_steps: ['dig_setup', 'dig_optimize'],
  },
  'mcp-ads': {
    task_group: 'paid',
    availability: 'needs_config',
    secondary_categories: ['media'],
    secondary_media_lanes: ['media_digital'],
    secondary_media_workflow_steps: ['dig_report'],
  },
  'mkt-lead-magnets': { task_group: 'acquire' },
  'mkt-popups': { task_group: 'acquire' },
  'mkt-signup': { task_group: 'acquire' },
  'mkt-free-tools': { task_group: 'acquire' },
  'mkt-community-marketing': { task_group: 'community' },
  'mkt-referrals': { task_group: 'community' },
  'mkt-co-marketing': { task_group: 'community' },
  'mkt-onboarding': { task_group: 'lifecycle' },
  'mkt-sms': { task_group: 'lifecycle' },
  'yixiaoer': { task_group: 'cn_social' },
  'mcp-postiz': { task_group: 'global_social', availability: 'needs_config' },
  'mkt-programmatic-seo': { task_group: 'seo_scale', major_category: 'geo', geo_stage: 'geo_distribution', hub_recommend_stars: 4 },
  'mkt-schema': { task_group: 'seo_scale', major_category: 'geo', geo_stage: 'geo_technical', hub_recommend_stars: 4 },
  'mkt-directory-submissions': { task_group: 'seo_scale' },
  'mkt-aso': { task_group: 'app_store', hidden_in_hub: true },
  github: { stage: 'development', major_category: 'development', category_subtag: 'dev_platform', hidden_in_hub: true },
  obsidian: { stage: 'office', major_category: 'office', category_subtag: 'office_collab', hidden_in_hub: true },
  notion: { stage: 'office', major_category: 'office', category_subtag: 'office_collab', hidden_in_hub: true },
  tmux: { stage: 'development', major_category: 'development', category_subtag: 'dev_platform', hidden_in_hub: true },
  'react-next-best-practices': { stage: 'development', major_category: 'development', category_subtag: 'dev_frontend', hidden_in_hub: true },
  'dev-next-best-practices': { stage: 'development', major_category: 'development', category_subtag: 'dev_frontend' },
  humanizer: { stage: 'creation', major_category: 'creation', category_subtag: 'polish', secondary_categories: ['creation', 'marketing'], task_group: 'copy' },
  unslop: { stage: 'creation', major_category: 'creation', category_subtag: 'polish', secondary_categories: ['creation', 'marketing'], task_group: 'copy' },
  'nova-bento-slides': { stage: 'office', major_category: 'office', category_subtag: 'office_slides', secondary_categories: ['creation'], task_group: 'deck_report', hub_sort: 0, hub_recommend_stars: 5, integration_level: 'L2' },
  'anth-pptx': { stage: 'office', major_category: 'office', category_subtag: 'office_slides', secondary_categories: ['office'], hub_sort: 1, hub_recommend_stars: 5, integration_level: 'L2' },
  'anth-mcp-builder': { stage: 'development', major_category: 'development', category_subtag: 'dev_mcp' },
  'anth-canvas-design': { stage: 'creation', major_category: 'creation', category_subtag: 'create_visual' },
  'brainstorm-structured': { stage: 'brainstorming', major_category: 'brainstorming', category_subtag: 'methodology' },
  'df-podcast-generation': { stage: 'creation', major_category: 'creation', category_subtag: 'create_audio', secondary_categories: ['marketing'], task_group: 'lifecycle' },
  'mkt-go-live-checklist': {
    stage: 'distribute',
    task_group: 'go_live',
    availability: 'available',
    secondary_categories: ['media'],
    secondary_media_lanes: ['media_digital'],
    secondary_media_workflow_steps: ['dig_launch'],
  },
  'mkt-analytics': { task_group: 'metrics' },
  'mkt-ab-testing': { task_group: 'experiment' },
  'mkt-cro': { task_group: 'experiment' },
  'mkt-seo-audit': { task_group: 'seo_visibility', major_category: 'geo', geo_stage: 'geo_technical', hub_recommend_stars: 4 },
  'mkt-ai-seo': {
    major_category: 'geo',
    geo_stage: 'geo_baseline',
    hub_sort: 4,
    hub_recommend_stars: 5,
    stage: 'measure',
    task_group: 'seo_visibility',
  },
  'mcp-creatorcrawl': {
    task_group: 'data_feed',
    secondary_task_groups: ['brand_sentiment'],
    secondary_stages: ['research'],
    availability: 'needs_config',
  },
  'mkt-churn-prevention': { task_group: 'retention' },
  'df-data-analysis': { task_group: 'reporting' },
  'df-chart-visualization': { task_group: 'reporting' },
  'ala-data-analyst': { task_group: 'reporting', hidden_in_hub: true },
  'ala-visualization-expert': { task_group: 'reporting', hidden_in_hub: true },
  'karpathy-guidelines': { stage: 'development', major_category: 'development', category_subtag: 'dev_frontend' },
  'minimax-pdf': { stage: 'office', major_category: 'office', category_subtag: 'office_docs' },
  'persona-steve-jobs': { stage: 'brainstorming', major_category: 'brainstorming', category_subtag: 'celebrity_mind', hub_sort: 3 },
  'persona-elon-musk': { stage: 'brainstorming', major_category: 'brainstorming', category_subtag: 'celebrity_mind', hub_sort: 4 },
  'persona-feynman': { stage: 'brainstorming', major_category: 'brainstorming', category_subtag: 'celebrity_mind', hub_sort: 6 },
  'persona-naval': { stage: 'brainstorming', major_category: 'brainstorming', category_subtag: 'celebrity_mind', hub_sort: 7 },
  'persona-taleb': { stage: 'brainstorming', major_category: 'brainstorming', category_subtag: 'celebrity_mind', hub_sort: 8 },
  'persona-zizek': { stage: 'brainstorming', major_category: 'brainstorming', category_subtag: 'celebrity_mind', hub_sort: 9 },
  'persona-trump': { stage: 'brainstorming', major_category: 'brainstorming', category_subtag: 'celebrity_mind', hub_sort: 10 },
  'persona-zhang-yiming': { stage: 'brainstorming', major_category: 'brainstorming', category_subtag: 'celebrity_mind', hub_sort: 11 },
  'diagram-maker': {
    stage: 'creation',
    major_category: 'creation',
    category_subtag: 'create_visual',
    secondary_categories: ['office', 'development'],
    hub_sort: 55,
  },
  'fc-firecrawl-cli': { stage: 'research', major_category: 'marketing', task_group: 'web_fetch', availability: 'needs_config', hidden_in_hub: false, hub_sort: 14 },
  'fc-firecrawl-search': { stage: 'research', major_category: 'marketing', task_group: 'web_fetch', availability: 'needs_config', hidden_in_hub: false, hub_sort: 15 },
  'fc-firecrawl-scrape': { stage: 'research', major_category: 'marketing', task_group: 'web_fetch', availability: 'needs_config', hidden_in_hub: true },
  'web-just-scrape': { stage: 'research', major_category: 'marketing', task_group: 'web_fetch', availability: 'needs_config', hub_sort: 17 },
  'create-frontend-design': { stage: 'creation', major_category: 'creation', category_subtag: 'create_web', hub_sort: 12 },
  'create-ui-ux-pro-max': { stage: 'creation', major_category: 'creation', category_subtag: 'create_web', hub_sort: 14 },
  'remotion-best-practices': { stage: 'creation', major_category: 'creation', category_subtag: 'create_video', hub_sort: 10 },
  'remotion-video': { stage: 'creation', major_category: 'creation', category_subtag: 'create_video', hub_sort: 11 },
  'create-ai-video-gen': { stage: 'creation', major_category: 'creation', category_subtag: 'create_video', hub_sort: 13, availability: 'needs_config' },
  'legal-risk-assessment': { stage: 'office', major_category: 'office', category_subtag: 'legal_compliance', hub_sort: 5 },
  'legal-response': { stage: 'office', major_category: 'office', category_subtag: 'legal_compliance', hub_sort: 6 },
  'edu-fun-caveman': { stage: 'education', major_category: 'education', education_bands: ['edu_fun'], hub_sort: 5 },
  'mkt-sales-enablement': { stage: 'activate', major_category: 'marketing', task_group: 'sales_enablement', hub_sort: 6 },
  'mkt-competitive-intel': { secondary_task_groups: ['sales_enablement'], secondary_stages: ['activate'], hub_sort: 7 },
  'pms-competitive-battlecard': { stage: 'strategy', major_category: 'marketing', task_group: 'sales_enablement', secondary_stages: ['activate'], secondary_categories: ['brainstorming'], hidden_in_hub: false, hub_sort: 8 },
  'brainstorm-structured': { stage: 'brainstorming', major_category: 'brainstorming', category_subtag: 'methodology', hub_sort: 3 },
  ...FINANCE_SLUG_TAXONOMY,
  ...ENTERPRISE_COMPLIANCE_SLUG_TAXONOMY,
  ...ENTERPRISE_CONSULT_SLUG_TAXONOMY,
};

export const VIRTUAL_CAPABILITIES = [
  { slug: 'tool-web-search', display_name: '联网搜索', task_summary: '上网查资料、搜新闻与公开信息', description: '适合调研阶段补充网页与新闻来源，建议与事实核查一起用。', stage: 'research', major_category: 'marketing', task_group: 'web_fetch', integration_level: 'L2', availability: 'needs_config', setup_hint: '在设置中配置联网搜索（如博查 Key），保存后重启。', hub_sort: 15, examples: ['围绕「AI 视频工具」做联网调研，列出 5 条来源与要点，直接开始做，做完告诉我文件在哪。'], source: 'builtin:web_search' },
  { slug: 'mcp-firecrawl', display_name: '网页抓取调研', task_summary: '抓取竞品官网与公开页面内容', description: '把网页转成结构化文字，便于写竞品与行业报告。', stage: 'research', major_category: 'marketing', task_group: 'web_fetch', integration_level: 'L3', availability: 'needs_config', setup_hint: '先在设置里填写 Firecrawl 密钥，保存后重启再试。', hub_sort: 16, examples: ['抓取 competitor.com/pricing 页面，做定价对比表，直接开始做，做完告诉我文件在哪。'], source: 'mcp:firecrawl' },
  { slug: 'mcp-playwright', display_name: '浏览器自动化 MCP', task_summary: 'Microsoft Playwright 驱动浏览器测试与抓取', description: '适合 E2E 测试、表单填写与页面截图；与 dev-playwright Skill 互补。', stage: 'development', major_category: 'development', category_subtag: 'dev_test', integration_level: 'L3', availability: 'ready', setup_hint: '在 mcp.json 启用 @playwright/mcp；首次可运行 npm run install:browser。', hub_sort: 8, examples: ['打开示例站点并完成登录表单填写截图，直接开始做，做完告诉我文件在哪。'], source: 'mcp:playwright' },
  { slug: 'mcp-exa', display_name: '智能联网调研', task_summary: '用 AI 搜索找高质量网页与论文', description: '适合深度调研与行业扫描，结果带摘要。', stage: 'research', major_category: 'marketing', task_group: 'web_fetch', integration_level: 'L3', availability: 'needs_config', setup_hint: '先在设置里填写 Exa 密钥，保存后重启再试。', hub_sort: 17, examples: ['调研「2025 中国银发经济消费」公开资料，附参考链接，直接开始做，做完告诉我文件在哪。'], source: 'mcp:exa' },
  { slug: 'mkt-campaign-plan', display_name: '活动全案', task_summary: '写完整活动方案：目标、渠道、日历与 KPI', description: '适合大促、新品上市，一次输出可执行的 Campaign Brief。', stage: 'strategy', major_category: 'marketing', task_group: 'campaign_full', integration_level: 'L1', availability: 'pending', hub_sort: 3, examples: ['为「618 美妆品类」写 6 周活动全案，含目标、人群、渠道、内容日历与 KPI，直接开始做，做完告诉我文件在哪。'], source: 'virtual:knowledge-work/campaign-plan' },
  { slug: 'mkt-brand-strategy', display_name: '品牌策略', task_summary: '定品牌定位、语气与核心信息', description: '输出品牌屋、术语表与调性说明，供后续创意统一使用。', stage: 'strategy', major_category: 'marketing', task_group: 'brand_geo', integration_level: 'L1', availability: 'pending', hub_sort: 10, examples: ['为【品牌名】梳理定位、目标人群、品牌语气与禁用表述，直接开始做，做完告诉我文件在哪。'], source: 'virtual:brand-guidelines' },
  { slug: 'mkt-campaign-budget', display_name: '活动预算表', task_summary: '做渠道预算与排期 Excel 表', description: '按渠道、金额、周期列出预算，方便审批与执行。', stage: 'strategy', major_category: 'finance', task_group: 'deliverable', secondary_categories: ['marketing', 'office'], category_subtag: 'fin_pricing_revops', integration_level: 'L1', availability: 'pending', hub_sort: 50, examples: ['做 618 大促预算表：渠道、金额、CPM、备注，输出 Excel，直接开始做，做完告诉我文件在哪。'], source: 'virtual:anthropics/xlsx' },
  { slug: 'mkt-strategy-deck', display_name: '策略汇报 PPT', task_summary: '把策略方案做成可汇报的演示稿', description: '适合内部汇报与客户提案，输出可编辑 PPT。', stage: 'strategy', major_category: 'marketing', task_group: 'deliverable', secondary_categories: ['office'], category_subtag: 'office_slides', integration_level: 'L1', availability: 'pending', hub_sort: 51, examples: ['把营销策略整理成 12 页汇报 PPT，直接开始做，做完告诉我文件在哪。'], source: 'virtual:anthropics/pptx' },
  { slug: 'mkt-brand-review', display_name: '品牌审稿', task_summary: '按品牌语气检查文案是否一致', description: '出稿前质检，避免语气跑偏或用词不合规范。', stage: 'create', major_category: 'marketing', task_group: 'brand_qc', integration_level: 'L1', availability: 'pending', hub_sort: 2, examples: ['按品牌规范审查下面这段社媒文案，列出修改建议，直接开始做。'], source: 'virtual:brand-review' },
  { slug: 'tool-generate-image', display_name: '营销生图', task_summary: '按描述生成广告图、海报配图', description: '调用已配置的生图模型，产出 PNG/JPG 素材。', stage: 'create', major_category: 'marketing', task_group: 'ad_visual', integration_level: 'L2', availability: 'needs_config', setup_hint: '在设置中配置生图模型与 API Key。', hub_sort: 18, examples: ['为春季露营装备生成 3 张 16:9 主视觉，直接开始做，做完告诉我文件在哪。'], source: 'builtin:generate_image' },
  { slug: 'tool-generate-video', display_name: '营销生视频', task_summary: '按描述生成短视频片段', description: '调用已配置的视频模型，适合社媒短片。', stage: 'create', major_category: 'marketing', task_group: 'video', integration_level: 'L2', availability: 'needs_config', setup_hint: '在设置中配置视频模型与 API Key。', hub_sort: 21, examples: ['生成一段 8 秒产品开场视频，节奏快，适合抖音，直接开始做，做完告诉我文件在哪。'], source: 'builtin:generate_video' },
  { slug: 'tool-generate-speech', display_name: '语音合成', task_summary: '把文字转成旁白/配音 MP3', description: '调用通义 CosyVoice 等 TTS，与对话模型共用 DashScope Key。', stage: 'create', major_category: 'marketing', task_group: 'audio', integration_level: 'L2', availability: 'needs_config', setup_hint: '在能力接入中心配置语音合成（CosyVoice / Fun-ASR 与模型池共用 Key）。', hub_sort: 19, examples: ['把下面这段文案配中文男声旁白，输出 mp3，直接开始做，做完告诉我文件在哪。'], source: 'builtin:generate_speech' },
  { slug: 'tool-transcribe-audio', display_name: '语音转写', task_summary: '把录音/播客转成文字', description: '调用 Fun-ASR 等识别模型，适合会议纪要。', stage: 'create', major_category: 'marketing', task_group: 'audio', integration_level: 'L2', availability: 'needs_config', setup_hint: '在能力接入中心配置语音识别（与模型池共用 DashScope Key）。', hub_sort: 20, examples: ['转写 uploads/meeting.mp3 并写三条纪要，直接开始做，做完告诉我文件在哪。'], source: 'builtin:transcribe_audio' },
  { slug: 'tool-render-html-video', display_name: 'HTML 转视频', task_summary: '把 HTML 动画页面导出为 MP4', description: '适合数据亮点片头、简单动效视频。', stage: 'create', major_category: 'marketing', task_group: 'video', integration_level: 'L2', availability: 'needs_config', setup_hint: '本机需安装 Playwright 与 ffmpeg。', hub_sort: 22, examples: ['把 HTML 页面导出为 10 秒 1080p 视频，直接开始做，做完告诉我文件在哪。'], source: 'builtin:render_html_video' },
  { slug: 'tool-compose-images-document', display_name: '图像合成文档', task_summary: '把多张图片合成 PDF 或 PPT（每页一图）', description: '本机能力，适合把截图、海报序列打包成 PDF 或演示稿；页内为整图，文字不可编辑。', stage: 'create', major_category: 'marketing', task_group: 'deliverable', secondary_categories: ['office'], category_subtag: 'office_slides', integration_level: 'L2', availability: 'ready', setup_hint: '本机能力，把多张图片合成 PDF 或 PPT（每页一图）。需 Python 才能导出 PPT。', hub_sort: 24, examples: ['把这三张 PNG 按顺序合成一份 PDF，直接开始做，做完告诉我文件在哪。'], source: 'builtin:compose_images_to_document' },
  { slug: 'tool-ocr-editable-pptx', display_name: '图片转可编辑 PPT', task_summary: '识别截图/扫描件上的文字，生成可改字的 PPT', description: '适合把截图、扫描 PDF 转成可编辑文本框的演示稿；未配置识别服务时可尝试通义视觉（效果较弱）。', stage: 'create', major_category: 'marketing', task_group: 'deliverable', secondary_categories: ['office'], category_subtag: 'office_slides', integration_level: 'L2', availability: 'needs_config', setup_hint: '在设置里填写「版面识别服务 Token」；未配置时可尝试通义视觉（效果较弱）。', hub_sort: 26, examples: ['把这张中文截图转成能改字的 PPT，直接开始做，做完告诉我文件在哪。'], source: 'builtin:ocr_to_editable_pptx' },
  { slug: 'tool-export-document', display_name: '一键导出办公文档', task_summary: '预览区彩色按钮或对话导出 PDF、Word、PPT、Excel', description: '在成果预览/右栏点彩色图标即可导出；也支持 Markdown/HTML 报告、配图幻灯整套 PDF/PPT。多图合成与 OCR 可编辑 PPT 分别见「图像合成文档」「图片转可编辑 PPT」。', stage: 'create', major_category: 'office', category_subtag: 'office_docs', integration_level: 'L2', availability: 'ready', ui_export: true, companion_tools: ['compose_images_to_document', 'ocr_to_editable_pptx'], setup_hint: '预览区彩色导出按钮；高保真 HTML 可在设置中配置 Nutrient Key（可选）。', hub_sort: 20, examples: ['打开 artifacts 里的报告，在预览工具栏点 PDF 图标导出，直接开始做，做完告诉我文件在哪。'], source: 'builtin:export_document' },
  { slug: 'tool-parse-attachment', display_name: '分析对话附件', task_summary: '上传 PDF/Word/Excel/PPT 后自动提取可读文本供问答', description: '对话里上传办公附件即可，无需手动解析；扫描件需配置版面识别 Token 作 fallback。', stage: 'create', major_category: 'office', category_subtag: 'office_docs', integration_level: 'L2', availability: 'ready', hub_sort: 21, examples: ['我上传了季度报告 PDF，请总结前三条结论，直接开始做。'], source: 'virtual:document-import' },
  { slug: 'mkt-brand-video', display_name: '品牌视频模板', task_summary: '用模板化方式做品牌短片结构', description: '适合片头、数据亮点等可重复使用的视频结构。', stage: 'create', major_category: 'marketing', task_group: 'video', secondary_categories: ['creation'], integration_level: 'L1', availability: 'pending', hub_sort: 23, examples: ['做 15 秒数据亮点片头结构说明与分镜，直接开始做，做完告诉我文件在哪。'], source: 'virtual:remotion-dev/remotion' },
  { slug: 'mkt-pitch-deck', display_name: '比稿演示稿', task_summary: '输出可编辑的比稿 PPT', description: '适合客户提案与比稿，比 HTML Deck 更易改稿。', stage: 'create', major_category: 'marketing', task_group: 'deck_report', secondary_categories: ['office'], integration_level: 'L1', availability: 'pending', hub_sort: 25, examples: ['为新品发布做 10 页比稿 PPT，直接开始做，做完告诉我文件在哪。'], source: 'virtual:anthropics/pptx' },
  { slug: 'mkt-campaign-report', display_name: '结案报告', task_summary: '把活动结果整理成 PDF 或 Word 报告', description: '写完 Markdown/HTML 后优先用「一键导出办公文档」交付 PDF/Word；复杂版式再用 anth-docx/pdf 深度编辑。', stage: 'create', major_category: 'marketing', task_group: 'deck_report', secondary_categories: ['office'], integration_level: 'L1', availability: 'ready', hub_sort: 30, examples: ['根据下面数据写活动结案报告并导出 PDF，直接开始做，做完告诉我文件在哪。'], source: 'virtual:anthropics/pdf' },
  { slug: 'mcp-figma', display_name: '设计稿协作', task_summary: '读取 Figma 设计稿辅助改稿', description: '提取颜色、组件与布局，配合落地页与物料制作。', stage: 'create', major_category: 'marketing', task_group: 'design_collab', integration_level: 'L3', availability: 'needs_config', setup_hint: '先在设置里填写 Figma 令牌，保存后重启再试。', hub_sort: 32, examples: ['读取 Figma 文件首页 Frame，总结品牌色与组件规范，直接开始做。'], source: 'mcp:figma' },
  { slug: 'mcp-postiz', display_name: '海外社媒发布', task_summary: '排期 LinkedIn、X 等海外平台草稿', description: '默认只建草稿，不自动公开发布。', stage: 'distribute', major_category: 'marketing', task_group: 'global_social', integration_level: 'L3', availability: 'needs_config', setup_hint: '先在设置里填写 Postiz 密钥，保存后重启再试。', hub_sort: 2, examples: ['草拟一条 LinkedIn 帖，不要发布，只返回草稿，直接开始做。'], source: 'mcp:postiz' },
  { slug: 'mkt-go-live-checklist', display_name: '上线检查清单', task_summary: '列出发布前要核对的事项', description: '覆盖 SEO、结构化数据与渠道就绪情况。', stage: 'distribute', major_category: 'marketing', task_group: 'go_live', integration_level: 'L1', availability: 'pending', hub_sort: 7, examples: ['为新品官网整理上线检查清单，直接开始做，做完告诉我文件在哪。'], source: 'virtual:go-live-checklist' },
  { slug: 'mcp-ads', display_name: '投放数据', task_summary: '读取广告与分析账户数据', description: '建议先只读 GA4、搜索控制台等，用于复盘。', stage: 'measure', major_category: 'marketing', task_group: 'data_feed', integration_level: 'L3', availability: 'needs_config', setup_hint: '先在设置里连接广告与分析账户（建议先只读）。', hub_sort: 7, examples: ['查过去 28 天自然流量与付费流量趋势，直接开始做，做完告诉我结论。'], source: 'mcp:ads' },
  { slug: 'mcp-seo-data', display_name: 'SEO 数据', task_summary: '查关键词、排名与 SERP 数据', description: '用于 SEO 审计与监测复盘。', stage: 'measure', major_category: 'marketing', task_group: 'data_feed', integration_level: 'L3', availability: 'needs_config', setup_hint: '先在设置里填写 SEO 数据服务密钥。', hub_sort: 8, examples: ['查「预制菜」搜索量与 SERP 特征，写入报告一节，直接开始做。'], source: 'mcp:seo-data' },
  { slug: 'mcp-creatorcrawl', display_name: '社媒数据', task_summary: '看竞品在 TikTok、抖音等的表现', description: '抓取公开互动数据，辅助监测与调研。', stage: 'measure', major_category: 'marketing', task_group: 'data_feed', integration_level: 'L3', availability: 'needs_config', setup_hint: '先在设置里填写 CreatorCrawl 密钥。', hub_sort: 9, examples: ['查品牌 X 抖音近 10 条视频互动数据并写小结，直接开始做。'], source: 'mcp:creatorcrawl' },
  { slug: 'mcp-similarweb', display_name: '竞品流量调研', task_summary: '查网站流量、来源与竞品对比', description: '适合行业与竞争情报，需 Similarweb API。', stage: 'research', major_category: 'marketing', task_group: 'competitive_intel', integration_level: 'L3', availability: 'needs_config', setup_hint: '在设置 → MCP 中配置 Similarweb 密钥，保存后重启。', hub_sort: 18, examples: ['对比我们与竞品官网近 3 个月流量来源，直接开始做，做完告诉我文件在哪。'], source: 'mcp:similarweb' },
  { slug: 'mcp-google-workspace', display_name: 'Google 办公套件', task_summary: '读写 Google 文档、表格与日历', description: '适合办公 Tab 与营销成果协作。', stage: 'office', major_category: 'office', category_subtag: 'office_google', integration_level: 'L3', availability: 'needs_config', setup_hint: '在 MCP 配置中完成 Google OAuth 或服务账号授权。', hub_sort: 10, examples: ['把下面活动 Brief 写入 Google 文档并分享链接，直接开始做。'], source: 'mcp:google-workspace' },
  {
    slug: 'mcp-notion-collab',
    ...MCP_NOTION_COLLAB_HUB_PATCH,
    stage: 'office',
    major_category: 'office',
    category_subtag: 'office_collab',
    integration_level: 'L3',
    availability: 'needs_config',
    hub_sort: 11,
    source: 'mcp:notion-collab',
  },
  {
    slug: 'mcp-im-notify',
    display_name: '消息通知（企微/钉钉/WhatsApp）',
    task_summary: '向企业微信、钉钉或 WhatsApp 发送一条文字通知',
    description: '出站通知 MCP：管理员在后台「消息通道」配置后可用。不是 App 内双向聊天。',
    stage: 'office',
    major_category: 'office',
    category_subtag: 'office_collab',
    integration_level: 'L3',
    availability: 'needs_config',
    setup_hint: '后台 → 平台 → 消息通道 → 出站通知（见 docs/im-channels-admin-guide.zh-CN.md）。',
    hub_sort: 12,
    hub_recommend_stars: 4,
    examples: [
      '管理员已配置通知通道后：请把「报告已完成」发到企微群。\n\n【你在做什么】调用消息通知 MCP 向已配置通道发送一条文字。\n\n【请填写】\n- 通道：【企微 / 钉钉 / WhatsApp】\n- 正文：【要发送的内容】\n\n【请准备】需管理员已在后台「消息通道」配好对应通道。\n\n【你会得到】发送成功或失败的简短说明（不含密钥）。\n写入系统分配任务目录（如需留存说明可写 notify-result.md）。',
    ],
    source: 'mcp:im-notify',
  },
  { slug: 'mcp-geo-optimizer', display_name: 'GEO Optimizer MCP', task_summary: '47 项 AEO/GEO 审计与 llms.txt、schema 生成', description: '适合技术与结构阶段深度审计；需管理员配置 Python MCP。', stage: 'geo_technical', major_category: 'geo', geo_stage: 'geo_technical', integration_level: 'L3', availability: 'needs_config', setup_hint: '在 mcp.json 配置 geo-optimizer Python 服务，见 docs/geo-hub-admin-guide.zh-CN.md。', hub_sort: 2, hub_recommend_stars: 5, examples: ['对【域名】做 GEO Optimizer 全量审计并输出 llms.txt 与 schema 建议。'], source: 'mcp:geo-optimizer' },
  { slug: 'mcp-ai-seo', display_name: 'AI SEO MCP', task_summary: '8 维页面 AEO 审计与 rewrite_aeo', description: 'AutomateLab ai-seo-mcp；适合页面级 AEO 改写。', stage: 'geo_technical', major_category: 'geo', geo_stage: 'geo_technical', integration_level: 'L3', availability: 'needs_config', setup_hint: '在 mcp.json 启用 ai-seo-mcp（npx 或本地 node）。', hub_sort: 3, hub_recommend_stars: 4, examples: ['对【落地页 URL】做 8 维 AEO 审计并给出 rewrite 要点。'], source: 'mcp:ai-seo' },
  { slug: 'mcp-agent-aeo', display_name: 'AgentAEO 监测 MCP', task_summary: '四引擎 citation 探测、SOV 与修复蓝图', description: '监测 P0：补全国外 OpenAI/Gemini/Claude/Grok/Meta citation；需 AGENTAEO_API_KEY。', stage: 'geo_monitor', major_category: 'geo', geo_stage: 'geo_monitor', integration_level: 'L3', availability: 'needs_config', setup_hint: '配置 AGENTAEO_API_KEY 并启用 @agentaeo/mcp-server。', hub_sort: 1, hub_recommend_stars: 5, examples: ['对【品牌】做国外五模型 citation 探测并写入 monitor-data.json llm_coverage。'], source: 'mcp:agent-aeo' },
  { slug: 'mkt-claude-ads', display_name: 'Claude 投放助手', task_summary: 'Google/Meta 广告诊断与优化建议', description: 'batch_paid_media_ops P1；默认诊断模式，写操作须用户确认。', major_category: 'media', media_lane: 'media_digital', media_workflow_step: 'dig_optimize', integration_level: 'L2', availability: 'pending', hub_sort: 301, examples: ['诊断 Google Ads 账户结构并给出 5 条优化建议，写入任务目录。'], source: 'pending:claude-ads' },
  { slug: 'mkt-cn-ads-skills', display_name: '国内投放助手', task_summary: '巨量/腾讯/小红书投放策略与素材建议', description: 'batch_paid_media_ops P1；代表卡，子 skill hidden。', major_category: 'media', media_lane: 'media_digital', media_workflow_step: 'dig_setup', integration_level: 'L2', availability: 'pending', hub_sort: 302, examples: ['为【品牌】梳理巨量引擎账户结构与首周投放计划，写入任务目录。'], source: 'pending:cn-ads-skills' },
  { slug: 'mkt-ooh-strategy', display_name: '户外媒介策略', task_summary: 'OOH 点位、动线与情境化策略', description: 'batch_media_planning P1 · tribo OOH plugin。', major_category: 'media', media_lane: 'media_ooh', media_workflow_step: 'ooh_planning', integration_level: 'L2', availability: 'pending', hub_sort: 201, examples: ['为【城市+品牌】做户外大牌与公交点位策略，写入任务目录。'], source: 'pending:tribo-ooh' },
  { slug: 'mkt-produce-ooh', display_name: '户外创意制作', task_summary: 'OOH 3 秒可读与尺寸 manifest', description: 'batch_media_planning P1 · produce-ooh；须 SPDX 审查后 vendor。', major_category: 'media', media_lane: 'media_ooh', media_workflow_step: 'ooh_creative', integration_level: 'L2', availability: 'pending', hub_sort: 202, examples: ['按户外大牌 1920×1080 规格输出 manifest 与创意说明，写入任务目录。'], source: 'pending:produce-ooh' },
  { slug: 'mkt-ooh-traffic-checklist', display_name: '上刊监播清单', task_summary: '户外上刊与监播核对要点', description: '媒体 Tab 户外步骤 5 可选虚拟卡。', major_category: 'media', media_lane: 'media_ooh', media_workflow_step: 'ooh_traffic', integration_level: 'L1', availability: 'pending', hub_sort: 203, examples: ['整理户外上刊与监播核对清单，写入任务目录。'], source: 'virtual:ooh-traffic-checklist' },
  ...FINANCE_VIRTUAL_CAPABILITIES,
  ...ENTERPRISE_COMPLIANCE_VIRTUAL_CAPABILITIES,
  ...ENTERPRISE_MCP_BATCH1_VIRTUAL_CAPABILITIES,
];

export function resolveTaskGroup(slug, stage) {
  const explicit = SLUG_TAXONOMY[slug]?.task_group;
  if (explicit) return explicit;
  if (FLYWHEEL_STAGE_IDS.includes(stage)) return 'general';
  return 'general';
}

export function resolveMajorCategory(slug, stage) {
  const explicit = SLUG_TAXONOMY[slug]?.major_category;
  if (explicit) return explicit;
  if (SLUG_TAXONOMY[slug]?.geo_stage) return 'geo';
  if (stage === 'education') return 'education';
  if (stage === 'brainstorming') return 'brainstorming';
  if (stage === 'office' || stage === 'creation' || stage === 'development') return stage;
  if (FLYWHEEL_STAGE_IDS.includes(stage)) return 'marketing';
  return 'marketing';
}

export function applyTaxonomyToSkill(item) {
  const tax = SLUG_TAXONOMY[item.slug] || {};
  const stage = tax.stage || item.stage;
  const secondaryTaskGroups = uniqTaxonomyStrings(
    tax.secondary_task_groups || item.secondary_task_groups,
  );
  const secondaryStages = uniqTaxonomyStrings(tax.secondary_stages || item.secondary_stages);
  const base = {
    ...item,
    ...tax,
    stage,
    major_category: tax.major_category || resolveMajorCategory(item.slug, stage),
    task_group: tax.task_group || item.task_group || resolveTaskGroup(item.slug, stage),
    secondary_categories: tax.secondary_categories || item.secondary_categories || [],
    secondary_task_groups: secondaryTaskGroups,
    secondary_stages: secondaryStages,
    availability: tax.availability || item.availability || 'available',
    hidden_in_hub: tax.hidden_in_hub ?? item.hidden_in_hub ?? false,
  };
  const out = applySkillsEcosystemTaxonomy(base);
  if (tax.hidden_in_hub === false) out.hidden_in_hub = false;
  if (tax.category_subtag) out.category_subtag = tax.category_subtag;
  if (tax.task_group) out.task_group = tax.task_group;
  if (tax.stage) out.stage = tax.stage;
  if (tax.major_category) out.major_category = tax.major_category;
  if (tax.secondary_stages) out.secondary_stages = uniqTaxonomyStrings(tax.secondary_stages);
  if (tax.secondary_task_groups) {
    out.secondary_task_groups = uniqTaxonomyStrings([
      ...(out.secondary_task_groups || []),
      ...tax.secondary_task_groups,
    ]);
  }
  if (tax.secondary_categories) out.secondary_categories = uniqTaxonomyStrings(tax.secondary_categories);
  if (tax.secondary_media_lanes) out.secondary_media_lanes = uniqTaxonomyStrings(tax.secondary_media_lanes);
  if (tax.secondary_media_workflow_steps) {
    out.secondary_media_workflow_steps = uniqTaxonomyStrings(tax.secondary_media_workflow_steps);
  }
  if (tax.media_lane) out.media_lane = tax.media_lane;
  if (tax.media_workflow_step) out.media_workflow_step = tax.media_workflow_step;
  return out;
}

function uniqTaxonomyStrings(values) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.filter((v) => typeof v === 'string' && v.trim())));
}

/** 能力是否出现在某飞轮阶段（含 secondary_stages 跨阶段展示） */
export function capabilityMatchesFlywheelStage(item, stageId) {
  if (!item || !stageId) return false;
  if (item.stage === stageId) return true;
  const secondary = item.secondary_stages || [];
  return secondary.includes(stageId);
}

/** 能力是否匹配某飞轮子类 Pill（含 secondary_task_groups） */
export function capabilityMatchesFlywheelTaskGroup(item, stageId, taskGroupId) {
  if (!taskGroupId || taskGroupId === 'all') return true;
  if (!capabilityMatchesFlywheelStage(item, stageId)) return false;
  const primary = item.task_group || 'general';
  const secondary = item.secondary_task_groups || [];
  return primary === taskGroupId || secondary.includes(taskGroupId);
}

function matchesDualSubtag(item, majorCategory, subtag) {
  if (majorCategory === 'office' && subtag === 'office_sheets') {
    if (item.slug === 'mkt-campaign-budget' || item.slug === 'anth-xlsx') return true;
  }
  if (majorCategory === 'creation' && subtag === 'create_video') {
    if (item.slug === 'od-digits-fintech') return true;
  }
  if (majorCategory === 'brainstorming' && subtag === 'celebrity_mind') {
    if (
      item.slug === 'persona-buffett'
      || item.slug === 'persona-duan-yongping'
      || item.slug === 'persona-munger'
    ) {
      return true;
    }
  }
  if (majorCategory === 'finance' && subtag === 'fin_investment_mind') {
    if (
      item.slug === 'persona-buffett'
      || item.slug === 'persona-duan-yongping'
      || item.slug === 'persona-munger'
    ) {
      return true;
    }
  }
  return false;
}

function matchesBrainstormingSubtag(item, subtag) {
  if (subtag === 'celebrity_mind') {
    return item.slug?.startsWith('persona-') || item.slug === 'celebrity-mind';
  }
  if (subtag === 'methodology') {
    if (item.major_category === 'finance') return false;
    return (
      item.category_subtag === 'methodology'
      || item.slug?.startsWith('pms-')
      || item.slug?.startsWith('pmd-')
      || item.slug?.startsWith('hub-pack-pm-')
      || item.slug === 'brainstorm-structured'
    );
  }
  if (subtag === 'enterprise_consult') {
    return (
      item.category_subtag === 'enterprise_consult'
      || item.slug?.startsWith('consult-')
    );
  }
  return item.category_subtag === subtag;
}

export function matchesHubFilter(item, majorCategory, activeStage, activeEducationBand, activeTaskGroup, activeCategorySubtag) {
  if (item.hidden_in_hub) return false;
  if (!matchesMajorCategory(majorCategory, item)) return false;

  if (majorCategory === 'geo') {
    if (activeStage && activeStage !== 'all') {
      return item.geo_stage === activeStage;
    }
    return true;
  }

  if (majorCategory === 'media') {
    const lane = activeTaskGroup && activeTaskGroup !== 'all' ? activeTaskGroup : 'all';
    const step = activeStage && activeStage !== 'all' ? activeStage : 'all';
    if (!capabilityMatchesMediaLane(item, lane)) return false;
    if (!capabilityMatchesMediaStep(item, step)) return false;
    return true;
  }

  if (majorCategory === 'marketing') {
    if (!capabilityMatchesFlywheelStage(item, activeStage)) return false;
    if (!capabilityMatchesFlywheelTaskGroup(item, activeStage, activeTaskGroup)) return false;
    return true;
  }

  if (majorCategory === 'education') {
    if (item.stage !== 'education') return false;
    if (activeEducationBand) {
      const bands = item.education_bands || [];
      if (!bands.includes(activeEducationBand)) return false;
    }
    return true;
  }

  if (majorCategory === 'brainstorming' && activeCategorySubtag !== 'all') {
    if (!matchesBrainstormingSubtag(item, activeCategorySubtag)) return false;
    return true;
  }

  if (activeCategorySubtag !== 'all' && item.category_subtag !== activeCategorySubtag) {
    if (!matchesDualSubtag(item, majorCategory, activeCategorySubtag)) return false;
  }
  return true;
}

export function matchesMajorCategory(majorCategory, item) {
  if (majorCategory === 'geo') {
    return item.major_category === 'geo';
  }
  if (majorCategory === 'media') {
    if (item.major_category === 'media') return true;
    return Array.isArray(item.secondary_categories) && item.secondary_categories.includes('media');
  }
  if (majorCategory === 'marketing') {
    const inFlywheel = FLYWHEEL_STAGE_IDS.includes(item.stage || '');
    if (!inFlywheel) return false;
    if (item.major_category === 'marketing' || !item.major_category) return true;
    return Array.isArray(item.secondary_categories) && item.secondary_categories.includes('marketing');
  }
  if (majorCategory === 'finance') {
    if (item.major_category === 'finance') return true;
    return Array.isArray(item.secondary_categories) && item.secondary_categories.includes('finance');
  }
  if (majorCategory === 'enterprise_compliance') {
    if (item.major_category === 'enterprise_compliance') return true;
    if (item.stage === 'enterprise_compliance') return true;
    return (
      Array.isArray(item.secondary_categories)
      && item.secondary_categories.includes('enterprise_compliance')
    );
  }
  if (majorCategory === 'education') {
    return item.major_category === 'education' || item.stage === 'education';
  }
  if (majorCategory === 'brainstorming') {
    if (item.major_category === 'brainstorming' || item.stage === 'brainstorming') return true;
    return Array.isArray(item.secondary_categories) && item.secondary_categories.includes('brainstorming');
  }
  if (majorCategory === 'office' || majorCategory === 'creation' || majorCategory === 'development') {
    if (item.major_category === majorCategory) return true;
    return Array.isArray(item.secondary_categories) && item.secondary_categories.includes(majorCategory);
  }
  return false;
}
