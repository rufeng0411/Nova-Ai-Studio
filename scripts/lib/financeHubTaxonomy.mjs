/**
 * PD-SAAS-FORK: 金融 Tab 二级分类（现代金融学 × AI 金融数字化）
 * 产品经理 + 金融数字化专家视角：投研建模 → 指标 → 估值 → 定价 → FP&A → 战略 → 金融科技 → 投资思维
 */

/** @param {string} subtag @param {Record<string, unknown>} [extra] */
function fin(subtag, extra = {}) {
  return {
    major_category: 'finance',
    category_subtag: subtag,
    hidden_in_hub: false,
    ...extra,
  };
}

export const FINANCE_SUBTAGS = [
  { id: 'fin_ai_model', label: 'AI 投研与建模', subtag_order: 1, summary: 'AI 辅助 DCF、可比估值、股权研究与财务预测' },
  { id: 'fin_unit_economics', label: '单位经济与 SaaS 指标', subtag_order: 2, summary: 'ARR/NRR/LTV/CAC、队列留存与变现效率' },
  { id: 'fin_valuation', label: '估值与市场规模', subtag_order: 3, summary: 'TAM/SAM/SOM、相对估值与分部估值' },
  { id: 'fin_pricing_revops', label: '定价·预算与 RevOps', subtag_order: 4, summary: '定价策略、收入运营、活动与 FP&A 预算' },
  { id: 'fin_fpa_model', label: '财务模型与 FP&A', subtag_order: 5, summary: 'Excel 三表/模型、指标看板与经营分析报告' },
  { id: 'fin_research_strategy', label: '行业研究与公司战略', subtag_order: 6, summary: '宏观/行业/竞品、商业模式与 GTM 金融视角' },
  { id: 'fin_fintech_digital', label: '金融科技与数字化', subtag_order: 7, summary: '银行/支付/财富/RegTech 产品体验与界面' },
  { id: 'fin_investment_mind', label: '投资思维', subtag_order: 8, summary: '价值投资框架与决策人格视角' },
];

