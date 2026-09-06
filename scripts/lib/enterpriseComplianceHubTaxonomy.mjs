/**
 * PD-SAAS-FORK: Hub L1「企业」taxonomy（照 financeHubTaxonomy）
 * 8 L2 Pill（含公关）+ 原子 skill hidden + 前台 virtual 卡
 */

import { CN_COMPLIANCE_TRY_PROMPTS } from './cnComplianceTryPrompts.mjs';
import { CN_ENTERPRISE_PR_TRY_PROMPTS } from './cnEnterprisePrTryPrompts.mjs';

/** @param {string} subtag @param {Record<string, unknown>} [extra] */
function atom(subtag, extra = {}) {
  return {
    major_category: 'enterprise_compliance',
    category_subtag: subtag,
    stage: 'enterprise_compliance',
    hidden_in_hub: true,
    ...extra,
  };
}

/** @param {string} subtag @param {Record<string, unknown>} [extra] */
function card(subtag, extra = {}) {
  return {
    major_category: 'enterprise_compliance',
    category_subtag: subtag,
    stage: 'enterprise_compliance',
    hidden_in_hub: false,
    integration_level: 'L1',
    availability: 'available',
    ...extra,
  };
}

export const ENTERPRISE_COMPLIANCE_SUBTAGS = [
  { id: 'comp_ops_reg', label: '经营监管', subtag_order: 1, summary: '主体合规、隐私、广告与上线、监管入门' },
  { id: 'comp_contract_bid', label: '合同招投标', subtag_order: 2, summary: '商事合同审查、招标解析与标书草案' },
  { id: 'comp_tax_accounting', label: '财税会计', subtag_order: 3, summary: '发票增值税、企税与做账台账（择装后亮）' },
  { id: 'comp_hr_labor', label: '人力劳动', subtag_order: 4, summary: '录用、解除、竞业与手册审查' },
  { id: 'comp_corp_legal', label: '公司商事', subtag_order: 5, summary: '设立治理、知产软著与争议框架' },
  { id: 'comp_tax_planning', label: '合法筹划', subtag_order: 6, summary: '小微高新优惠与研发加计（择装后亮）' },
  { id: 'comp_policy_subsidy', label: '惠企政策', subtag_order: 7, summary: '国家政策检索、专精特新与申报清单' },
  { id: 'comp_pr_comms', label: '公关', subtag_order: 8, summary: '新闻通稿、媒体关系、危机与声誉、ESG/投资者口径' },
];

