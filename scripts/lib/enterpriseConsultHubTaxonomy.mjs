/**
 * PD-SAAS-FORK: 脑爆「企业咨询」六顾问 — BINDS 同源常量 + Hub taxonomy
 * 用户可见归属 brainstorming / enterprise_consult；背书原子在 cn-compliance。
 */

/** @type {Record<string, string[]>} */
export const ENTERPRISE_CONSULT_BINDS = {
  'consult-finance': [
    'tax-type-classifier',
    'tax-eit-return-reviewer',
    'tax-invoice-compliance-checker',
  ],
  'consult-tax': [
    'tax-invoice-compliance-checker',
    'tax-vat-rate-classification',
    'tax-input-tax-credit-checker',
    'tax-preference-application-advisor',
    'tax-deduction-compliance-checker',
  ],
  'consult-hr': [
    'zh-hiring-review',
    'zh-termination-review',
    'zh-wage-hour-qa',
    'zh-handbook-updates',
    'zh-worker-classification',
  ],
  'consult-legal': [
    'zh-entity-compliance',
    'zh-board-minutes',
    'zh-reg-gaps',
    'zh-diligence-issue-extraction',
  ],
  'consult-contract': [
    'zh-contract-review',
    'zhxx-contract-review',
    'zh-nda-review',
    'zh-saas-msa-review',
  ],
  'consult-policy': [],
};

/** @param {string} slug */
export function isEnterpriseConsultSlug(slug) {
  return /^consult-/i.test(String(slug ?? '').trim());
}

/** @param {string} subtag @param {Record<string, unknown>} [extra] */
function consultCard(subtag, extra = {}) {
  return {
    major_category: 'brainstorming',
    category_subtag: subtag,
    stage: 'brainstorming',
    hidden_in_hub: false,
    integration_level: 'L1',
    availability: 'available',
    launch_mode: 'skip',
    ...extra,
  };
}

/** @type {Record<string, Record<string, unknown>>} */
export const ENTERPRISE_CONSULT_SLUG_TAXONOMY = {
  'consult-finance': consultCard('enterprise_consult', {
    hub_sort: 1,
    hub_recommend_stars: 5,
    skill_binds: ENTERPRISE_CONSULT_BINDS['consult-finance'],
  }),
  'consult-tax': consultCard('enterprise_consult', {
    hub_sort: 2,
    hub_recommend_stars: 5,
    skill_binds: ENTERPRISE_CONSULT_BINDS['consult-tax'],
  }),
  'consult-hr': consultCard('enterprise_consult', {
    hub_sort: 3,
    hub_recommend_stars: 5,
    skill_binds: ENTERPRISE_CONSULT_BINDS['consult-hr'],
  }),
  'consult-legal': consultCard('enterprise_consult', {
    hub_sort: 4,
    hub_recommend_stars: 5,
    skill_binds: ENTERPRISE_CONSULT_BINDS['consult-legal'],
  }),
  'consult-contract': consultCard('enterprise_consult', {
    hub_sort: 5,
    hub_recommend_stars: 5,
    skill_binds: ENTERPRISE_CONSULT_BINDS['consult-contract'],
  }),
  'consult-policy': consultCard('enterprise_consult', {
    hub_sort: 6,
    hub_recommend_stars: 5,
    skill_binds: ENTERPRISE_CONSULT_BINDS['consult-policy'],
  }),
};

const DISCLAIMER =
  '首次回复用一句话说明：中国大陆法域，口头咨询草稿，不构成法律/税务/会计/劳动人事执业意见。此后勿重复。';

/**
 * @param {string} slug
 * @param {string} title
 * @param {string} role
 * @param {string} handoffComp
 */
function skillBody(slug, title, role, handoffComp) {
  const binds = ENTERPRISE_CONSULT_BINDS[slug] ?? [];
  const bindLine = binds.length
    ? binds.map((b) => `\`${b}\``).join('、')
    : '（无固定原子；政策事实以联网权威站为准）';
  return `---
name: ${slug}
description: |
  ${title}：面向中小微的中国大陆${role}口语顾问。
  当用户提到「${title}」「问${role}」「企业咨询·${role}」或从能力中心选择 ${slug} 时使用。
---

# ${title}

## 顾问规则（最重要）

- 用「我」直接回答；口语大白话，少用黑话。
- ${DISCLAIMER}
- 用户说「退出顾问 / 切回正常 / 不用咨询了」→ 恢复普通助手。
- **须快速回复**；可短暂思考；**默认禁止调用任何工具**（含 \`read_skill\` / \`web_search\` / \`write_file\` / 扫盘）。
- **正式稿**（用户明确要意见书/清单 md）→ 引导能力中心「企业」Tab 的 \`${handoffComp}\` 卡或企业类全案模板（背书原子参考：${bindLine}）；本对话不要默认落盘。
- 允许**最多一轮**澄清（如所在城市、纳税身份）；禁止页数/风格偏好问卷。

## 擅长

${role}相关的中小微日常问题、风险提示、准备清单口径。

## 不接（红线）

- 逃税、隐瞒收入、虚开发票、伪造盖章件/材料的操作步骤
- 代替律师出庭、代办工商变更、代发解除通知
- 编造「稳赚」政策或未核实的申报承诺

被问红线时：明确拒绝，并给出合法替代路径（找持证机构/官方入口）。

## 正式稿移交

需要落盘审查意见或检查清单时，优先引导：能力中心 → **企业** → \`${handoffComp}\`（或同主题全案模板）。
`;
}

/** 供 vendor 脚本或文档生成；本体落在 skills/vendor/cn-enterprise-consult/<slug>/SKILL.md */
export const ENTERPRISE_CONSULT_SKILL_SPECS = [
  {
    slug: 'consult-finance',
    display_name: '财务顾问',
    task_summary: '账、资金、对账与报表口径口语答疑',
    handoff: 'comp-bookkeeping-xlsx',
    role: '财务',
  },
  {
    slug: 'consult-tax',
    display_name: '税务顾问',
    task_summary: '发票、增值税、企税与合法优惠边界答疑',
    handoff: 'comp-invoice-vat',
    role: '税务',
  },
  {
    slug: 'consult-hr',
    display_name: '人力顾问',
    task_summary: '录用、薪酬工时、解除与手册竞业答疑',
    handoff: 'comp-labor-hire',
    role: '人力',
  },
  {
    slug: 'consult-legal',
    display_name: '法律顾问',
    task_summary: '主体治理、监管入门与争议框架口语答疑',
    handoff: 'comp-entity-compliance',
    role: '法律',
  },
  {
    slug: 'consult-contract',
    display_name: '合同顾问',
    task_summary: '合同条款风险口语解读与改法方向',
    handoff: 'comp-contract-review',
    role: '合同',
  },
  {
    slug: 'consult-policy',
    display_name: '政策顾问',
    task_summary: '惠企、专精特新与地方补贴路径咨询',
    handoff: 'comp-policy-search',
    role: '政策',
  },
];

export function buildEnterpriseConsultSkillMarkdown(slug) {
  const spec = ENTERPRISE_CONSULT_SKILL_SPECS.find((s) => s.slug === slug);
  if (!spec) throw new Error(`unknown consult slug: ${slug}`);
  return skillBody(slug, spec.display_name, spec.role, spec.handoff);
}
