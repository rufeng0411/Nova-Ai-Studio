#!/usr/bin/env node
/**
 * Build config/capabilities.i18n.json from catalog + curated zh/en copy.
 * Run after generate-capabilities-catalog.mjs when skills change.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareCapabilitiesForHub } from './lib/capabilityHubSort.mjs';
import { enrichZhLocaleFields, hasExplicitZhOverride } from './lib/capabilityZhAuto.mjs';
import { HUB_SKILL_PACKS } from './lib/capabilityHubPacks.mjs';
import { getTryPromptZh } from './lib/capabilityTryPrompts.mjs';
import { isCapabilityCopyPlaceholder } from './lib/capabilityCopy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const CATALOG_PATH = path.join(REPO_ROOT, 'config', 'capabilities.catalog.json');
const HUB_ZH_PATH = path.join(REPO_ROOT, 'config', 'capability-hub-zh.json');
const OUTPUT_PATH = path.join(REPO_ROOT, 'config', 'capabilities.i18n.json');

const STAGE_I18N = {
  education: {
    'zh-CN': { label: '教育学习', summary: '教材同步、备考复习、教师备课、亲子陪学（独立于营销飞轮）' },
    en: { label: 'Education & Learning', summary: 'Textbook sync, exam prep, teaching tools — separate from the marketing flywheel' },
  },
  research: {
    'zh-CN': { label: '调研洞察', summary: '摸清市场、用户、竞品和趋势' },
    en: { label: 'Research & Insights', summary: 'Understand market, users, competitors, and trends' },
  },
  strategy: {
    'zh-CN': { label: '策略策划', summary: '明确定位、人群、路径和决策' },
    en: { label: 'Strategy & Planning', summary: 'Clarify positioning, audience, path, and decisions' },
  },
  create: {
    'zh-CN': { label: '创意内容', summary: '产出文案、视觉、页面和视频' },
    en: { label: 'Creative Content', summary: 'Produce copy, visuals, pages, and video' },
  },
  activate: {
    'zh-CN': { label: '营销触达', summary: '组织活动、矩阵和渠道触达' },
    en: { label: 'Marketing Outreach', summary: 'Run campaigns, channels, and audience touchpoints' },
  },
  distribute: {
    'zh-CN': { label: '发布分发', summary: '上线发布并规模化分发' },
    en: { label: 'Publishing & Distribution', summary: 'Launch and scale distribution' },
  },
  measure: {
    'zh-CN': { label: '监测复盘', summary: '看数据、做实验、形成回流洞察' },
    en: { label: 'Measurement & Review', summary: 'Track metrics, run experiments, feed insights back' },
  },
  uncategorized: {
    'zh-CN': { label: '待归类', summary: '未映射能力，待人工补充' },
    en: { label: 'Uncategorized', summary: 'Not yet mapped to a flywheel stage' },
  },
};

/** Curated zh summaries for vendor L1 skills (slug -> { task_summary, description? }) */
const SKILL_ZH = {
  'ala-academic-researcher': { task_summary: '学术文献综述、论文分析与学术写作辅助', description: '适用于文献回顾、论文审阅、研究方法分析与引用整理。' },
  'ala-code-reviewer': { task_summary: '代码安全与质量审查', description: '检查安全漏洞、性能问题与最佳实践，适合 PR 与代码审计。' },
  'ala-debugger': { task_summary: '系统化调试与根因分析', description: '排查错误、崩溃与异常行为，定位并修复问题。' },
  'ala-decision-helper': { task_summary: '结构化决策与方案对比', description: '用框架评估选项、权衡利弊并做理性决策。' },
  'ala-deep-research': { task_summary: '多源深度调研与综述', description: '综合多来源信息并给出带引用的研究结论。' },
  'ala-editor': { task_summary: '专业编辑与润色', description: '提升文稿清晰度、语法、风格与可读性。' },
  'ala-fact-checker': { task_summary: '事实核查与信源验证', description: '验证主张真伪、识别误导信息并评估来源可信度。' },
  'ala-fullstack-developer': { task_summary: '全栈 Web 开发', description: 'React、Node、数据库与 API 等现代 Web 应用开发。' },
  'ala-meeting-notes': { task_summary: '会议纪要整理', description: '输出结构化纪要、行动项与关键决策。' },
  'ala-python-expert': { task_summary: 'Python 开发与优化', description: '编写清晰高效的 Python 代码并排查问题。' },
  'ala-technical-writer': { task_summary: '技术文档写作', description: '撰写 README、API 文档、教程与用户指南。' },
  'ala-project-planner': { task_summary: '项目拆解与排期', description: '将复杂项目拆成可执行任务、里程碑与依赖关系。' },
  'ala-sprint-planner': { task_summary: '敏捷 Sprint 规划', description: '故事估算、容量规划与 Sprint 目标设定。' },
  'ala-strategy-advisor': { task_summary: '战略分析与商业决策', description: '高层战略思考、方向选择与竞争分析。' },
  'ala-content-creator': { task_summary: '内容与社媒创作', description: '博客、社媒与营销素材的受众导向内容生产。' },
  'ala-content-writer': { task_summary: '营销文案写作', description: '落地页、邮件与社媒帖子的促销与品牌文案。' },
  'ala-ux-designer': { task_summary: 'UX 设计与原型', description: '用户研究、线框、原型与体验设计辅助。' },
  'ala-email-drafter': { task_summary: '商务邮件起草', description: '各类商务场景的专业邮件撰写。' },
  'ala-data-analyst': { task_summary: '数据分析（SQL / pandas）', description: '数据探索、统计分析与洞察提炼。' },
  'ala-visualization-expert': { task_summary: '数据可视化建议', description: '选对图表类型，清晰呈现数据故事。' },
  'df-academic-paper-review': { task_summary: '学术论文审阅', description: '结构化评阅论文方法、贡献与改进建议。' },
  'df-bootstrap': { task_summary: 'AI 伙伴身份引导（SOUL.md）', description: '通过对话生成个性化 AI 身份与风格配置。' },
  'df-claude-to-deerflow': { task_summary: '对接 DeerFlow 研究平台', description: '向 DeerFlow 发送任务、管理线程与深度研究。' },
  'df-code-documentation': { task_summary: '代码与 API 文档生成', description: '为代码库生成 README、API 说明与架构文档。' },
  'df-deep-research': { task_summary: '系统化网络深度调研', description: '多角度检索与综合，替代单次浅层搜索。' },
  'df-find-skills': { task_summary: '发现与安装 Agent 技能', description: '帮用户找到并安装可扩展能力的技能包。' },
  'df-github-deep-research': { task_summary: 'GitHub 仓库深度研究', description: '多轮分析开源项目、时间线与竞争格局。' },
  'df-skill-creator': { task_summary: '创建与优化技能', description: '从零编写技能、改进现有技能并做效果评估。' },
  'df-smoke-test': { task_summary: 'DeerFlow 端到端冒烟测试', description: '拉代码、部署、健康检查与测试报告。' },
  'df-surprise-me': { task_summary: '创意组合展示', description: '动态组合其他技能，制造惊喜体验。' },
  'df-systematic-literature-review': { task_summary: '系统性文献综述', description: '跨多篇论文的主题综述与参考文献整理。' },
  'df-vercel-deploy-claimable': { task_summary: '部署到 Vercel', description: '一键部署网站/应用并返回预览与认领链接。' },
  'df-consulting-analysis': { task_summary: '咨询级研究报告', description: '市场、品牌、行业等结构化分析框架与成稿。' },
  'df-frontend-design': { task_summary: '高品质前端界面设计', description: '产出有辨识度的生产级前端视觉与布局。' },
  'df-image-generation': { task_summary: 'AI 图像生成', description: '按描述生成、创作或可视化图像素材。' },
  'df-ppt-generation': { task_summary: '演示文稿生成', description: '根据主题生成 PPT/幻灯片内容结构。' },
  'df-video-generation': { task_summary: 'AI 视频生成', description: '按描述生成或创作视频内容。' },
  'df-web-design-guidelines': { task_summary: 'Web 界面规范审查', description: '对照 Web 界面指南检查 UI 代码合规性。' },
  'df-newsletter-generation': { task_summary: '电子报/Newsletter 生成', description: '撰写与编排邮件通讯内容。' },
  'df-podcast-generation': { task_summary: '播客内容生成', description: '生成播客脚本与节目结构。' },
  'df-chart-visualization': { task_summary: '智能图表可视化', description: '根据数据自动选择并生成合适图表。' },
  'df-data-analysis': { task_summary: 'Excel/CSV 数据分析', description: '上传表格并进行统计分析与洞察。' },
  'mkt-competitor-profiling': { task_summary: '竞品画像与深度分析', description: '从竞品网址输出结构化竞品档案。' },
  'mkt-competitors': { task_summary: '竞品对比与替代页', description: '制作 SEO/销售用的「我们 vs 竞品」页面。' },
  'mkt-customer-research': { task_summary: '客户调研与洞察 synthesis', description: '访谈、问卷、社区与评论挖掘，形成 ICP 与痛点。' },
  'mkt-ab-testing': { task_summary: 'A/B 测试与实验设计', description: '规划假设、变体与统计显著性，搭建增长实验。' },
  'mkt-ad-creative': { task_summary: '广告创意批量生成', description: '标题、描述与多版本广告素材规模化产出。' },
  'mkt-ads': { task_summary: '付费广告投放', description: 'Google、Meta 等平台的广告策略与投放优化。' },
  'mkt-ai-seo': { task_summary: 'AI 搜索优化（GEO）', description: '优化内容以被 AI 搜索引擎引用与收录。' },
  'geo-keyword-research': { task_summary: '梳理 AI 搜索关键词与用户问句', description: '建立 GEO 基线问句库，覆盖用户在大模型里常搜的问题句式。' },
  'geo-competitor-analysis': { task_summary: '对比竞品 AI 可见度', description: '比较你与竞品在大模型回答中的提及、引用与排名差距。' },
  'geo-serp-analysis': { task_summary: '分析 AI 搜索/SERP 格局', description: '识别 AI 搜索结果页的可争取位次与内容切入机会。' },
  'geo-content-gap-analysis': { task_summary: '发现 AI 内容缺口', description: '找出竞品已覆盖、你方尚未布局的可检索内容主题。' },
  'geo-content-optimizer': { task_summary: '优化 AI 可引用性', description: '改写段落结构与事实密度，提高被大模型引用与摘录的概率。' },
  'geo-seo-content-writer': { task_summary: '撰写 AI 搜索友好长文', description: '产出便于 AI 抓取、摘录与引用的权威长文与 FAQ。' },
  'geo-technical-seo': { task_summary: '检查 AI 爬虫与技术可达', description: '审计 robots、llms.txt、schema 与爬虫可达性等技术基线。' },
  'geo-on-page-audit': { task_summary: '单页 AI 可见度审计', description: '检查标题、结构、关键词与内链，列出优先修复项。' },
  'geo-rank-track': { task_summary: '跟踪 AI 可见度变化', description: '建立品牌在 AI 回答中的可见度基线并跟踪趋势。' },
  'geo-performance-reporter': { task_summary: 'AI 可见度绩效报告', description: '汇总可见度、流量与转化指标，输出周期复盘报告。' },
  'geo-backlink-analyzer': { task_summary: '外链与引用来源分析', description: '评估外链与引用来源质量，辅助提升 AI 检索信任信号。' },
  'mkt-analytics': { task_summary: '分析埋点与指标', description: '搭建、审计与改进转化与行为追踪。' },
  'mkt-aso': { task_summary: '应用商店优化（ASO）', description: 'App Store / Google Play 列表审计与优化。' },
  'mkt-churn-prevention': { task_summary: '流失预防与挽回', description: '取消流程、挽留优惠与订阅挽回策略。' },
  'mkt-co-marketing': { task_summary: '联合营销', description: '寻找合作伙伴并策划联合推广活动。' },
  'mkt-content-strategy': { task_summary: '内容策略与选题', description: '规划写什么、话题簇与内容日历方向。' },
  'mkt-cro': { task_summary: '转化率优化（CRO）', description: '优化落地页与漏斗各环节转化。' },
  'mkt-free-tools': { task_summary: '免费工具获客', description: '评估与规划用于获客的免费小工具。' },
  'mkt-launch': { task_summary: '产品发布策划', description: '新品/功能发布的节奏、渠道与物料清单。' },
  'mkt-marketing-ideas': { task_summary: '营销创意 brainstorm', description: '为 SaaS/软件产品提供增长灵感与 tactics。' },
  'mkt-marketing-plan': { task_summary: '综合营销计划', description: '输出可执行的全渠道营销方案。' },
  'mkt-marketing-psychology': { task_summary: '营销心理学应用', description: '运用心理模型提升说服与转化。' },
  'mkt-onboarding': { task_summary: '注册后激活优化', description: '优化新用户引导、首周体验与激活率。' },
  'mkt-paywalls': { task_summary: '应用内付费墙', description: '设计升级页、订阅弹窗与 upsell 界面。' },
  'mkt-popups': { task_summary: '弹窗与浮层优化', description: '创建或优化订阅、促销类弹窗转化。' },
  'mkt-pricing': { task_summary: '定价与套餐策略', description: '定价模型、打包与 monetization 决策。' },
  'mkt-product-marketing': { task_summary: '产品营销上下文', description: '维护 PMM 文档：定位、人群、差异化与话术。' },
  'mkt-prospecting': { task_summary: '潜客名单与开发', description: '筛选、评估并建立外联潜客列表。' },
  'mkt-referrals': { task_summary: '推荐与联盟计划', description: '设计、优化与分析裂变/推荐机制。' },
  'mkt-revops': { task_summary: '收入运营（RevOps）', description: '线索生命周期、管道与 GTM 运营。' },
  'mkt-sales-enablement': { task_summary: '销售赋能材料', description: 'Pitch deck、一页纸、异议处理与 battle card。' },
  'mkt-schema': { task_summary: '结构化数据 / Schema', description: '添加或修复 JSON-LD 等结构化 markup。' },
  'mkt-signup': { task_summary: '注册流程优化', description: '优化注册、试用开通与表单完成率。' },
  'mkt-site-architecture': { task_summary: '网站信息架构', description: '规划页面层级、内链与 SEO 友好结构。' },
  'mkt-sms': { task_summary: '短信营销', description: 'SMS/MMS 活动规划、文案与合规。' },
  'mkt-copy-editing': { task_summary: '营销文案润色', description: '改进已有文案的清晰度、节奏与转化力。' },
  'mkt-copywriting': { task_summary: '营销文案写作', description: '落地页、广告与邮件等转化向文案。' },
  'mkt-image': { task_summary: '营销配图生成', description: '博客头图、社媒图、产品 mock 等视觉素材。' },
  'mkt-video': { task_summary: '营销视频制作', description: 'AI 视频、演示片与短视频生产流程。' },
  'mkt-cold-email': { task_summary: 'B2B 冷邮件序列', description: '高回复率的外联邮件与跟进节奏。' },
  'mkt-community-marketing': { task_summary: '社区营销', description: '用社区驱动增长与品牌忠诚度。' },
  'mkt-emails': { task_summary: '邮件序列与自动化', description: 'drip、campaign 与生命周期邮件设计。' },
  'mkt-lead-magnets': { task_summary: '引流磁铁', description: '设计用于换邮箱的白皮书、清单等资源。' },
  'mkt-social': { task_summary: '社媒内容与短视频脚本', description: 'LinkedIn、X、TikTok 等内容日历、脚本与优化。' },
  'mkt-directory-submissions': { task_summary: '产品目录站提交', description: '向 Startup/SaaS/AI 等导航站提交产品。' },
  'mkt-programmatic-seo': { task_summary: '程序化 SEO 页面', description: '模板化批量生成 SEO 落地页。' },
  'mkt-seo-audit': { task_summary: 'SEO 全站审计', description: '诊断收录、技术 SEO 与内容问题。' },
  'pms-swot-analysis': { task_summary: 'SWOT 战略分析', description: '优势、劣势、机会、威胁与行动建议。' },
  'find-skills': { task_summary: '发现与安装技能', description: '帮用户找到并安装 Agent 扩展技能。' },
  'skill-creator': { task_summary: '创建与优化技能', description: '编写新技能、改进触发与评估效果。' },
  'pilotdeck-skills-migration': { task_summary: '技能迁移到 Nova Ai-Studio', description: '从 Claude Code/OpenClaw 等目录迁移技能。' },
  'frontend-slides': { task_summary: 'HTML 动画演示稿', description: '生成动效丰富的 HTML 幻灯片/演示。' },
  'karpathy-guidelines': { task_summary: '减少 AI 编码失误的规范', description: '降低 LLM 写代码常见问题的行为准则。' },
  'minimax-pdf': { task_summary: '高视觉质量 PDF', description: '注重排版与设计感的 PDF 生成。' },
  'anth-docx': {
    task_summary: 'Word 文档生成与编辑（docx）',
    description: '正式 brief、新闻通稿、备忘录与带格式的 Word 报告；适合给客户/媒体交付（非 HTML）。',
  },
  'social-creative-matrix': {
    task_summary: '社媒矩阵创作',
    description: '一条创意生成国内 8 平台文案矩阵与 9:16/1:1/16:9/3:4 四套配图，可交接蚁小二图文草稿发布。',
  },
  'pd-geo': {
    task_summary: 'AI 搜索可见度全案',
    description: '关键词、多平台成稿、评分与验证、可见度周报，提升品牌在 AI 回答中的提及。',
  },
  'yixiaoer': {
    task_summary: '国内社媒矩阵发布（蚁小二）',
    description: '多账号管理、图文/视频草稿发布、素材库与发布数据查询，覆盖 50+ 国内平台。',
  },
  'od-8bit-orbit-video': { task_summary: '8-bit 轨道环绕风格视频页', description: '复古像素风动态视频 HTML 模板。' },
  'od-after-hours-editorial': { task_summary: 'After Hours 编辑风页面', description: '夜间杂志感 editorial 视觉模板。' },
  'od-digits-fintech': { task_summary: '金融科技数字风页面', description: 'Fintech 产品展示向设计模板。' },
  'od-editorial-burgundy': { task_summary: '勃艮第编辑风页面', description: '深酒红 editorial 品牌视觉模板。' },
  'od-field-notes-editorial': { task_summary: 'Field Notes 编辑风', description: '手帐/田野笔记风格 editorial 页。' },
  'od-login-flow': { task_summary: '登录流程界面', description: '登录、注册与验证流程页面设计。' },
  'od-release-notes-one-pager': { task_summary: '版本更新一页纸', description: '产品更新说明单页视觉稿。' },
  'od-research-decision-room': { task_summary: '调研决策看板', description: '可交互的方案对比与决策 HTML 看板。' },
  'od-swiss-creative': { task_summary: '瑞士国际主义创意风', description: '网格、 typography 为主的创意视觉。' },
  'od-swiss-user-research-video': { task_summary: '用户研究主题视频页', description: 'Swiss 风格用户研究汇报视频 HTML。' },
  'od-web-artifacts-builder': { task_summary: 'Web 成果构建', description: '批量生成可预览的 HTML 设计成果。' },
  'od-weread-year-in-review-video': { task_summary: '年度回顾视频页', description: '读书/年度回顾主题动效视频页。' },
  'nova-research-general': { task_summary: '舆情与市场并重的综合调研', description: '标准概述→采集→发现→舆情→建议骨架，通用调研默认兜底。' },
  'nova-research-user-general': { task_summary: '八段式终端用户研究', description: '受众主叙事：画像、场景、痛点、决策与建议。' },
  'nova-research-industry-market': { task_summary: '行业规模、产业链与进入决策', description: '12 章行业市场骨架：PEST/SWOT、竞争格局与投资建议。' },
  'nova-research-product-user': { task_summary: '产品导向用户研究八章', description: '固定八章产品用户研究，适合需求验证与产品规划。' },
  'nova-research-competitor': { task_summary: '竞品池全量 C1..CN 对标', description: '竞品清单、维度对比、差距分析与突围策略。' },
  'nova-research-academic-professional': { task_summary: '学术/公文/专业规范交付', description: '权威信源、严谨结构、参考文献可追溯。' },
  'nova-ppt-aesthetic-slides': {
    display_name: 'Nova-美学幻灯',
    task_summary: '大纲→页描述→文生图配图的 PNG 幻灯包',
    description: '8 套视觉预设、风格锁定与 16:9 页图序列。',
  },
  'nova-customer-acquisition-leads': {
    display_name: 'Nova-智能获客',
    task_summary: 'B2B 智能获客：检索→抽取→评分线索表',
    description: '交付 leads-report.md 整齐表格；对话禁止 JSON/HTML 刷屏。',
  },
  'hf-hyperframes': {
    display_name: 'HTML代码做视频',
    task_summary: '用 HTML/工程渲染出真 MP4 宣传片',
    description: 'HyperFrames 主入口：写工程后 render_hyperframes 出 promo.mp4。',
  },
  'hf-website-to-video': {
    display_name: '网站一键成片',
    task_summary: '抓取网址自动出宣传片',
    description: '官网/落地页抓取后生成宣传片 MP4。',
  },
  'html-ppt': {
    display_name: 'HTML演示稿',
    task_summary: '专业 HTML 演示稿与主题模板',
  },
  'remotion-video': {
    display_name: 'React程序化视频',
    task_summary: 'Remotion 程序化短视频工程',
  },
};