/** 已有 skills + 上文推荐可继承能力（virtual pending） */
export const FINANCE_SLUG_TAXONOMY = {
  // —— AI 投研与建模 ——
  'fin-dcf-two-stage': fin('fin_ai_model', { hub_sort: 1, hub_recommend_stars: 5, integration_level: 'L1', availability: 'pending' }),
  'fin-relative-valuation': fin('fin_ai_model', { hub_sort: 2, hub_recommend_stars: 4, availability: 'pending' }),
  'fin-sotp-breakup': fin('fin_ai_model', { hub_sort: 3, hub_recommend_stars: 4, availability: 'pending' }),
  'fin-equity-research-report': fin('fin_ai_model', { hub_sort: 4, hub_recommend_stars: 5, availability: 'pending' }),
  'fin-financial-analyst': fin('fin_ai_model', { hub_sort: 5, hub_recommend_stars: 5, availability: 'pending' }),
  'fin-yfinance-market-data': fin('fin_ai_model', { hub_sort: 6, hub_recommend_stars: 3, availability: 'pending' }),
  'df-data-analysis': fin('fin_ai_model', {
    task_group: 'reporting',
    secondary_categories: ['marketing'],
    hub_sort: 20,
    hub_recommend_stars: 4,
  }),
  'df-chart-visualization': fin('fin_ai_model', {
    task_group: 'reporting',
    secondary_categories: ['marketing'],
    hub_sort: 21,
    hub_recommend_stars: 4,
  }),

  // —— 单位经济与 SaaS 指标 ——
  'pmd-finance-metrics-quickref': fin('fin_unit_economics', { hub_sort: 1, hub_recommend_stars: 5 }),
  'pmd-saas-economics-efficiency-metrics': fin('fin_unit_economics', { hub_sort: 2, hub_recommend_stars: 5 }),
  'pmd-saas-revenue-growth-metrics': fin('fin_unit_economics', { hub_sort: 3, hub_recommend_stars: 5 }),
  'pms-cohort-analysis': fin('fin_unit_economics', { hub_sort: 4, hub_recommend_stars: 4, secondary_categories: ['brainstorming'] }),
  'pms-north-star-metric': fin('fin_unit_economics', { hub_sort: 5, hub_recommend_stars: 4, secondary_categories: ['brainstorming'] }),
  'pms-monetization-strategy': fin('fin_unit_economics', { hub_sort: 6, hub_recommend_stars: 4, secondary_categories: ['brainstorming'] }),
  'pmd-feature-investment-advisor': fin('fin_unit_economics', { hub_sort: 7, hub_recommend_stars: 3 }),
  'mkt-churn-prevention': fin('fin_unit_economics', {
    task_group: 'retention',
    secondary_categories: ['marketing'],
    hub_sort: 8,
    hub_recommend_stars: 3,
  }),

  // —— 估值与市场规模 ——
  'pmd-tam-sam-som-calculator': fin('fin_valuation', { hub_sort: 1, hub_recommend_stars: 5 }),
  'pms-market-sizing': fin('fin_valuation', { hub_sort: 2, hub_recommend_stars: 4, secondary_categories: ['brainstorming'] }),

  // —— 定价·预算与 RevOps ——
  'mkt-pricing': fin('fin_pricing_revops', {
    task_group: 'gtm',
    secondary_categories: ['marketing'],
    hub_sort: 1,
    hub_recommend_stars: 5,
  }),
  'mkt-revops': fin('fin_pricing_revops', {
    task_group: 'gtm',
    secondary_categories: ['marketing'],
    hub_sort: 2,
    hub_recommend_stars: 4,
  }),
  'mkt-campaign-budget': fin('fin_pricing_revops', {
    stage: 'strategy',
    task_group: 'deliverable',
    secondary_categories: ['marketing', 'office', 'media'],
    secondary_media_lanes: ['media_ooh', 'media_digital'],
    secondary_media_workflow_steps: ['ooh_strategy', 'dig_plan'],
    hub_sort: 3,
    hub_recommend_stars: 4,
  }),
  'pmd-finance-based-pricing-advisor': fin('fin_pricing_revops', {
    hub_sort: 4,
    hub_recommend_stars: 4,
    secondary_categories: ['marketing'],
  }),
  'pms-pricing-strategy': fin('fin_pricing_revops', {
    hub_sort: 5,
    hub_recommend_stars: 4,
    secondary_categories: ['brainstorming'],
  }),

  // —— 财务模型与 FP&A ——
  'fin-excel-financial-model': fin('fin_fpa_model', { hub_sort: 1, hub_recommend_stars: 5, availability: 'pending' }),
  'anth-xlsx': fin('fin_fpa_model', {
    stage: 'office',
    secondary_categories: ['office'],
    hub_sort: 2,
    hub_recommend_stars: 5,
    integration_level: 'L2',
  }),
  'pms-metrics-dashboard': fin('fin_fpa_model', { hub_sort: 3, hub_recommend_stars: 4, secondary_categories: ['brainstorming'] }),
  'pms-sql-queries': fin('fin_fpa_model', { hub_sort: 4, hub_recommend_stars: 3, secondary_categories: ['brainstorming'] }),
  'mkt-performance-report': fin('fin_fpa_model', {
    stage: 'measure',
    task_group: 'metrics',
    secondary_categories: ['marketing', 'geo', 'media'],
    secondary_media_lanes: ['media_ooh', 'media_digital'],
    secondary_media_workflow_steps: ['ooh_measure', 'dig_report'],
    geo_stage: 'geo_monitor',
    hub_sort: 5,
    hub_recommend_stars: 3,
  }),
  'mkt-analytics': fin('fin_fpa_model', { task_group: 'metrics', secondary_categories: ['marketing'], hub_sort: 6 }),
  'mkt-ab-testing': fin('fin_fpa_model', { task_group: 'experiment', secondary_categories: ['marketing'], hub_sort: 7 }),

  // —— 行业研究与公司战略 ——
  'df-consulting-analysis': fin('fin_research_strategy', {
    stage: 'research',
    task_group: 'market_landscape',
    secondary_categories: ['marketing'],
    hub_sort: 1,
    hub_recommend_stars: 4,
  }),
  'nova-research-industry-market': fin('fin_research_strategy', {
    stage: 'research',
    task_group: 'market_landscape',
    secondary_categories: ['marketing'],
    hub_sort: 2,
    hub_recommend_stars: 4,
  }),
  'pms-pestle-analysis': fin('fin_research_strategy', { hub_sort: 3, hub_recommend_stars: 4, secondary_categories: ['brainstorming'] }),
  'pms-porters-five-forces': fin('fin_research_strategy', { hub_sort: 4, hub_recommend_stars: 4, secondary_categories: ['brainstorming'] }),
  'pms-business-model': fin('fin_research_strategy', { hub_sort: 5, hub_recommend_stars: 5, secondary_categories: ['brainstorming'] }),
  'pms-competitor-analysis': fin('fin_research_strategy', { hub_sort: 6, hub_recommend_stars: 4, secondary_categories: ['brainstorming'] }),
  'pms-swot-analysis': fin('fin_research_strategy', { hub_sort: 7, hub_recommend_stars: 4, secondary_categories: ['brainstorming'], task_group: 'decision' }),
  'pms-ansoff-matrix': fin('fin_research_strategy', { hub_sort: 8, hub_recommend_stars: 3, secondary_categories: ['brainstorming'] }),
  'pms-gtm-strategy': fin('fin_research_strategy', { hub_sort: 9, hub_recommend_stars: 4, secondary_categories: ['brainstorming'] }),
  'pms-gtm-motions': fin('fin_research_strategy', { hub_sort: 10, hub_recommend_stars: 3, secondary_categories: ['brainstorming'] }),
  'pmd-company-research': fin('fin_research_strategy', { hub_sort: 11, hub_recommend_stars: 4 }),
  'pmd-pestel-analysis': fin('fin_research_strategy', { hub_sort: 12, hub_recommend_stars: 3 }),
  'pmd-business-health-diagnostic': fin('fin_research_strategy', { hub_sort: 13, hub_recommend_stars: 4 }),

  // —— 金融科技与数字化 ——
  'fin-regtech-compliance-brief': fin('fin_fintech_digital', { hub_sort: 1, hub_recommend_stars: 3, availability: 'pending' }),
  'od-digits-fintech': fin('fin_fintech_digital', {
    task_group: 'video',
    secondary_categories: ['creation'],
    hub_sort: 2,
    hub_recommend_stars: 3,
  }),

  // —— 投资思维 ——
  'fin-ib-pe-workflow': fin('fin_investment_mind', { hub_sort: 1, hub_recommend_stars: 4, availability: 'pending' }),
  'persona-buffett': fin('fin_investment_mind', {
    stage: 'brainstorming',
    secondary_categories: ['brainstorming'],
    hub_sort: 2,
  }),
  'persona-duan-yongping': fin('fin_investment_mind', {
    stage: 'brainstorming',
    secondary_categories: ['brainstorming'],
    hub_sort: 3,
  }),
  'persona-munger': fin('fin_investment_mind', {
    stage: 'brainstorming',
    secondary_categories: ['brainstorming'],
    hub_sort: 4,
  }),
};