/** 原子 skill → 隐藏；前台只挂 virtual 卡 */
export const ENTERPRISE_COMPLIANCE_SLUG_TAXONOMY = {
  // —— 经营监管 atoms ——
  'zh-entity-compliance': atom('comp_ops_reg', { hub_sort: 10 }),
  'zh-pia-generation': atom('comp_ops_reg', { hub_sort: 11 }),
  'zh-privacy-reg-gap': atom('comp_ops_reg', { hub_sort: 12 }),
  'zh-dpa-review': atom('comp_ops_reg', { hub_sort: 13 }),
  'zh-dsar-response': atom('comp_ops_reg', { hub_sort: 14 }),
  'zh-marketing-claims-review': atom('comp_ops_reg', { hub_sort: 15 }),
  'zh-launch-review': atom('comp_ops_reg', { hub_sort: 16 }),
  'zh-feature-risk-assessment': atom('comp_ops_reg', { hub_sort: 17 }),
  'zh-is-this-a-problem': atom('comp_ops_reg', { hub_sort: 18 }),
  'zh-reg-gaps': atom('comp_ops_reg', { hub_sort: 19 }),
  'zh-reg-gap-surfacer': atom('comp_ops_reg', { hub_sort: 20 }),
  'zh-reg-policy-redraft': atom('comp_ops_reg', { hub_sort: 21 }),
  'zh-policy-drafting': atom('comp_ops_reg', { hub_sort: 22 }),
  'zhxx-ad-compliance-review': atom('comp_ops_reg', { hub_sort: 23 }),
  'zhxx-food-label-review': atom('comp_ops_reg', { hub_sort: 24 }),

  // —— 合同招投标 atoms ——
  'zh-contract-review': atom('comp_contract_bid', { hub_sort: 10 }),
  'zh-nda-review': atom('comp_contract_bid', { hub_sort: 11 }),
  'zh-saas-msa-review': atom('comp_contract_bid', { hub_sort: 12 }),
  'zh-vendor-agreement-review': atom('comp_contract_bid', { hub_sort: 13 }),
  'zh-tabular-review': atom('comp_contract_bid', { hub_sort: 14 }),
  'zhxx-contract-review': atom('comp_contract_bid', { hub_sort: 15 }),
  'zhxx-contract-gen': atom('comp_contract_bid', { hub_sort: 16 }),
  'bid-analysis': atom('comp_contract_bid', { hub_sort: 20 }),
  'bid-requirements': atom('comp_contract_bid', { hub_sort: 21 }),
  'bid-evaluation': atom('comp_contract_bid', { hub_sort: 22 }),
  'bid-commercial-proposal': atom('comp_contract_bid', { hub_sort: 23 }),
  'bid-tech-proposal': atom('comp_contract_bid', { hub_sort: 24 }),
  'bid-assembly': atom('comp_contract_bid', { hub_sort: 25 }),
  'bid-audit': atom('comp_contract_bid', { hub_sort: 26 }),
  'biaoshu-writer-pro': atom('comp_contract_bid', { hub_sort: 27 }),

  // —— 人力 atoms ——
  'zh-hiring-review': atom('comp_hr_labor', { hub_sort: 10 }),
  'zh-termination-review': atom('comp_hr_labor', { hub_sort: 11 }),
  'zh-handbook-updates': atom('comp_hr_labor', { hub_sort: 12 }),
  'zh-wage-hour-qa': atom('comp_hr_labor', { hub_sort: 13 }),
  'zh-worker-classification': atom('comp_hr_labor', { hub_sort: 14 }),

  // —— 公司商事 atoms ——
  'zh-board-minutes': atom('comp_corp_legal', { hub_sort: 10 }),
  'zh-diligence-issue-extraction': atom('comp_corp_legal', { hub_sort: 11 }),
  'zhxx-legal-risk-visualization': atom('comp_corp_legal', { hub_sort: 12 }),

  // —— 财税 atoms（vivy tax，PR-E） ——
  'tax-invoice-compliance-checker': atom('comp_tax_accounting', { hub_sort: 10 }),
  'tax-vat-rate-classification': atom('comp_tax_accounting', { hub_sort: 11 }),
  'tax-vat-credit-calculator': atom('comp_tax_accounting', { hub_sort: 12 }),
  'tax-input-tax-credit-checker': atom('comp_tax_accounting', { hub_sort: 13 }),
  'tax-eit-return-reviewer': atom('comp_tax_accounting', { hub_sort: 14 }),
  'tax-type-classifier': atom('comp_tax_accounting', { hub_sort: 15 }),
  'tax-individual-income-planner': atom('comp_tax_accounting', { hub_sort: 16 }),
  'tax-consumption-tax-compliance': atom('comp_tax_accounting', { hub_sort: 17 }),
  'tax-preference-application-advisor': atom('comp_tax_planning', { hub_sort: 10 }),
  'tax-deduction-compliance-checker': atom('comp_tax_planning', { hub_sort: 11 }),

  // —— 前台 virtual 卡（taxonomy 侧补全；VIRTUAL 列表为权威卡片） ——
  'comp-entity-compliance': card('comp_ops_reg', { hub_sort: 1, hub_recommend_stars: 5 }),
  'comp-data-privacy': card('comp_ops_reg', { hub_sort: 2, hub_recommend_stars: 5 }),
  'comp-ad-product': card('comp_ops_reg', { hub_sort: 3, hub_recommend_stars: 5 }),
  'comp-regulatory-lite': card('comp_ops_reg', { hub_sort: 4, hub_recommend_stars: 4 }),
  'comp-contract-review': card('comp_contract_bid', {
    hub_sort: 1,
    hub_recommend_stars: 5,
    secondary_categories: ['office'],
  }),
  'comp-bid-analyze': card('comp_contract_bid', { hub_sort: 2, hub_recommend_stars: 5 }),
  'comp-bid-write': card('comp_contract_bid', { hub_sort: 3, hub_recommend_stars: 5 }),
  'comp-labor-hire': card('comp_hr_labor', { hub_sort: 1, hub_recommend_stars: 5 }),
  'comp-termination': card('comp_hr_labor', { hub_sort: 2, hub_recommend_stars: 5 }),
  'comp-handbook-compete': card('comp_hr_labor', { hub_sort: 3, hub_recommend_stars: 4 }),
  'comp-social-insurance': card('comp_hr_labor', {
    hub_sort: 4,
    hub_recommend_stars: 3,
    availability: 'pending',
  }),
  'comp-labor-dispute': card('comp_hr_labor', {
    hub_sort: 5,
    hub_recommend_stars: 2,
    availability: 'pending',
    hidden_in_hub: true,
  }),
  'comp-corp-governance': card('comp_corp_legal', { hub_sort: 1, hub_recommend_stars: 5 }),
  'comp-ip-soft': card('comp_corp_legal', {
    hub_sort: 2,
    hub_recommend_stars: 3,
    availability: 'pending',
  }),
  'comp-dispute-frame': card('comp_corp_legal', {
    hub_sort: 3,
    hub_recommend_stars: 3,
    availability: 'pending',
  }),
  'comp-cashier-ops': card('comp_tax_accounting', {
    hub_sort: 0,
    hub_recommend_stars: 5,
    availability: 'available',
  }),
  'comp-invoice-vat': card('comp_tax_accounting', {
    hub_sort: 1,
    hub_recommend_stars: 5,
    availability: 'available',
  }),
  'comp-cit-basics': card('comp_tax_accounting', {
    hub_sort: 2,
    hub_recommend_stars: 5,
    availability: 'available',
  }),
  'comp-bookkeeping-xlsx': card('comp_tax_accounting', {
    hub_sort: 3,
    hub_recommend_stars: 4,
    availability: 'available',
  }),
  'comp-tax-sme-hnte': card('comp_tax_planning', {
    hub_sort: 1,
    hub_recommend_stars: 5,
    availability: 'available',
  }),
  'comp-rd-super-deduction': card('comp_tax_planning', {
    hub_sort: 2,
    hub_recommend_stars: 5,
    availability: 'available',
  }),
  'comp-policy-search': card('comp_policy_subsidy', {
    hub_sort: 1,
    hub_recommend_stars: 5,
    availability: 'needs_config',
  }),
  'comp-zjtx-tech-sme': card('comp_policy_subsidy', { hub_sort: 2, hub_recommend_stars: 4 }),
  'comp-local-subsidy': card('comp_policy_subsidy', { hub_sort: 3, hub_recommend_stars: 4 }),
  'comp-subsidy-checklist': card('comp_policy_subsidy', { hub_sort: 4, hub_recommend_stars: 4 }),
  'mcp-cn-central-policy': card('comp_policy_subsidy', {
    hub_sort: 0,
    hub_recommend_stars: 5,
    integration_level: 'L3',
    availability: 'needs_config',
  }),

  // —— 公关 atoms（营销生态 PR 模块：前台只亮 virtual 卡） ——
  'mkt-dmp-crisis-response': atom('comp_pr_comms', { hub_sort: 90 }),
  'mkt-dmp-digital-pr': atom('comp_pr_comms', { hub_sort: 91 }),
  'mkt-dmp-pr-pitch': atom('comp_pr_comms', { hub_sort: 92 }),
  'mkt-dmp-reputation-management': atom('comp_pr_comms', { hub_sort: 93 }),

  // —— 公关前台 virtual ——
  'comp-pr-press-release': card('comp_pr_comms', {
    hub_sort: 1,
    hub_recommend_stars: 5,
    secondary_categories: ['office'],
  }),
  'comp-pr-media-pitch': card('comp_pr_comms', { hub_sort: 2, hub_recommend_stars: 5 }),
  'comp-pr-digital-campaign': card('comp_pr_comms', { hub_sort: 3, hub_recommend_stars: 5 }),
  'comp-pr-crisis-response': card('comp_pr_comms', { hub_sort: 4, hub_recommend_stars: 5 }),
  'comp-pr-reputation': card('comp_pr_comms', { hub_sort: 5, hub_recommend_stars: 5 }),
  'comp-pr-spokesperson-qa': card('comp_pr_comms', { hub_sort: 6, hub_recommend_stars: 5 }),
  'comp-pr-sentiment-brief': card('comp_pr_comms', {
    hub_sort: 7,
    hub_recommend_stars: 4,
    secondary_categories: ['geo'],
  }),
  'comp-pr-internal-comms': card('comp_pr_comms', {
    hub_sort: 8,
    hub_recommend_stars: 5,
    secondary_categories: ['office'],
  }),
  'comp-pr-media-day-kit': card('comp_pr_comms', { hub_sort: 9, hub_recommend_stars: 4 }),
  'comp-pr-thought-leadership': card('comp_pr_comms', { hub_sort: 10, hub_recommend_stars: 4 }),
  'comp-pr-esg-narrative': card('comp_pr_comms', { hub_sort: 11, hub_recommend_stars: 4 }),
  'comp-pr-ir-messaging': card('comp_pr_comms', {
    hub_sort: 12,
    hub_recommend_stars: 4,
    secondary_categories: ['finance'],
  }),
};