const SKILL_EN = {
  'open-design': {
    task_summary: 'Open Design hub for high-quality HTML design deliverables',
    description: 'Turn vague briefs into polished pages, prototypes, and marketing visuals using design systems.',
  },
  'od-social-carousel': {
    task_summary: 'Social carousel cards (Xiaohongshu-style)',
    description: '3–7 swipeable 3:4 cards with unified visual series for social feeds.',
  },
  'od-article-magazine': {
    task_summary: 'Magazine-style long-form article page',
    description: 'Editorial layout with chapters, pull quotes, and image areas for blogs and features.',
  },
  'od-dashboard': {
    task_summary: 'Dashboard / admin home with sidebar',
    description: 'KPI cards and chart areas for ops or analytics dashboards.',
  },
  'od-data-report': {
    task_summary: 'Data report summary page',
    description: 'Conclusion-first layout with charts and recommended actions.',
  },
  'od-deck-magazine': {
    task_summary: 'Magazine-style horizontal deck',
    description: 'Full-screen slide deck for presentations and roadshows.',
  },
  'od-email-marketing': {
    task_summary: 'Email campaign layout',
    description: 'Hero, body, and CTA blocks suitable for email clients.',
  },
  'od-faq-page': {
    task_summary: 'FAQ / help center page',
    description: 'Search, categories, and expandable Q&A sections.',
  },
  'od-figma': {
    task_summary: 'Figma MCP integration',
    description: 'Read file structure, extract design tokens, and automate via Figma MCP.',
  },
  'od-image-gen': {
    task_summary: 'Generate marketing images',
    description: 'Create PNG/JPG assets for posters, covers, and campaigns.',
  },
  'od-video-gen': {
    task_summary: 'Generate marketing video',
    description: 'Create MP4 clips for promos and concept demos.',
  },
  'od-mobile-app': {
    task_summary: 'Mobile app UI mockups',
    description: 'Single or multi-screen app UI with device frames.',
  },
  'od-mobile-onboarding': {
    task_summary: 'Mobile onboarding flow',
    description: 'Three-screen welcome, value, and sign-in onboarding.',
  },
  'od-poster-hero': {
    task_summary: 'Vertical promo poster',
    description: 'High-impact poster for events and social sharing.',
  },
  'od-pricing-page': {
    task_summary: 'Pricing & plans page',
    description: 'Tier comparison, features, and FAQ for monetization.',
  },
  'od-pricing-upgrade': {
    task_summary: 'Upgrade / paywall page',
    description: 'Conversion-focused upgrade and plan comparison.',
  },
  'od-resume': {
    task_summary: 'Resume / portfolio page',
    description: 'Experience, skills, projects, and contact sections.',
  },
  'od-saas-landing': {
    task_summary: 'SaaS landing page',
    description: 'Hero, features, pricing CTA, and footer for product sites.',
  },
  'od-wireframe-sketch': {
    task_summary: 'Wireframe sketch page',
    description: 'Low-fidelity layout to validate structure before visual design.',
  },
  'od-8bit-orbit-video': {
    task_summary: '8-bit orbit-style video page',
    description: 'Retro pixel-motion video HTML template.',
  },
  'od-after-hours-editorial': {
    task_summary: 'After Hours editorial page',
    description: 'Night magazine editorial visual template.',
  },
  'od-digits-fintech': {
    task_summary: 'Fintech digits-style page',
    description: 'Digital fintech product showcase template.',
  },
  'od-editorial-burgundy': {
    task_summary: 'Burgundy editorial page',
    description: 'Deep wine-red editorial brand template.',
  },
  'od-field-notes-editorial': {
    task_summary: 'Field Notes editorial page',
    description: 'Notebook-style editorial layout.',
  },
  'od-login-flow': {
    task_summary: 'Login flow UI',
    description: 'Sign-in, registration, and verification screens.',
  },
  'od-release-notes-one-pager': {
    task_summary: 'Release notes one-pager',
    description: 'Single-page product update announcement.',
  },
  'od-research-decision-room': {
    task_summary: 'Research decision dashboard',
    description: 'Interactive comparison board for strategic choices.',
  },
  'od-swiss-creative': {
    task_summary: 'Swiss creative layout',
    description: 'Grid and typography-led creative visual.',
  },
  'od-swiss-user-research-video': {
    task_summary: 'User research video page',
    description: 'Swiss-style user research recap video HTML.',
  },
  'od-web-artifacts-builder': {
    task_summary: 'Web artifacts builder',
    description: 'Batch-build previewable HTML design deliverables.',
  },
  'od-weread-year-in-review-video': {
    task_summary: 'Year-in-review video page',
    description: 'Annual recap motion page template.',
  },
  'nova-research-general': {
    display_name: 'Nova-General Research',
    task_summary: 'Balanced market & sentiment research report',
    description: 'Classic overview → data → findings → sentiment → recommendations; default research fallback.',
  },
  'nova-research-user-general': {
    display_name: 'Nova-User Research',
    task_summary: 'Eight-section user research narrative',
    description: 'Audience-first story: personas, scenarios, pain points, decisions, and recommendations.',
  },
  'nova-research-industry-market': {
    display_name: 'Nova-Industry & Market',
    task_summary: 'Industry size, chain, PEST/SWOT & entry decision',
    description: '12-chapter industry report: landscape, trends, competition, and go/no-go advice.',
  },
  'nova-research-product-user': {
    display_name: 'Nova-Product User Research',
    task_summary: 'Product-oriented user research (8 chapters)',
    description: 'Fixed eight-chapter template for product teams validating needs and journeys.',
  },
  'nova-research-competitor': {
    display_name: 'Nova-Competitor Benchmark',
    task_summary: 'Full competitor pool C1..CN benchmark',
    description: 'Competitor roster, dimension matrix, gaps, and breakout strategy.',
  },
  'nova-research-academic-professional': {
    display_name: 'Nova-Academic & Professional',
    task_summary: 'Academic, government & professional delivery',
    description: 'Authoritative sources, rigorous structure, and traceable references for formal reports.',
  },
  'nova-ppt-aesthetic-slides': {
    display_name: 'Nova-Aesthetic Slides',
    task_summary: 'Outline → page brief → AI image slides',
    description: 'Eight visual presets, locked style, and 16:9 slide image sequences with manifest.',
  },
  'nova-customer-acquisition-leads': {
    display_name: 'Nova Lead Discovery',
    task_summary: 'B2B smart lead discovery → scored table report',
    description: 'Delivers a polished markdown table report; chat shows summary + top leads only, not raw JSON.',
  },
  'create-vid-scriptwriting': {
    display_name: 'Programmatic Video Script',
    task_summary: 'Structured YAML scripts with scenes, frames, narration, and motion cues for Remotion',
    description: 'Interview-driven planning output ready for programmatic video engines.',
  },
  'create-vid-saas-demo-script': {
    display_name: 'SaaS Demo Storyboard',
    task_summary: 'Shot-by-shot SaaS demo boards with Remotion timing and UI fidelity checks',
    description: 'Product UI walkthrough storyboards aligned with HyperFrames-style motion.',
  },
  'create-vid-seedance-prompt': {
    display_name: 'Seedance Storyboard Prompts',
    task_summary: 'Jimeng Seedance 2.0 prompts with @-reference syntax and storyboard templates',
    description: 'Platform-native prompts for short drama, e-commerce, and education clips.',
  },
  'create-vid-seedance-codec': {
    display_name: 'Seedance Camera Storyboard',
    task_summary: 'Z/Y/X/F camera encoding, 25-frame pipeline, and long-form segmentation',
    description: 'Chinese prompt engineering for extended Seedance productions.',
  },
  'create-vid-visual-prompt': {
    display_name: 'Cinematic Shot Planning',
    task_summary: 'Script-to-shot cards and model-specific prompts (Seedance, Kling, Veo)',
    description: 'Fourteen-field shot cards with concrete visual detail, not generic adjectives.',
  },
  'create-vid-director': {
    display_name: 'AI Director Storyboard',
    task_summary: 'Script breakdown, shot lists, keyframe prompts, and named director style overlays',
    description: 'Cinematic direction deliverables for AI video workflows.',
  },
  'create-vid-storyboard-pack': {
    display_name: 'Continuity Storyboard Pack',
    task_summary: 'Character/scene bibles, shot cards, handoff matrices, and edit notes',
    description: 'Continuity-first production packages for ads and short drama.',
  },
  'create-vid-seedance-series': {
    display_name: 'Short-Drama Storyboard',
    task_summary: 'Four-act scripts, asset lists, and multi-episode Seedance storyboards',
    description: 'Novel-to-series planning with episode handoff and extension notes.',
  },
  'create-vid-viral-copy': {
    display_name: 'Viral Video Copywriting',
    task_summary: 'Hook-driven short-form scripts for social and vertical video',
    description: 'Spoken scripts for TikTok, Reels, and Xiaohongshu-style clips.',
  },
  'mkt-dmp-video-script': {
    display_name: 'Marketing Video Script',
    task_summary: 'Timestamped marketing scripts with visual direction and platform specs',
    description: 'Full script packages with hooks, accessibility notes, and platform formatting.',
  },
  'mkt-brand-video': {
    display_name: 'Brand Video Storyboard',
    task_summary: 'Reusable brand promo structure and storyboard templates',
    description: 'Brand promo planning for intros, data highlights, and website promos.',
  },
};

