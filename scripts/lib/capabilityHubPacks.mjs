/**
 * Hub-only skill packs: one card per vendor mega-skill, members hidden from Hub.
 * PD-SAAS-FORK: reduces Pill clutter; agent still read_skill's member slugs.
 */

/** @typedef {{
 *   slug: string;
 *   display_name: string;
 *   task_summary: string;
 *   description: string;
 *   member_prefix: string;
 *   stage: string;
 *   major_category: string;
 *   task_group?: string;
 *   category_subtag?: string;
 *   secondary_categories?: string[];
 *   secondary_stages?: string[];
 *   secondary_task_groups?: string[];
 *   integration_level?: string;
 *   availability?: string;
 *   setup_hint?: string;
 *   hub_sort?: number;
 *   rating?: number;
 *   examples: string[];
 * }} HubSkillPack */

/** @type {HubSkillPack[]} */
export const HUB_SKILL_PACKS = [
  {
    slug: 'hub-pack-brand-website',
    display_name: '品牌官网全案',
    task_summary: '品牌发现→定位→文案→SEO→上线',
    description: '覆盖品牌发现、识别、语气、落地页文案、SEO/AEO、转化优化与上线清单等官网全生命周期；自动选用包内子技能，无需手动挑卡片。',
    member_prefix: 'mkt-brand-',
    stage: 'strategy',
    major_category: 'marketing',
    task_group: 'brand_geo',
    secondary_categories: ['creation', 'office'],
    hub_sort: 4,
    integration_level: 'L1',
    examples: [
      '用「品牌官网全案」帮我：【写出要做的事，如：给新品牌做定位 / 写官网落地页文案 / 规划 SEO 关键词】，并附品牌背景。可做：品牌发现、定位、语气规范、落地页文案、SEO、转化优化、上线清单。',
    ],
  },
  {
    slug: 'hub-pack-ad-funnel',
    display_name: '广告漏斗全案',
    task_summary: '创意→落地页→投放→转化优化',
    description: '广告创意、漏斗架构、落地页、付费投放与转化优化等增长漏斗能力合一；按目标自动选用包内子技能。',
    member_prefix: 'mkt-adv-',
    stage: 'activate',
    major_category: 'marketing',
    task_group: 'paid',
    hub_sort: 3,
    integration_level: 'L1',
    examples: [
      '用「广告漏斗全案」帮我：【如：出 10 条广告创意 / 优化落地页转化 / 制定投放预算】，附产品与目标人群。可做：广告创意、漏斗设计、落地页、付费投放、转化优化。',
    ],
  },
  {
    slug: 'hub-pack-aso',
    display_name: '应用商店优化',
    task_summary: '关键词、元数据、截图与 ASO 审计',
    description: '应用商店关键词、元数据、截图、竞品、评论与 Apple 搜索广告等 ASO 能力合一。',
    member_prefix: 'mkt-aso-',
    stage: 'distribute',
    major_category: 'marketing',
    task_group: 'app_store',
    hub_sort: 2,
    integration_level: 'L1',
    examples: [
      '用「应用商店优化」帮我：【如：挖关键词 / 改商店标题与描述 / 审计竞品 ASO】，附应用名称与商店链接。可做：关键词、元数据、截图方案、竞品分析、评论分析、Apple 搜索广告。',
    ],
  },
  {
    slug: 'hub-pack-threejs',
    display_name: '3D 网页创作',
    task_summary: 'Three.js 场景、材质、动画与交互',
    description: 'Three.js 基础、几何、材质、光照、动画、着色器与交互等 3D 网页能力合一；按场景自动选用子技能。',
    member_prefix: 'create-threejs-',
    stage: 'creation',
    major_category: 'creation',
    category_subtag: 'create_web',
    hub_sort: 8,
    integration_level: 'L1',
    examples: [
      '用「3D网页创作」做一个【产品或场景】的 3D 展示网页：【说明风格与交互，如：可拖拽旋转、滚动驱动动画】。可做：搭场景、调材质灯光、做动画、加交互。',
    ],
  },
  {
    slug: 'hub-pack-fal-video',
    display_name: 'Fal 多模态视频',
    task_summary: 'Fal 生图生视频、工作流与模型路由',
    description: 'fal.ai 视频生成、商业广告、UGC、工作流编排与模型选型等能力合一；需配置 fal.ai Key。',
    member_prefix: 'fal-',
    stage: 'creation',
    major_category: 'creation',
    category_subtag: 'create_video',
    secondary_categories: ['marketing'],
    secondary_stages: ['create'],
    secondary_task_groups: ['video'],
    hub_sort: 6,
    integration_level: 'L2',
    availability: 'needs_config',
    setup_hint: '在设置 → 能力接入中心填写 fal.ai API Key（FAL_KEY）。',
    examples: [
      '用「Fal多模态视频」帮我：【如：生成一支 10 秒产品短片 / 把这张图变成动态视频 / 批量出 3 版广告素材】（需配置 Fal Key）。可做：文生图、图生视频、口播视频、视频工作流。',
    ],
  },
  {
    slug: 'hub-pack-pm-toolkit',
    display_name: 'PM 工具包',
    task_summary: 'PRD、路线图、竞品、实验与 GTM',
    description: 'Phuryn PM 技能包：SWOT、PRD、用户故事、优先级、竞品、实验、GTM 等产品经理常用产出合一。',
    member_prefix: 'pms-',
    stage: 'brainstorming',
    major_category: 'brainstorming',
    category_subtag: 'methodology',
    hub_sort: 1,
    integration_level: 'L1',
    examples: [
      '用「PM工具包」帮我做产品工作：【如：给笔记 App 写 PRD / 排 Q3 路线图 / 做竞品对比】，并附产品背景。可做：PRD、路线图、竞品分析、用户故事、实验设计、GTM。',
    ],
  },
  {
    slug: 'hub-pack-pm-methods',
    display_name: '产品方法论',
    task_summary: '工作坊式 OST、定位、用户故事地图',
    description: 'Dean Peters 方法论包：机会树、用户旅程、定位工作坊、问题框架等产品方法合一。',
    member_prefix: 'pmd-',
    stage: 'brainstorming',
    major_category: 'brainstorming',
    category_subtag: 'methodology',
    hub_sort: 2,
    integration_level: 'L1',
    examples: [
      '用「产品方法论」带我做一次工作坊式拆解：【选一个：机会方案树 / 用户旅程图 / 产品定位 / 用户故事地图】，对象是【产品或业务】。',
    ],
  },
];