/** catalog examples 与 Hub「试一下」同源（合规 + 公关） */
function tryPromptFromSlug(slug) {
  const text = CN_COMPLIANCE_TRY_PROMPTS[slug] || CN_ENTERPRISE_PR_TRY_PROMPTS[slug];
  if (!text) {
    throw new Error(`enterprise try-prompt missing for slug: ${slug}`);
  }
  return text;
}

/** Hub 前台 virtual 卡（P0 亮；财税 pending） */
export const ENTERPRISE_COMPLIANCE_VIRTUAL_CAPABILITIES = [
  {
    slug: 'comp-entity-compliance',
    display_name: '经营主体合规速查',
    task_summary: '填公司名与业务，拿到执照/经营范围自查清单',
    description: '不懂工商也能用：按填空说明公司情况，输出主体合规检查清单草稿。',
    ...card('comp_ops_reg', { hub_sort: 1, hub_recommend_stars: 5 }),
    skill_binds: ['zh-entity-compliance'],
    source: 'virtual:cn-compliance/zh-entity-compliance',
    examples: [
      tryPromptFromSlug('comp-entity-compliance'),
    ],
  },
  {
    slug: 'comp-data-privacy',
    display_name: '数据与隐私合规',
    task_summary: '说明收集了哪些信息，拿到隐私合规差距评估',
    description: '按产品形态与数据类型填空，输出个人信息保护合规评估草稿。',
    ...card('comp_ops_reg', { hub_sort: 2, hub_recommend_stars: 5 }),
    skill_binds: ['zh-pia-generation', 'zh-privacy-reg-gap', 'zh-dpa-review'],
    source: 'virtual:cn-compliance/zh-pia-generation',
    examples: [
      tryPromptFromSlug('comp-data-privacy'),
    ],
  },
  {
    slug: 'comp-ad-product',
    display_name: '广告与产品上线合规',
    task_summary: '粘贴广告文案，拿到违禁用语与改写建议',
    description: '审查投放文案与上线材料，标出绝对化用语等风险并给改写方向。',
    ...card('comp_ops_reg', { hub_sort: 3, hub_recommend_stars: 5 }),
    skill_binds: ['zh-marketing-claims-review', 'zh-launch-review', 'zhxx-ad-compliance-review'],
    source: 'virtual:cn-compliance/zh-marketing-claims-review',
    examples: [
      tryPromptFromSlug('comp-ad-product'),
    ],
  },
  {
    slug: 'comp-regulatory-lite',
    display_name: '监管合规入门',
    task_summary: '选行业与城市，拿到入门自查单与官方入口提示',
    description: '按行业整理备案/内容安全等入门检查项（非代做等保测评）。',
    ...card('comp_ops_reg', { hub_sort: 4, hub_recommend_stars: 4 }),
    skill_binds: ['zh-reg-gaps', 'zh-reg-gap-surfacer', 'zh-is-this-a-problem'],
    source: 'virtual:cn-compliance/zh-reg-gaps',
    examples: [
      tryPromptFromSlug('comp-regulatory-lite'),
    ],
  },
  {
    slug: 'comp-contract-review',
    display_name: '商事合同审查',
    task_summary: '上传合同，拿到红线条款与修改建议',
    description: '上传或粘贴合同，输出审查意见书草稿（不构成律师意见）。',
    ...card('comp_contract_bid', {
      hub_sort: 1,
      hub_recommend_stars: 5,
      secondary_categories: ['office'],
    }),
    skill_binds: ['zh-contract-review', 'zhxx-contract-review'],
    source: 'virtual:cn-compliance/zh-contract-review',
    examples: [
      tryPromptFromSlug('comp-contract-review'),
    ],
  },
  {
    slug: 'comp-bid-analyze',
    display_name: '招标文件解析',
    task_summary: '上传招标文件，拆出资格、评分与必交材料',
    description: '把厚招标文件拆成能否投、怎么得分、缺什么材料的解析报告。',
    ...card('comp_contract_bid', { hub_sort: 2, hub_recommend_stars: 5 }),
    skill_binds: ['bid-analysis', 'bid-requirements', 'bid-evaluation'],
    source: 'virtual:cn-compliance/bid-analysis',
    examples: [
      tryPromptFromSlug('comp-bid-analyze'),
    ],
  },
  {
    slug: 'comp-bid-write',
    display_name: '商务标与技术标',
    task_summary: '根据招标要求起草商务标+技术标两份草案',
    description: '输出可继续润色的商务标与技术标草案（非最终盖章件）。',
    ...card('comp_contract_bid', { hub_sort: 3, hub_recommend_stars: 5 }),
    skill_binds: ['bid-commercial-proposal', 'bid-tech-proposal', 'biaoshu-writer-pro'],
    source: 'virtual:cn-compliance/bid-commercial-proposal',
    examples: [
      tryPromptFromSlug('comp-bid-write'),
    ],
  },
  {
    slug: 'comp-labor-hire',
    display_name: '劳动合同与录用',
    task_summary: '填岗位薪资或上传合同，拿到录用审查意见',
    description: '检查试用期、工资、竞业等条款是否说清楚，给出修改建议。',
    ...card('comp_hr_labor', { hub_sort: 1, hub_recommend_stars: 5 }),
    skill_binds: ['zh-hiring-review', 'zh-worker-classification'],
    source: 'virtual:cn-compliance/zh-hiring-review',
    examples: [
      tryPromptFromSlug('comp-labor-hire'),
    ],
  },
  {
    slug: 'comp-termination',
    display_name: '解除终止与补偿',
    task_summary: '说明离职原因与时间，评估程序与补偿风险',
    description: '评估解除/协商一致等路径的程序风险与补偿估算口径（非代发通知）。',
    ...card('comp_hr_labor', { hub_sort: 2, hub_recommend_stars: 5 }),
    skill_binds: ['zh-termination-review', 'zh-wage-hour-qa'],
    source: 'virtual:cn-compliance/zh-termination-review',
    examples: [
      tryPromptFromSlug('comp-termination'),
    ],
  },
  {
    slug: 'comp-handbook-compete',
    display_name: '竞业与员工手册',
    task_summary: '上传手册或竞业协议，拿到条款审查意见',
    description: '标出过宽/缺补偿等问题，给出修改方向。',
    ...card('comp_hr_labor', { hub_sort: 3, hub_recommend_stars: 4 }),
    skill_binds: ['zh-handbook-updates'],
    source: 'virtual:cn-compliance/zh-handbook-updates',
    examples: [
      tryPromptFromSlug('comp-handbook-compete'),
    ],
  },
  {
    slug: 'comp-corp-governance',
    display_name: '公司设立与治理',
    task_summary: '填股东与股权结构，梳理章程与决策要点',
    description: '给创始人/股东的治理备忘：谁拍板、重大事项怎么定。',
    ...card('comp_corp_legal', { hub_sort: 1, hub_recommend_stars: 5 }),
    skill_binds: ['zh-board-minutes', 'zh-diligence-issue-extraction'],
    source: 'virtual:cn-compliance/zh-board-minutes',
    examples: [
      tryPromptFromSlug('comp-corp-governance'),
    ],
  },
  {
    slug: 'comp-policy-search',
    display_name: '国家政策检索',
    task_summary: '填关键词与用途，拿到政策摘要与来源链接',
    description:
      '检索中央/部委公开政策并写摘要；已配 MCP 优先用，未配则检索政府网公开页。',
    ...card('comp_policy_subsidy', {
      hub_sort: 1,
      hub_recommend_stars: 5,
      availability: 'needs_config',
      setup_hint:
        '管理员在后台 → 平台设置 → MCP 配置 cn-central-policy（见 mcp.json.example）；无 MCP 时可联网检索 gov.cn 降级。',
    }),
    skill_binds: [],
    source: 'virtual:mcp:cn-central-policy',
    examples: [
      tryPromptFromSlug('comp-policy-search'),
    ],
  },
  {
    slug: 'comp-zjtx-tech-sme',
    display_name: '专精特新与科技型',
    task_summary: '填企业规模与研发情况，对照资质缺口',
    description: '专精特新/科技型中小企业条件对照清单与官方入口提示（非代申报）。',
    ...card('comp_policy_subsidy', { hub_sort: 2, hub_recommend_stars: 4 }),
    skill_binds: [],
    source: 'virtual:cn-compliance/policy-zjtx',
    examples: [
      tryPromptFromSlug('comp-zjtx-tech-sme'),
    ],
  },
  {
    slug: 'comp-local-subsidy',
    display_name: '稳岗就业与地方惠企',
    task_summary: '填省市与关心方向，拿到本地惠企查询路径',
    description: '整理稳岗/就业/地方补贴该去哪查（非代申报）。',
    ...card('comp_policy_subsidy', { hub_sort: 3, hub_recommend_stars: 4 }),
    skill_binds: [],
    source: 'virtual:cn-compliance/policy-local',
    examples: [
      tryPromptFromSlug('comp-local-subsidy'),
    ],
  },
  {
    slug: 'comp-subsidy-checklist',
    display_name: '申报材料清单助手',
    task_summary: '填申报项目名，拿到材料准备清单',
    description: '按申报项目列材料表与缺项提醒（禁伪造盖章件）。',
    ...card('comp_policy_subsidy', { hub_sort: 4, hub_recommend_stars: 4 }),
    skill_binds: [],
    source: 'virtual:cn-compliance/policy-checklist',
    examples: [
      tryPromptFromSlug('comp-subsidy-checklist'),
    ],
  },
  {
    slug: 'mcp-cn-central-policy',
    display_name: '中央政策 MCP',
    task_summary: '用已接入的政策服务查文件列表与正文摘要',
    description:
      '需管理员配置 cn-central-policy 后可用；未配置请改用「国家政策检索」。',
    ...card('comp_policy_subsidy', {
      hub_sort: 0,
      hub_recommend_stars: 5,
      integration_level: 'L3',
      availability: 'needs_config',
      setup_hint:
        '后台 → 平台设置 → MCP 写入 cn-central-policy（见 products/_example/config/mcp.json.example 与 docs/cn-compliance-mcp-setup.zh-CN.md）。',
    }),
    skill_binds: [],
    source: 'mcp:cn-central-policy',
    examples: [
      tryPromptFromSlug('mcp-cn-central-policy'),
    ],
  },
  // —— 财税 / 出纳前台卡（PR-E：用户授权忽略上游 LICENSE 后亮起） ——
  {
    slug: 'comp-cashier-ops',
    display_name: '财税出纳',
    task_summary: '填纳税身份与本月票量，拿到出纳核对清单',
    description:
      '不懂财务也能用：按填空说明本月开票/收票情况，输出可照着做的出纳日常核对清单。',
    ...card('comp_tax_accounting', {
      hub_sort: 0,
      hub_recommend_stars: 5,
      availability: 'available',
    }),
    skill_binds: [
      'tax-invoice-compliance-checker',
      'tax-input-tax-credit-checker',
      'tax-vat-credit-calculator',
      'tax-type-classifier',
    ],
    source: 'virtual:cn-compliance/tax-cashier',
    examples: [
      tryPromptFromSlug('comp-cashier-ops'),
    ],
  },
  {
    slug: 'comp-invoice-vat',
    display_name: '发票与增值税要点',
    task_summary: '问清什么票能开、进项能不能抵',
    description: '用大白话整理发票与增值税常见注意点（草稿备忘）。',
    ...card('comp_tax_accounting', {
      hub_sort: 1,
      hub_recommend_stars: 5,
      availability: 'available',
    }),
    skill_binds: [
      'tax-invoice-compliance-checker',
      'tax-vat-rate-classification',
      'tax-input-tax-credit-checker',
    ],
    source: 'virtual:cn-compliance/tax-invoice-compliance-checker',
    examples: [
      tryPromptFromSlug('comp-invoice-vat'),
    ],
  },
  {
    slug: 'comp-cit-basics',
    display_name: '企税与汇算要点',
    task_summary: '梳理年度企税汇算要准备什么',
    description: '面向老板/出纳的企业所得税汇算清缴备忘（非代填申报）。',
    ...card('comp_tax_accounting', {
      hub_sort: 2,
      hub_recommend_stars: 5,
      availability: 'available',
    }),
    skill_binds: ['tax-eit-return-reviewer', 'tax-type-classifier'],
    source: 'virtual:cn-compliance/tax-eit-return-reviewer',
    examples: [
      tryPromptFromSlug('comp-cit-basics'),
    ],
  },
  {
    slug: 'comp-bookkeeping-xlsx',
    display_name: '做账对账台账',
    task_summary: '搭简单科目说明与对账台账骨架',
    description: '讲清钱进钱出记在哪，并给出可继续填数的台账结构。',
    ...card('comp_tax_accounting', {
      hub_sort: 3,
      hub_recommend_stars: 4,
      availability: 'available',
      secondary_categories: ['office'],
    }),
    skill_binds: ['tax-type-classifier', 'tax-invoice-compliance-checker'],
    source: 'virtual:cn-compliance/tax-bookkeeping',
    examples: [
      tryPromptFromSlug('comp-bookkeeping-xlsx'),
    ],
  },
  {
    slug: 'comp-tax-sme-hnte',
    display_name: '小微与高新优惠',
    task_summary: '对照小微/高新等合法优惠还缺什么条件',
    description: '只谈合法优惠与条件缺口（禁止逃税/虚开指引）。',
    ...card('comp_tax_planning', {
      hub_sort: 1,
      hub_recommend_stars: 5,
      availability: 'available',
    }),
    skill_binds: ['tax-preference-application-advisor'],
    source: 'virtual:cn-compliance/tax-preference-application-advisor',
    examples: [
      tryPromptFromSlug('comp-tax-sme-hnte'),
    ],
  },
  {
    slug: 'comp-rd-super-deduction',
    display_name: '研发加计扣除',
    task_summary: '列出加计扣除资料与费用归集注意点',
    description: '研发加计资料指引与合规要点（禁止虚构研发费用）。',
    ...card('comp_tax_planning', {
      hub_sort: 2,
      hub_recommend_stars: 5,
      availability: 'available',
    }),
    skill_binds: ['tax-deduction-compliance-checker'],
    source: 'virtual:cn-compliance/tax-deduction-compliance-checker',
    examples: [
      tryPromptFromSlug('comp-rd-super-deduction'),
    ],
  },
  // —— 公关前台卡（P0+P1；原子 mkt-dmp-* 隐藏，只亮中文 virtual） ——
  {
    slug: 'comp-pr-press-release',
    display_name: '新闻通稿',
    task_summary: '填发布事实与要点，拿到可审定新闻通稿 Word',
    description: '按「标题—导语—正文—关于公司」起草正式通稿，标注待核实项（不代发）。',
    ...card('comp_pr_comms', {
      hub_sort: 1,
      hub_recommend_stars: 5,
      secondary_categories: ['office'],
    }),
    skill_binds: ['anth-docx', 'mkt-dmp-digital-pr'],
    source: 'virtual:enterprise-pr/press-release',
    examples: [tryPromptFromSlug('comp-pr-press-release')],
  },
  {
    slug: 'comp-pr-media-pitch',
    display_name: '媒体 Pitch 包',
    task_summary: '填选题与目标记者类型，拿到 Pitch 信与媒体分层表',
    description: '输出选题角度、分层媒体框架与邀约信模板（不代发邮件、不代建联）。',
    ...card('comp_pr_comms', { hub_sort: 2, hub_recommend_stars: 5 }),
    skill_binds: ['mkt-dmp-pr-pitch'],
    source: 'virtual:enterprise-pr/media-pitch',
    examples: [tryPromptFromSlug('comp-pr-media-pitch')],
  },
  {
    slug: 'comp-pr-digital-campaign',
    display_name: '数字公关策划',
    task_summary: '填业务目标与周期，拿到议题—资产—节奏策划',
    description: '以权威背书/earned media 为主线做公关策划，不含付费投放排期。',
    ...card('comp_pr_comms', { hub_sort: 3, hub_recommend_stars: 5 }),
    skill_binds: ['mkt-dmp-digital-pr'],
    source: 'virtual:enterprise-pr/digital-campaign',
    examples: [tryPromptFromSlug('comp-pr-digital-campaign')],
  },
  {
    slug: 'comp-pr-crisis-response',
    display_name: '危机应对',
    task_summary: '说明已知事实与曝光范围，拿到分级应对与首小时口径',
    description: '整理严重级别、Holding、24h 动作与升级条件；须法务会签，不代发声明。',
    ...card('comp_pr_comms', { hub_sort: 4, hub_recommend_stars: 5 }),
    skill_binds: ['mkt-dmp-crisis-response'],
    source: 'virtual:enterprise-pr/crisis-response',
    examples: [tryPromptFromSlug('comp-pr-crisis-response')],
  },
  {
    slug: 'comp-pr-reputation',
    display_name: '声誉修复',
    task_summary: '说明负面来源与核心指控，拿到中长期修复计划',
    description: '区分日常口碑与危机后修复：监测、回复原则、内容补救与勿做清单。',
    ...card('comp_pr_comms', { hub_sort: 5, hub_recommend_stars: 5 }),
    skill_binds: ['mkt-dmp-reputation-management'],
    source: 'virtual:enterprise-pr/reputation',
    examples: [tryPromptFromSlug('comp-pr-reputation')],
  },
  {
    slug: 'comp-pr-spokesperson-qa',
    display_name: '发言人口径',
    task_summary: '填议题与禁区，拿到 Holding 与记者问答口径',
    description: '统一对外说法与 FAQ；强调一个声音，禁止臆测未核实事实。',
    ...card('comp_pr_comms', { hub_sort: 6, hub_recommend_stars: 5 }),
    skill_binds: ['mkt-dmp-crisis-response'],
    source: 'virtual:enterprise-pr/spokesperson-qa',
    examples: [tryPromptFromSlug('comp-pr-spokesperson-qa')],
  },
  {
    slug: 'comp-pr-sentiment-brief',
    display_name: '舆情简报',
    task_summary: '填监测对象与时间窗，拿到公开声量与风险简报',
    description: '基于可联网公开信息做简报（非 7×24 监测平台），标明信息边界。',
    ...card('comp_pr_comms', {
      hub_sort: 7,
      hub_recommend_stars: 4,
      secondary_categories: ['geo'],
    }),
    skill_binds: ['mkt-brand-mention'],
    source: 'virtual:enterprise-pr/sentiment-brief',
    examples: [tryPromptFromSlug('comp-pr-sentiment-brief')],
  },
  {
    slug: 'comp-pr-internal-comms',
    display_name: '内部沟通通报',
    task_summary: '说明对内场景与受众，拿到员工通报与口径对照',
    description: '对内口径与对外对齐：事实、已采取措施、员工须知与禁止擅自发声。',
    ...card('comp_pr_comms', {
      hub_sort: 8,
      hub_recommend_stars: 5,
      secondary_categories: ['office'],
    }),
    skill_binds: ['anth-docx'],
    source: 'virtual:enterprise-pr/internal-comms',
    examples: [tryPromptFromSlug('comp-pr-internal-comms')],
  },
  {
    slug: 'comp-pr-media-day-kit',
    display_name: '媒体日执行包',
    task_summary: '填活动形式与发布内容，拿到流程单与现场物料清单',
    description: '发布会/媒体日倒排期、邀请要点、Q&A 与应急联系人（不做施工图）。',
    ...card('comp_pr_comms', { hub_sort: 9, hub_recommend_stars: 4 }),
    skill_binds: ['mkt-dmp-digital-pr', 'mkt-dmp-pr-pitch'],
    source: 'virtual:enterprise-pr/media-day-kit',
    examples: [tryPromptFromSlug('comp-pr-media-day-kit')],
  },
  {
    slug: 'comp-pr-thought-leadership',
    display_name: '思想领导力稿',
    task_summary: '填主张与目标渠道，拿到高管署名稿或演讲提纲',
    description: '输出可投行业媒体或自有渠道的观点稿，要求论据可核验。',
    ...card('comp_pr_comms', { hub_sort: 10, hub_recommend_stars: 4 }),
    skill_binds: ['anth-docx'],
    source: 'virtual:enterprise-pr/thought-leadership',
    examples: [tryPromptFromSlug('comp-pr-thought-leadership')],
  },
  {
    slug: 'comp-pr-esg-narrative',
    display_name: 'ESG 传播叙事',
    task_summary: '填已有实践与传播目的，拿到叙事与防漂绿禁区',
    description: '梳理可对外讲的责任故事与证据锚点；不替代正式 ESG 报告鉴证。',
    ...card('comp_pr_comms', { hub_sort: 11, hub_recommend_stars: 4 }),
    skill_binds: ['mkt-dmp-digital-pr'],
    source: 'virtual:enterprise-pr/esg-narrative',
    examples: [tryPromptFromSlug('comp-pr-esg-narrative')],
  },
  {
    slug: 'comp-pr-ir-messaging',
    display_name: '投资者沟通口径',
    task_summary: '填可公开事实与禁区，拿到融资/业绩沟通 FAQ',
    description: '仅做传播口径与 FAQ，不写招股书、不替代信披与财务模型。',
    ...card('comp_pr_comms', {
      hub_sort: 12,
      hub_recommend_stars: 4,
      secondary_categories: ['finance'],
    }),
    skill_binds: ['mkt-dmp-digital-pr', 'anth-docx'],
    source: 'virtual:enterprise-pr/ir-messaging',
    examples: [tryPromptFromSlug('comp-pr-ir-messaging')],
  },
];