function hasCjk(text) {
  return /[\u4e00-\u9fff]/.test(text || '');
}

function firstLine(text, max = 160) {
  if (!text) return '';
  const line = text.split(/\r?\n/)[0].trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

function excerpt(text, max = 220) {
  if (!text) return '';
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

const PROMPT_SUFFIX_EN = 'Start when ready.';

const SKILL_PROMPT_EN = {
  'mkt-social': 'Create a TikTok/Instagram content calendar for [product] with 5 short-video scripts and a posting schedule. Start working directly and tell me where outputs are saved when done.',
  'mkt-copywriting': 'Write landing page copy for [product]: headline, three benefits, CTA, and FAQ. Professional tone. Start working directly and tell me where outputs are saved when done.',
  'df-deep-research': 'Run deep research on [topic]: list sources first, then a conclusion summary. Start working directly and tell me where outputs are saved when done.',
  'open-design': 'Build a landing page for [product] with headline, three features, pricing, and a free trial CTA. Clean modern style. Start working directly and tell me where outputs are saved when done.',
  'nova-research-general': 'Write a general research report on [topic]: background, findings, sentiment, and recommendations. Start working directly and tell me where outputs are saved when done.',
  'nova-research-user-general': 'Run eight-section user research for [product]: personas, scenarios, pain points, and decisions. Start working directly and tell me where outputs are saved when done.',
  'nova-research-industry-market': 'Write an industry & market report for [sector]: size, chain, PEST/SWOT, and entry advice. Start working directly and tell me where outputs are saved when done.',
  'nova-research-product-user': 'Write product user research for [product] using the fixed eight-chapter template. Start working directly and tell me where outputs are saved when done.',
  'nova-research-competitor': 'Benchmark competitors C1..CN for [category] with a comparison matrix and breakout strategy. Start working directly and tell me where outputs are saved when done.',
  'nova-research-academic-professional': 'Write an academic/professional report on [topic] with authoritative sources and references. Start working directly and tell me where outputs are saved when done.',
  'nova-ppt-aesthetic-slides': 'Use Nova aesthetic slides workflow: 8×16:9 PNGs via outline → page descriptions → generate_image per slide (artifacts/slides-{slug}/), not HTML. Start working directly and tell me where outputs are saved when done.',
  'nova-customer-acquisition-leads': 'B2B lead discovery for [region + topic]: deliver leads-report.md with markdown tables; chat summary + top table only, no raw JSON. Start working directly and tell me where outputs are saved when done.',
  'create-vid-scriptwriting': 'Create a 30-second product demo YAML script for [product]: scenes, frame counts, narration, and motion cues for Remotion. Start when ready.',
  'create-vid-saas-demo-script': 'Write a 60-second SaaS feature demo storyboard with shot-by-shot Remotion timing for [product]. Start when ready.',
  'create-vid-seedance-prompt': 'Write a 15-second Seedance 2.0 storyboard prompt for [topic], including @-reference notes. Start when ready.',
  'create-vid-seedance-codec': 'Plan a 25-frame Seedance storyboard and long-form segmentation for [topic] using camera encoding. Start when ready.',
  'create-vid-visual-prompt': 'Break this script into 14-field shot cards and Seedance prompts: [paste script or outline]. Start when ready.',
  'create-vid-director': 'Write a shot list and keyframe prompts in Wong Kar-wai style for: [story synopsis]. Start when ready.',
  'create-vid-storyboard-pack': 'Deliver a continuity storyboard pack for [ad concept]: bibles, shot cards, and handoff matrix. Start when ready.',
  'create-vid-seedance-series': 'Adapt this story into a four-act short-drama script and episode 1 Seedance storyboard: [paste story]. Start when ready.',
  'create-vid-viral-copy': 'Write 3 hook-driven 30-second short-form video scripts for [product]. Start when ready.',
  'mkt-dmp-video-script': 'Write a 60-second TikTok marketing video script for [product] with a 3-second hook and timestamps. Start when ready.',
  'mkt-brand-video': 'Create a 15-second brand promo storyboard (6–8 shots) with narration and visual notes for [product]. Start when ready.',
};

function parseOpenDesignPrompts() {
  const catalogPath = path.join(REPO_ROOT, 'docs', 'open-design-design-catalog.md');
  const map = {};
  try {
    const md = readFileSync(catalogPath, 'utf8');
    const rowRe = /\|\s*[^|]+\|\s*`skills\/([^/`]+)\/SKILL\.md`\s*\|\s*([^|]+?)\s*\|\s*[^|]*\|/g;
    let match;
    while ((match = rowRe.exec(md)) !== null) {
      const slug = match[1].trim();
      const prompt = match[2].trim();
      if (slug && prompt && !map[slug]) {
        map[slug] = prompt;
      }
    }
  } catch {
    // design catalog optional at generation time
  }
  return map;
}

function isStageGenericExample(example, stage, welcomeExamples) {
  if (!example || !stage) return false;
  const stageExamples = welcomeExamples?.[stage];
  if (!Array.isArray(stageExamples)) return false;
  return stageExamples.includes(example);
}

function buildStandardExample(skill, locale, taskSummary, openDesignPrompts, welcomeExamples, displayName = '') {
  const slug = skill.slug;
  const summary = taskSummary || skill.name || slug;

  if (locale === 'zh-CN') {
    return getTryPromptZh(slug, displayName || summary);
  }

  if (SKILL_PROMPT_EN[slug]) return SKILL_PROMPT_EN[slug];
  if (slug.startsWith('od-') && openDesignPrompts[slug]) {
    return openDesignPrompts[slug]
      .replace(/【/g, '[')
      .replace(/】/g, ']')
      .replace(/直接开始做，做完告诉我文件在哪。/, PROMPT_SUFFIX_EN);
  }
  const explicit = Array.isArray(skill.examples) ? skill.examples.find((item) => item?.trim()) : '';
  if (explicit && !isStageGenericExample(explicit, skill.stage, welcomeExamples)) {
    return explicit.trim();
  }
  return `Help me with "${summary}": [describe your scenario, audience, and constraints]. ${PROMPT_SUFFIX_EN}`;
}

function loadHubZhDisplayNames() {
  try {
    const data = JSON.parse(readFileSync(HUB_ZH_PATH, 'utf8'));
    const map = {};
    for (const [slug, entry] of Object.entries(data.skills || {})) {
      const zh = entry['zh-CN'] || entry;
      if (zh?.display_name) map[slug] = zh.display_name;
    }
    return map;
  } catch {
    return {};
  }
}

/** 中文界面兜底：标题/简介/介绍须语言一致，禁止「中文名 + 英文介绍」 */
function finalizeZhLocale(slug, fields, fromCatalogSummary, fromCatalogDesc) {
  const auto = enrichZhLocaleFields(slug, fromCatalogSummary, fromCatalogDesc);
  const out = { ...fields };

  if (!hasCjk(out.display_name) && hasCjk(auto.display_name)) {
    out.display_name = auto.display_name.slice(0, 12);
  }
  if (!hasCjk(out.task_summary) && hasCjk(auto.task_summary)) {
    out.task_summary = auto.task_summary;
  }
  if (!hasCjk(out.description) || isCapabilityCopyPlaceholder(out.description)) {
    if (hasCjk(auto.description) && !isCapabilityCopyPlaceholder(auto.description)) {
      out.description = auto.description;
    } else if (hasCjk(out.task_summary) && !isCapabilityCopyPlaceholder(out.task_summary)) {
      out.description = `${out.task_summary}。按技能指引产出可交付文件。`;
    }
  }
  if (hasCjk(out.display_name) && !hasCjk(out.task_summary) && hasCjk(auto.task_summary)) {
    out.task_summary = auto.task_summary;
  }
  return out;
}

/** 能力中心卡片标题：优先中文，长度 2–12 字（与 check-capabilities-i18n-zh 一致） */
function resolveZhDisplayName(skill, hubZhNames, taskSummary) {
  const fromHub = hubZhNames[skill.slug];
  if (fromHub && hasCjk(fromHub)) return fromHub.slice(0, 12);
  const fromCatalog = skill.display_name || skill.name;
  if (fromCatalog && hasCjk(fromCatalog)) return String(fromCatalog).slice(0, 12);
  const fromSummary = firstLine(taskSummary || skill.task_summary || skill.description || '');
  if (fromSummary && hasCjk(fromSummary)) return fromSummary.slice(0, 12);
  return fromSummary.slice(0, 12) || skill.slug;
}

function meaningfulCatalogText(value) {
  if (isCapabilityCopyPlaceholder(value)) return '';
  return typeof value === 'string' ? value.trim() : '';
}

function buildSkillLocale(skill, locale, openDesignPrompts, welcomeExamples, hubZhNames = {}) {
  const slug = skill.slug;
  const fromCatalogSummary =
    meaningfulCatalogText(firstLine(skill.task_summary || ''))
    || meaningfulCatalogText(firstLine(skill.description || ''))
    || skill.name;
  const fromCatalogDesc = meaningfulCatalogText(excerpt(skill.description || ''))
    || meaningfulCatalogText(excerpt(skill.task_summary || ''));

  let fields;
  if (locale === 'zh-CN') {
    const curated = SKILL_ZH[slug];
    const slugZhOverride = hasExplicitZhOverride(slug);
    if (slugZhOverride) {
      const auto = enrichZhLocaleFields(slug, fromCatalogSummary, fromCatalogDesc);
      fields = {
        display_name: auto.display_name.slice(0, 12),
        task_summary: auto.task_summary,
        description: auto.description,
      };
    } else if (curated) {
      fields = {
        // PD-SAAS-FORK: curated.display_name 优先，禁止仅用 task_summary 截断冒充卡名
        display_name:
          curated.display_name && hasCjk(curated.display_name)
            ? String(curated.display_name).slice(0, 12)
            : resolveZhDisplayName(skill, hubZhNames, curated.task_summary),
        task_summary: curated.task_summary,
        description: curated.description || curated.task_summary,
      };
    } else if (
      (meaningfulCatalogText(skill.task_summary) && hasCjk(skill.task_summary))
      || (meaningfulCatalogText(skill.description) && hasCjk(skill.description))
    ) {
      const summarySource = meaningfulCatalogText(skill.task_summary)
        ? firstLine(skill.task_summary)
        : firstLine(skill.description);
      const descSource = meaningfulCatalogText(skill.description)
        ? excerpt(skill.description)
        : excerpt(skill.task_summary);
      fields = {
        display_name: resolveZhDisplayName(skill, hubZhNames, summarySource),
        task_summary: summarySource,
        description: descSource,
      };
    } else {
      const auto = enrichZhLocaleFields(skill.slug, fromCatalogSummary, fromCatalogDesc);
      const hubName = hubZhNames[skill.slug];
      fields = {
        display_name: hubName && hasCjk(hubName)
          ? hubName.slice(0, 12)
          : (hasCjk(auto.display_name)
            ? auto.display_name.slice(0, 12)
            : resolveZhDisplayName(skill, hubZhNames, auto.task_summary)),
        task_summary: auto.task_summary,
        description: auto.description,
      };
    }
    fields = finalizeZhLocale(slug, fields, fromCatalogSummary, fromCatalogDesc);
    if (skill.setup_hint && hasCjk(skill.setup_hint)) {
      fields.setup_hint = skill.setup_hint;
    }
  } else {
    const curatedEn = SKILL_EN[slug];
    if (curatedEn) {
      fields = {
        ...(curatedEn.display_name ? { display_name: curatedEn.display_name } : {}),
        task_summary: curatedEn.task_summary,
        description: curatedEn.description || curatedEn.task_summary,
      };
    } else if (!hasCjk(skill.task_summary) && !hasCjk(skill.description)) {
      fields = {
        task_summary: fromCatalogSummary,
        description: fromCatalogDesc,
      };
    } else {
      const humanized = slug
        .replace(/^(mkt|df|ala|od|pms)-/, '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      fields = {
        task_summary: humanized,
        description: humanized,
      };
    }
  }

  return {
    ...fields,
    examples: [buildStandardExample(
      skill,
      locale,
      fields.task_summary,
      openDesignPrompts,
      welcomeExamples,
      fields.display_name,
    )],
  };
}

function buildZhCatalogMarkdown(i18nPayload, catalog) {
  const stageOrder = ['research', 'strategy', 'create', 'activate', 'distribute', 'measure', 'education', 'uncategorized'];
  const byStage = new Map(stageOrder.map((id) => [id, []]));
  for (const skill of catalog.skills || []) {
    const row = i18nPayload.skills[skill.slug]?.['zh-CN'];
    if (!row) continue;
    const list = byStage.get(skill.stage) || [];
    list.push({
      slug: skill.slug,
      stage: skill.stage,
      stage_order: skill.stage_order,
      hub_sort: skill.hub_sort,
      ...row,
      level: skill.integration_level || 'L1',
    });
    byStage.set(skill.stage, list);
  }
  const lines = [
    '# 能力中心 — 你能做什么（中文目录）',
    '',
    '> 由 `node scripts/generate-capabilities-i18n.mjs` 自动生成，请勿手改。技能变更后重新运行生成器。',
    '',
    `**更新时间：** ${i18nPayload.generated_at}`,
    '',
    '在 PilotDeck 顶部打开 **能力中心** 标签，或对话里说「帮我做…」即可使用下列能力。',
    '',
  ];
  for (const stageId of stageOrder) {
    const stage = i18nPayload.stages[stageId]?.['zh-CN'];
    const items = byStage.get(stageId) || [];
    if (!stage || items.length === 0) continue;
    lines.push(`## ${stage.label}`, '', stage.summary || '', '');
    for (const item of items.sort(compareCapabilitiesForHub)) {
      lines.push(`### ${item.task_summary}`, '', item.description || '', '', `- 标识：\`${item.slug}\` · 级别：${item.level}`, '');
    }
  }
  return `${lines.join('\n')}\n`;
}