export const FINANCE_VIRTUAL_CAPABILITIES = [
  {
    slug: 'fin-dcf-two-stage',
    display_name: 'DCF 两阶段估值',
    task_summary: '按 HBS 方法论搭建两阶段 DCF 模型与敏感性分析',
    description: '适用于上市公司/未盈利项目的贴现现金流估值，输出假设表、WACC 与估值区间。源自 cmaurer/dcf-skill 能力规划。',
    integration_level: 'L1',
    availability: 'pending',
    hub_sort: 1,
    hub_recommend_stars: 5,
    examples: ['为【目标公司】做两阶段 DCF：列营收假设、WACC、终值与敏感性表，写入系统分配任务目录。'],
    source: 'virtual:vendor/finance-dcf',
  },
  {
    slug: 'fin-relative-valuation',
    display_name: '相对估值与可比分析',
    task_summary: '选取可比公司/交易倍数完成相对估值',
    description: '覆盖 EV/Revenue、P/E、EV/EBITDA 等倍数分析与估值区间。源自 himself65/finance-skills。',
    integration_level: 'L1',
    availability: 'pending',
    hub_sort: 2,
    hub_recommend_stars: 4,
    examples: ['找【行业】5 家可比公司，做 EV/Revenue 与 P/E 倍数表并给出估值区间。'],
    source: 'virtual:vendor/finance-relative-valuation',
  },
  {
    slug: 'fin-sotp-breakup',
    display_name: 'SOTP 分部估值',
    task_summary: '按业务线/资产包拆分汇总企业价值',
    description: '适用于多元化集团或多业务 SaaS 的分部加总估值（Sum-of-the-Parts）。',
    integration_level: 'L1',
    availability: 'pending',
    hub_sort: 3,
    hub_recommend_stars: 4,
    examples: ['对【集团名】按业务线做 SOTP：各分部估值假设、汇总与折价说明。'],
    source: 'virtual:vendor/finance-sotp',
  },
  {
    slug: 'fin-equity-research-report',
    display_name: 'AI 股权研究报告',
    task_summary: '生成含财务摘要、催化剂与风险的投资研究报告',
    description: '结构化股权研究输出（投资要点、财务概览、估值与风险提示）。源自 quant-sentiment-ai/claude-equity-research 规划。',
    integration_level: 'L1',
    availability: 'pending',
    hub_sort: 4,
    hub_recommend_stars: 5,
    examples: ['写【上市公司】股权研究报告：投资要点、3 年财务摘要、估值与主要风险。'],
    source: 'virtual:vendor/finance-equity-research',
  },
  {
    slug: 'fin-financial-analyst',
    display_name: '财务比率与预算差异分析',
    task_summary: '比率分析、预算 vs 实际差异与滚动预测',
    description: '覆盖流动性/盈利/效率比率、预算差异解释与 forecast 调整建议。源自 alirezarezvani/financial-analyst 规划。',
    integration_level: 'L1',
    availability: 'pending',
    hub_sort: 5,
    hub_recommend_stars: 5,
    examples: ['根据附件财报做比率分析与预算差异说明，并给出下季度预测调整建议。'],
    source: 'virtual:vendor/finance-analyst',
  },
  {
    slug: 'fin-yfinance-market-data',
    display_name: '公开市场数据抓取',
    task_summary: '拉取股价、财报摘要与市场数据用于建模',
    description: '基于 yfinance 等数据源获取行情与基本面字段，服务 DCF/可比估值（himself65/finance-skills）。',
    integration_level: 'L1',
    availability: 'pending',
    hub_sort: 6,
    hub_recommend_stars: 3,
    examples: ['抓取【股票代码】近 3 年营收、EBITDA 与股价，整理成建模输入表。'],
    source: 'virtual:vendor/finance-yfinance',
  },
  {
    slug: 'fin-excel-financial-model',
    display_name: 'Excel 财务模型搭建',
    task_summary: '三表联动、场景分析与投资人版模型',
    description: '在 Excel 中搭建损益/资产负债/现金流联动模型。源自 tfriedel/claude-office-skills 财务模型能力规划。',
    integration_level: 'L1',
    availability: 'pending',
    hub_sort: 1,
    hub_recommend_stars: 5,
    examples: ['为【SaaS 公司】搭 3 年三表联动 Excel 模型，含 Base/Bear/Bull 场景。'],
    source: 'virtual:vendor/finance-excel-model',
  },
  {
    slug: 'fin-regtech-compliance-brief',
    display_name: 'RegTech 合规要点简报',
    task_summary: '金融科技产品合规清单与监管要点摘要',
    description: '面向支付/信贷/财富产品的合规差距与报送要点梳理（数字化合规初稿）。',
    integration_level: 'L1',
    availability: 'pending',
    hub_sort: 1,
    hub_recommend_stars: 3,
    examples: ['为【支付产品】梳理国内监管要点与合规差距清单。'],
    source: 'virtual:vendor/finance-regtech',
  },
  {
    slug: 'fin-ib-pe-workflow',
    display_name: '投行·PE 工作流指南',
    task_summary: '并购/融资/尽调阶段清单与交付物模板',
    description: '整合 IB/PE 常见阶段交付（Teaser、CIM、模型、尽调清单）。源自 cbankskills 生态规划，待 vendor。',
    integration_level: 'L1',
    availability: 'pending',
    hub_sort: 1,
    hub_recommend_stars: 4,
    examples: ['按 PE 收购【目标公司】列出尽调阶段、数据房间清单与模型交付物。'],
    source: 'virtual:vendor/finance-ib-pe',
  },
];
