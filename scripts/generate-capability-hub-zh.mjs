#!/usr/bin/env node
/** 从 capabilityHubTaxonomy 与内置名称表生成 config/capability-hub-zh.json */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VIRTUAL_CAPABILITIES } from './lib/capabilityHubTaxonomy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'config', 'capability-hub-zh.json');

const DISPLAY_NAMES = {
  'mkt-customer-research': '客户调研',
  'mkt-competitor-profiling': '竞品画像',
  'mkt-competitors': '竞品对比页',
  'df-deep-research': '深度调研',
  'df-github-deep-research': 'GitHub 竞品调研',
  'ala-fact-checker': '事实核查',
  'ala-decision-helper': '决策助手',
  'od-research-decision-room': '调研决策室',
  'anth-docx': 'Word 文档',
  'mkt-marketing-plan': '营销计划',
  'mkt-marketing-ideas': '创意点子',
  'mkt-marketing-psychology': '消费心理',
  'mkt-launch': '上市策略',
  'mkt-content-strategy': '内容策略',
  'pd-geo': 'AI 搜索全案',
  'mkt-site-architecture': '站点结构',
  'mkt-product-marketing': '产品营销',
  'mkt-pricing': '定价包装',
  'mkt-revops': 'B2B 收入运营',
  'pms-swot-analysis': 'SWOT 分析',
  'df-consulting-analysis': '咨询分析',
  'open-design': '设计总控',
  'mkt-copywriting': '广告文案',
  'mkt-copy-editing': '文案润色',
  'od-article-magazine': '杂志长文',
  'mkt-ad-creative': '投放创意',
  'mkt-image': '营销生图',
  'od-poster-hero': '海报主视觉',
  'od-saas-landing': '官网落地页',
  'od-pricing-page': '定价页',
  'od-pricing-upgrade': '升级页',
  'mkt-paywalls': '付费墙',
  'od-faq-page': 'FAQ 页面',
  'od-release-notes-one-pager': '更新说明页',
  'social-creative-matrix': '社媒矩阵包',
  'od-social-carousel': '社媒轮播',
  'od-email-marketing': '邮件营销页',
  'mkt-video': '营销视频',
  'od-deck-magazine': 'HTML 比稿',
  'frontend-slides': 'HTML 演示',
  'df-ppt-generation': 'PPT 生成',
  'od-data-report': '数据报告页',
  'od-figma': 'Figma 工作流',
  'mkt-social': '社媒内容与日历',
  'mkt-emails': '邮件序列',
  'df-newsletter-generation': 'Newsletter',
  'mkt-cold-email': '冷邮件',
  'mkt-prospecting': '潜客开发',
  'mkt-sales-enablement': '销售赋能',
  'mkt-ads': '付费投放',
  'mkt-lead-magnets': 'Lead Magnet',
  'mkt-popups': '弹窗转化',
  'mkt-signup': '注册转化',
  'mkt-free-tools': '免费工具',
  'mkt-community-marketing': '社区营销',
  'mkt-referrals': '推荐计划',
  'mkt-co-marketing': '联名营销',
  'mkt-onboarding': '新用户激活',
  'mkt-sms': '短信触达',
  'df-podcast-generation': '播客内容',
  'yixiaoer': '国内社媒发布',
  'mkt-programmatic-seo': '批量 SEO 页',
  'mkt-schema': '结构化数据',
  'mkt-directory-submissions': '目录提交',
  'mkt-aso': '应用商店优化',
  'mkt-analytics': '数据分析',
  'mkt-ab-testing': 'A/B 测试',
  'mkt-cro': '转化率优化',
  'mkt-seo-audit': 'SEO 审计',
  'mkt-ai-seo': 'AI 可见度快检',
  'mkt-churn-prevention': '流失预防',
  'df-data-analysis': '深度分析',
  'df-chart-visualization': '图表可视化',
  'df-systematic-literature-review': '系统文献综述',
  'df-academic-paper-review': '论文评审',
  'ala-academic-researcher': '学术写作助手',
  'college-academic-writing': '大学学术写作',
};

const skills = {};

for (const v of VIRTUAL_CAPABILITIES) {
  skills[v.slug] = {
    'zh-CN': {
      display_name: v.display_name,
      task_summary: v.task_summary,
      description: v.description,
      setup_hint: v.setup_hint || '',
      examples: v.examples || [],
    },
  };
}

for (const [slug, display_name] of Object.entries(DISPLAY_NAMES)) {
  if (skills[slug]) continue;
  skills[slug] = {
    'zh-CN': {
      display_name,
      task_summary: display_name,
      description: `完成与「${display_name}」相关的营销任务，输出可直接使用的成果。`,
    },
  };
}

writeFileSync(OUT, `${JSON.stringify({ version: 1, skills }, null, 2)}\n`, 'utf8');
console.log(`[generate-capability-hub-zh] wrote ${Object.keys(skills).length} entries → ${OUT}`);