function buildEnCatalogMarkdown(i18nPayload, catalog) {
  const stageOrder = ['research', 'strategy', 'create', 'activate', 'distribute', 'measure', 'education', 'uncategorized'];
  const byStage = new Map(stageOrder.map((id) => [id, []]));
  for (const skill of catalog.skills || []) {
    const row = i18nPayload.skills[skill.slug]?.en;
    if (!row) continue;
    const list = byStage.get(skill.stage) || [];
    list.push({
      slug: skill.slug,
      stage: skill.stage,
      stage_order: skill.stage_order,
      hub_sort: skill.hub_sort,
      ...row,
      level: skill.integration_level || 'L1',
    });
    byStage.set(skill.stage, list);
  }
  const lines = [
    '# Capability Hub — What You Can Do (English catalog)',
    '',
    '> Auto-generated by `node scripts/generate-capabilities-i18n.mjs`. Regenerate after skill changes.',
    '',
    `**Updated:** ${i18nPayload.generated_at}`,
    '',
  ];
  for (const stageId of stageOrder) {
    const stage = i18nPayload.stages[stageId]?.en;
    const items = byStage.get(stageId) || [];
    if (!stage || items.length === 0) continue;
    lines.push(`## ${stage.label}`, '', stage.summary || '', '');
    for (const item of items.sort(compareCapabilitiesForHub)) {
      lines.push(`### ${item.task_summary}`, '', item.description || '', '', `- ID: \`${item.slug}\` · Level: ${item.level}`, '');
    }
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  const hubZhNames = loadHubZhDisplayNames();
  const openDesignPrompts = parseOpenDesignPrompts();
  const welcomeExamples = catalog.welcome_examples || {};
  const skills = {};
  for (const skill of catalog.skills || []) {
    skills[skill.slug] = {
      hub_sort: skill.hub_sort,
      stage: skill.stage,
      stage_order: skill.stage_order,
      'zh-CN': buildSkillLocale(skill, 'zh-CN', openDesignPrompts, welcomeExamples, hubZhNames),
      en: buildSkillLocale(skill, 'en', openDesignPrompts, welcomeExamples, hubZhNames),
    };
  }

  const payload = {
    generated_at: new Date().toISOString(),
    version: 1,
    stages: STAGE_I18N,
    skills,
  };

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  const uiGeneratedDir = path.join(REPO_ROOT, 'ui', 'src', 'generated');
  mkdirSync(uiGeneratedDir, { recursive: true });
  const uiGeneratedPath = path.join(uiGeneratedDir, 'capabilities.i18n.json');
  writeFileSync(uiGeneratedPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  // PD-SAAS-FORK: 生产镜像可能不含 docs/（pack 排除）；缺目录时跳过 Markdown，勿阻断 i18n 热修
  let zhDocPath = null;
  try {
    const docsDir = path.join(REPO_ROOT, 'docs');
    mkdirSync(docsDir, { recursive: true });
    zhDocPath = path.join(docsDir, 'capabilities-hub-catalog.zh-CN.md');
    writeFileSync(zhDocPath, buildZhCatalogMarkdown(payload, catalog), 'utf8');
    const enDocPath = path.join(docsDir, 'capabilities-hub-catalog.en.md');
    writeFileSync(enDocPath, buildEnCatalogMarkdown(payload, catalog), 'utf8');
  } catch (err) {
    console.warn('[capabilities-i18n] skip docs markdown:', err instanceof Error ? err.message : err);
  }
  const zhComplete = Object.values(skills).filter((s) => hasCjk(s['zh-CN'].task_summary)).length;
  const zhDisplay = Object.values(skills).filter((s) => hasCjk(s['zh-CN'].display_name)).length;
  const withExamples = Object.values(skills).filter((s) => Array.isArray(s['zh-CN'].examples) && s['zh-CN'].examples[0]).length;
  console.log(`[capabilities-i18n] skills=${Object.keys(skills).length} zh_summaries=${zhComplete} zh_display_names=${zhDisplay} zh_examples=${withExamples}`);
  console.log(`[capabilities-i18n] wrote ${OUTPUT_PATH}`);
  console.log(`[capabilities-i18n] wrote ${uiGeneratedPath}`);
  if (zhDocPath) console.log(`[capabilities-i18n] wrote ${zhDocPath}`);
}

main();