const PACK_BY_PREFIX = new Map(
  HUB_SKILL_PACKS.map((p) => [p.member_prefix, p]),
);

const PACK_SLUGS = new Set(HUB_SKILL_PACKS.map((p) => p.slug));

export function getHubPackForSlug(slug) {
  if (!slug || typeof slug !== 'string') return null;
  for (const pack of HUB_SKILL_PACKS) {
    if (slug.startsWith(pack.member_prefix)) return pack;
  }
  return null;
}

export function isHubPackCard(slug) {
  return PACK_SLUGS.has(slug);
}

export function isHubPackMember(slug) {
  return Boolean(getHubPackForSlug(slug));
}

export function hubPackToCatalogEntry(pack, stageMap) {
  const stageMeta = stageMap.get(pack.stage) || stageMap.get('uncategorized');
  return {
    slug: pack.slug,
    name: pack.slug,
    display_name: pack.display_name,
    description: pack.description,
    task_summary: pack.task_summary,
    stage: pack.stage,
    stage_label: stageMeta?.label || '待归类',
    stage_order: stageMeta?.stage_order ?? 7,
    secondary_stages: pack.secondary_stages || [],
    secondary_task_groups: pack.secondary_task_groups || [],
    education_bands: [],
    audience: [],
    integration_level: pack.integration_level || 'L1',
    hub_sort: pack.hub_sort ?? 100,
    examples: pack.examples || [],
    source: `hub-pack:${pack.member_prefix}`,
    secondary_categories: pack.secondary_categories || [],
    availability: pack.availability || 'available',
    setup_hint: pack.setup_hint || '',
    task_group: pack.task_group,
    major_category: pack.major_category,
    category_subtag: pack.category_subtag,
    hidden_in_hub: false,
    hub_pack: true,
    pack_member_prefix: pack.member_prefix,
    ...(typeof pack.rating === 'number' ? { rating: pack.rating } : {}),
  };
}

export function buildHubPackTryPrompt(pack) {
  // Lazy import avoided — callers should use getTryPromptZh from capabilityTryPrompts.mjs
  const hints = {
    'mkt-brand-': '品牌发现、定位、语气规范、落地页文案、SEO、转化优化、上线清单',
    'mkt-adv-': '广告创意、漏斗设计、落地页、付费投放、转化优化',
    'mkt-aso-': '关键词、元数据、截图方案、竞品分析、评论分析、Apple 搜索广告',
    'create-threejs-': '搭场景、调材质灯光、做动画、加交互',
    'fal-': '文生图、图生视频、口播视频、视频工作流',
    'pms-': 'PRD、路线图、竞品分析、用户故事、实验设计、GTM',
    'pmd-': '机会树、用户旅程、定位工作坊、用户故事地图',
  };
  const hint = hints[pack.member_prefix] || '包内子技能';
  return `用「${pack.display_name}」帮我：【说明具体目标与背景】。可做：${hint}。`;
}
