/**
 * Auto-generate Chinese display_name / task_summary / description for vendor slugs.
 * PD-SAAS-FORK: fills gaps when SKILL.md and curated SKILL_ZH lack zh copy.
 */
import { dmpTailToZh } from './dmpPackZh.mjs';
import { pmPackTailZh } from './pmPackZh.mjs';

const CJK = /[\u4e00-\u9fff]/;

const PREFIX_META = {
  'pms-': { label: 'PM', vendor: 'Phuryn', summaryPrefix: 'PM 工具包' },
  'pmd-': { label: '方法', vendor: 'Dean Peters', summaryPrefix: '产品方法论' },
  'mkt-aso-': { label: 'ASO', vendor: 'ASO', summaryPrefix: '应用商店' },
  'mkt-adv-': { label: '广告', vendor: '广告', summaryPrefix: '广告漏斗' },
  'mkt-brand-': { label: '品牌站', vendor: '品牌建站', summaryPrefix: '品牌官网' },
  'mkt-dmp-': { label: '数营', vendor: '数字营销', summaryPrefix: '数字营销' },
  'mkt-typefully-': { label: '排程', vendor: 'Typefully', summaryPrefix: 'Typefully' },
  'edu-sci-': { label: '科研', vendor: '科研', summaryPrefix: '科研工具' },
  'fal-': { label: 'Fal', vendor: 'fal.ai', summaryPrefix: 'Fal 多模态' },
  'create-ui-': { label: 'UI', vendor: 'UI', summaryPrefix: 'UI 规范' },
  'create-threejs-': { label: '3D', vendor: 'Three.js', summaryPrefix: 'Three.js' },
  'video-db-': { label: '视频库', vendor: 'VideoDB', summaryPrefix: 'VideoDB' },
  'dev-hamel-': { label: '评测', vendor: '评测', summaryPrefix: 'LLM 评测' },
  'office-minimax-': { label: 'MiniMax', vendor: 'MiniMax', summaryPrefix: 'MiniMax 办公' },
  'anth-': { label: '官方', vendor: 'Anthropic', summaryPrefix: 'Anthropic 官方' },
  'hf-': { label: 'HF', vendor: 'HyperFrames', summaryPrefix: 'HyperFrames' },
  'persona-': { label: '名人', vendor: '', summaryPrefix: '' },
  'teacher-': { label: '教学', vendor: 'Hermes', summaryPrefix: '教学' },
  'college-': { label: '学业', vendor: '学业', summaryPrefix: '学业' },
  'nova-': { label: 'Nova', vendor: 'Nova', summaryPrefix: 'Nova' },
  'geo-': { label: 'GEO', vendor: 'GEO', summaryPrefix: 'GEO' },
  'od-': { label: '设计', vendor: 'Open Design', summaryPrefix: '设计模板' },
  'mkt-': { label: '营销', vendor: '营销', summaryPrefix: '营销' },
  'fc-': { label: 'Firecrawl', vendor: 'Firecrawl', summaryPrefix: 'Firecrawl' },
  'legal-lav-': { label: '法务', vendor: '法务', summaryPrefix: '法务合规' },
  'df-': { label: '调研', vendor: 'DeerFlow', summaryPrefix: '调研' },
  'ala-': { label: '助手', vendor: '助手', summaryPrefix: '助手' },
  'dev-': { label: '开发', vendor: '开发', summaryPrefix: '开发' },
  'create-': { label: '创作', vendor: '创作', summaryPrefix: '创作' },
  'office-': { label: '办公', vendor: '办公', summaryPrefix: '办公' },
  'edu-': { label: '教育', vendor: '教育', summaryPrefix: '教育' },
};

/** Longest-match phrases (slug tail fragments). */
const SEGMENT_ZH = {
  'customer-journey-mapping-workshop': '用户旅程工作坊',
  'customer-journey-map': '用户旅程图',
  'opportunity-solution-tree': '机会方案树',
  'competitor-experience-audit': '竞品体验审计',
  'competitor-analysis': '竞品分析',
  'programmatic-seo': '程序化SEO',
  'content-strategy': '内容策略',
  'roadmap-planning': '路线图规划',
  'seo-keyword-gap-audit': '关键词缺口审计',
  'seo-content-gap-audit': '内容缺口审计',
  'seo-site-health-audit': '站点健康审计',
  'seo-audit-orchestration': 'SEO审计编排',
  'seo-rank-tracking': '排名跟踪',
  'seo-traffic-diagnosis': '流量诊断',
  'seo-backlink-audit': '外链审计',
  'seo-content-audit': '内容SEO审计',
  'seo-aeo-geo': 'SEO与AI搜索',
  'seo-competitor': 'SEO竞品',
  'seo-technical': '技术SEO',
  'seo-onpage': '页面SEO',
  'seo-offpage': '站外SEO',
  'seo-keyword': '关键词研究',
  'brand-discovery': '品牌发现',
  'brand-identity': '品牌识别',
  'brand-voice': '品牌语气',
  'brand-style-guide': '品牌规范',
  'brand-archetype-system': '品牌原型',
  'brand-ideation': '品牌创意',
  'content-and-copy': '网站文案',
  'content-brief-authoring': '内容Brief',
  'content-distribution': '内容分发',
  'content-migration': '内容迁移',
  'content-refresh-system': '内容刷新',
  'content-repurposing': '内容复用',
  'landing-page-copy': '落地页文案',
  'paid-media-strategy': '付费投放',
  'analytics-strategy': '分析策略',
  'experiment-design': '实验设计',
  'experimentation-analytics': '实验分析',
  'experimentation-platform-orchestrator': '实验平台',
  'funnel-flow-architecture': '漏斗架构',
  'launch-runbook': '上线清单',
  'cro-optimization': '转化优化',
  'design-system': '设计系统',
  'editorial-qa': '编辑质检',
  'email-sequences': '邮件序列',
  'email-deliverability': '邮件送达',
  'feature-launch-playbook': '功能发布',
  'feature-flagging': '功能开关',
  'form-strategy': '表单策略',
  'frontend-component-build': '前端组件',
  'information-architecture': '信息架构',
  'internationalization': '国际化',
  'journey-mapping': '旅程地图',
  'jtbd-framing': 'JTBD框架',
  'lead-magnet-design': '引流磁铁',
  'logo-design': 'Logo设计',
  'okr-design': 'OKR设计',
  'onboarding-wizard-design': '新手向导',
  'team-onboarding-playbook': '团队入职',
  'performance-optimization': '性能优化',
  'pillar-content-architecture': '支柱内容',
  'pm-spec-writing': '产品规格',
  'product-analytics-setup': '产品分析',
  'programmatic-seo': '程序化SEO',
  'quiz-and-assessment-design': '测验设计',
  'security-baseline': '安全基线',
  'swot-analysis': 'SWOT分析',
  'pestle-analysis': 'PESTLE分析',
  'pestel-analysis': 'PESTEL分析',
  'lean-canvas': '精益画布',
  'startup-canvas': '创业画布',
  'business-model': '商业模式',
  'value-proposition': '价值主张',
  'pricing-strategy': '定价策略',
  'market-sizing': '市场规模',
  'user-personas': '用户画像',
  'go-to-market': 'GTM策略',
  'gtm-strategy': 'GTM策略',
  'monetization-strategy': '变现策略',
  'product-strategy': '产品策略',
  'strategy-red-team': '策略红队',
  'prioritization-frameworks': '优先级框架',
  'prioritize-assumptions': '假设优先级',
  'prioritize-features': '功能优先级',
  'marketing-ideas': '营销点子',
  'keyword-research': '关键词研究',
  'scientific-brainstorming': '科研头脑风暴',
  'scientific-schematics': '科研示意图',
  'scientific-slides': '科研幻灯',
  'scientific-visualization': '科研可视化',
  'scientific-writing': '科研写作',
  'calculator-design': 'ROI计算器',
  'chatbot-flow-design': '聊天机器人',
  'comparison-tool-design': '对比工具',
  'multi-step-form-design': '多步表单',
  'product-configurator-design': '产品配置器',
  'scheduler-and-booking-design': '预约排程',
  'upgrade-flow-design': '升级转化',
  'app-icon-optimization': '图标优化',
  'paywall-optimization': '付费墙优化',
  'retention-optimization': '留存优化',
  'app-analytics': '应用分析',
  'crash-analytics': '崩溃分析',
  'deep-research': '深度调研',
  'podcast-generation': '播客生成',
  'humanizer': '去AI味润色',
  unslop: '去八股润色',
  'next-best-practices': 'Next实践',
  'sentry-sdk-setup': 'Sentry接入',
  'youtube-clipper': 'YouTube切片',
  'nanobanana-ppt': 'NanoBanana幻灯',
  'ai-music': 'AI音乐',
  'diagram-maker': '图表制作',
  'threejs-animation': '3D动画',
  'threejs-fundamentals': '3D基础',
  'threejs-geometry': '3D几何',
  'threejs-interaction': '3D交互',
  'threejs-lighting': '3D光照',
  'threejs-loaders': '3D加载',
  'threejs-materials': '3D材质',
  'threejs-postprocessing': '3D后期',
  'threejs-shaders': '3D着色器',
  'threejs-textures': '3D贴图',
  'claude-seo': 'SEO全站分析',
  'firecrawl-scrape': '网页抓取',
  'firecrawl-crawl': '站点爬取',
  'firecrawl-map': '站点地图',
  'firecrawl-parse': '内容解析',
  'firecrawl-download': '文件下载',
  'firecrawl-interact': '页面交互',
  'firecrawl-monitor': '变更监测',
  'firecrawl-agent': '智能抓取',
  'ui-skills-root': 'UI技能库',
  'email-bible': '邮件营销圣经',
  last30days: '近30天热点',
  'x-article-publisher': 'X长文发布',
  metadata: '元数据优化',
  localization: '本地化',
  'screenshot-optimization': '截图优化',
  'review-management': '评论管理',
  'apple-search-ads': 'Apple搜索广告',
  'custom-product-pages': '自定义产品页',
  'in-app-events': '应用内活动',
  'aso-audit': 'ASO审计',
};

const WORD_ZH = {
  seo: 'SEO', geo: 'GEO', api: 'API', ux: 'UX', ui: 'UI', qa: '质检',
  ads: '广告', email: '邮件', content: '内容', brand: '品牌', design: '设计',
  research: '调研', strategy: '策略', analytics: '分析', security: '安全',
  testing: '测试', deploy: '部署', monitoring: '监控', incident: '事故',
  roadmap: '路线图', experiment: '实验', funnel: '漏斗', landing: '落地页',
  wizard: '向导', onboarding: '引导', competitor: '竞品', keyword: '关键词',
  audit: '审计', optimization: '优化', performance: '性能', copy: '文案',
  creative: '创意', media: '媒体', paid: '付费', programmatic: '程序化',
};

const PERSONA_ZH = {
  'persona-buffett': '巴菲特思维',
  'persona-duan-yongping': '段永平思维',
  'persona-steve-jobs': '乔布斯思维',
  'persona-elon-musk': '马斯克思维',
  'persona-munger': '芒格思维',
  'persona-feynman': '费曼思维',
  'persona-naval': 'Naval思维',
  'persona-taleb': '塔勒布思维',
  'persona-zizek': '齐泽克思维',
  'persona-trump': '特朗普思维',
  'persona-zhang-yiming': '张一鸣思维',
};

/** Explicit disambiguation for same English name, different slug. */
const SLUG_ZH_OVERRIDE = {
  // PD-SAAS-FORK: 勿用 task_summary 截断当卡名，否则「智能获客」线上搜不到
  'nova-customer-acquisition-leads': {
    display_name: 'Nova-智能获客',
    task_summary: 'B2B 智能获客：检索→抽取→评分线索表',
  },
  // PD-SAAS-FORK: Hub 显示名 P0（docs/hub-capability-name-visibility-audit-20260812.zh-CN.md）
  'hf-hyperframes': {
    display_name: 'HTML代码做视频',
    task_summary: '用 HTML/工程渲染出真 MP4 宣传片',
  },
  'hf-website-to-video': {
    display_name: '网站一键成片',
    task_summary: '抓取网址自动出宣传片',
  },
  'html-ppt': {
    display_name: 'HTML演示稿',
    task_summary: '专业 HTML 演示稿与主题模板',
  },
  'remotion-video': {
    display_name: 'React程序化视频',
    task_summary: 'Remotion 程序化短视频工程',
  },
  'nova-ppt-aesthetic-slides': {
    display_name: 'Nova-美学幻灯',
    task_summary: '大纲→页描述→文生图配图的 PNG 幻灯包',
  },
  'ppt-master': {
    display_name: '原生可编辑 PPT',
    task_summary: '从文档生成 PowerPoint 原生形状/动画/备注的可编辑 PPTX',
  },
  'hf-product-launch-video': { display_name: 'HF·产品发布片', task_summary: '产品发布会风格 HyperFrames 成片' },
  'hf-faceless-explainer': { display_name: 'HF·无脸解说', task_summary: '无出镜口播解说成片' },
  'hf-motion-graphics': { display_name: 'HF·动态图形', task_summary: '动态图形与信息动画成片' },
  'hf-general-video': { display_name: 'HF·通用成片', task_summary: '通用 HyperFrames 视频工程' },
  'hf-slideshow': { display_name: 'HF·幻灯成片', task_summary: '幻灯序列转视频成片' },
  'create-vid-scriptwriting': { display_name: '视频脚本写作', task_summary: '结构化分镜脚本与旁白' },
  'create-vid-saas-demo-script': { display_name: 'SaaS演示脚本', task_summary: 'SaaS 产品演示分镜脚本' },
  'create-vid-seedance-prompt': { display_name: 'Seedance提示词', task_summary: 'Seedance 分镜提示词' },
  'create-vid-seedance-codec': { display_name: 'Seedance编码规范', task_summary: 'Seedance 编码与参数规范' },
  'create-vid-visual-prompt': { display_name: '视频画面提示词', task_summary: '画面构图与镜头提示词' },
  'create-vid-director': { display_name: 'AI导演分镜', task_summary: 'AI 导演视角分镜规划' },
  'create-vid-storyboard-pack': { display_name: '分镜包', task_summary: '成套分镜与镜头包交付' },
  'consult-finance': { display_name: '财务顾问', task_summary: '账、资金、对账与报表口径口语答疑' },
  'consult-tax': { display_name: '税务顾问', task_summary: '发票、增值税、企税与合法优惠边界答疑' },
  'consult-hr': { display_name: '人力顾问', task_summary: '录用、薪酬工时、解除与手册竞业答疑' },
  'consult-legal': { display_name: '法律顾问', task_summary: '主体治理、监管入门与争议框架口语答疑' },
  'consult-contract': { display_name: '合同顾问', task_summary: '合同条款风险口语解读与改法方向' },
  'consult-policy': { display_name: '政策顾问', task_summary: '惠企、专精特新与地方补贴路径咨询' },
  'geo-competitor-analysis': { display_name: 'GEO竞品分析', task_summary: '对比竞品在 AI 搜索中的提及与引用' },
  'pms-competitor-analysis': { display_name: 'PM·竞品分析', task_summary: 'PM 包：竞品优劣势与定位对比' },
  'mkt-aso-competitor-analysis': { display_name: 'ASO·竞品分析', task_summary: '应用商店竞品元数据与关键词对比' },
  'mkt-content-strategy': { display_name: '内容策略', task_summary: '规划写什么、话题簇与内容日历' },
  'mkt-brand-content-strategy': { display_name: '品牌站·内容策略', task_summary: '品牌官网内容定位与编辑策略' },
  'mkt-programmatic-seo': { display_name: '程序化SEO', task_summary: '模板化批量生成 SEO 落地页' },
  'mkt-brand-programmatic-seo': { display_name: '品牌站·程序化SEO', task_summary: '品牌站规模化 SEO 页面方案' },
  'pms-customer-journey-map': { display_name: 'PM·用户旅程', task_summary: 'PM 包：端到端用户旅程地图' },
  'pmd-customer-journey-map': { display_name: '方法·用户旅程', task_summary: '方法论：分阶段触点旅程图' },
  'pmd-customer-journey-mapping-workshop': { display_name: '旅程工作坊', task_summary: '引导式用户旅程映射工作坊' },
  'pms-opportunity-solution-tree': { display_name: 'PM·机会树', task_summary: 'PM 包：机会-方案树 OST' },
  'pmd-opportunity-solution-tree': { display_name: '方法·机会树', task_summary: '方法论：从成果到机会的 OST' },
  'pmd-roadmap-planning': { display_name: '方法·路线图', task_summary: '方法论：优先级与路线图规划' },
  'mkt-brand-roadmap-planning': { display_name: '品牌站·路线图', task_summary: '品牌项目多季度路线图' },
  'mkt-brand-seo-keyword': { display_name: '品牌站·关键词', task_summary: '品牌站关键词研究与聚类' },
  'mkt-brand-seo-keyword-gap-audit': { display_name: '品牌·词缺口', task_summary: '竞品有排名而本站缺失的词' },
  'mkt-brand-onboarding-wizard-design': { display_name: '产品新手向导', task_summary: '产品内首次使用引导向导' },
  'mkt-brand-team-onboarding-playbook': { display_name: '团队入职手册', task_summary: '新成员团队入职体验设计' },
  'mkt-brand-competitor-experience-audit': { display_name: '竞品体验审计', task_summary: '竞品网站品牌与 UX 体验审计' },
  'mkt-brand-seo-competitor': { display_name: 'SEO竞品对比', task_summary: '与竞品网站的 SEO 对比分析' },
  'geo-keyword-research': { display_name: 'GEO·挖词', task_summary: 'AI 搜索场景关键词与提问句式' },
  'mkt-aso-keyword-research': { display_name: 'ASO·挖词', task_summary: '应用商店关键词发现与优先级' },
  'pms-marketing-ideas': { display_name: 'PM·营销点子', task_summary: 'PM 包：低成本创意营销方案' },
  'mkt-marketing-ideas': { display_name: '营销点子', task_summary: 'SaaS 创意营销与渠道灵感' },
  'pms-gtm-strategy': { display_name: 'PM·GTM', task_summary: 'PM 包：上市渠道与 GTM 策略' },
  'pms-monetization-strategy': { display_name: 'PM·变现', task_summary: 'PM 包：变现模式与验证路径' },
  'pms-product-strategy': { display_name: 'PM·产品策', task_summary: 'PM 包：九段式产品战略文档' },
  'pms-strategy-red-team': { display_name: 'PM·红队', task_summary: 'PM 包：策略/路线图红队挑战' },
  'pms-prioritization-frameworks': { display_name: 'PM·优先级', task_summary: 'PM 包：九种优先级框架速查' },
  'pms-prioritize-assumptions': { display_name: 'PM·假设排', task_summary: 'PM 包：假设影响×风险矩阵' },
  'pms-prioritize-features': { display_name: 'PM·功能排', task_summary: 'PM 包：按影响与成本排功能' },
  'pms-brainstorm-experiments-existing': { display_name: 'PM·存量实验', task_summary: 'PM 包：存量产品假设验证实验' },
  'pms-brainstorm-experiments-new': { display_name: 'PM·新品实验', task_summary: 'PM 包：新品 pretotype 实验设计' },
  'pms-identify-assumptions-existing': { display_name: 'PM·存量假设', task_summary: 'PM 包：存量功能 risky 假设' },
  'pms-identify-assumptions-new': { display_name: 'PM·新品假设', task_summary: 'PM 包：新品八维 risky 假设' },
  'pms-product-name': { display_name: 'PM·起名', task_summary: 'PM 包：产品命名头脑风暴' },
  'pms-product-vision': { display_name: 'PM·愿景', task_summary: 'PM 包：产品愿景陈述' },
  'pms-summarize-interview': { display_name: 'PM·访纲', task_summary: 'PM 包：用户访谈纪要结构化' },
  'pms-summarize-meeting': { display_name: 'PM·会议纪要', task_summary: 'PM 包：会议记录结构化摘要' },
  'mkt-brand-calculator-design': { display_name: 'ROI计算器', task_summary: '品牌官网·交互计算器设计' },
  'mkt-brand-chatbot-flow-design': { display_name: '聊天机器人', task_summary: '品牌官网·对话流设计' },
  'mkt-brand-comparison-tool-design': { display_name: '对比工具', task_summary: '品牌官网·方案对比页设计' },
  'mkt-brand-design-standards': { display_name: '设计标准', task_summary: '品牌官网·生产级设计规范' },
  'mkt-brand-multi-step-form-design': { display_name: '多步表单', task_summary: '品牌官网·分步表单体验' },
  'mkt-brand-product-configurator-design': { display_name: '产品配置器', task_summary: '品牌官网·选配器交互' },
  'mkt-brand-scheduler-and-booking-design': { display_name: '预约排程', task_summary: '品牌官网·预约/订座流程' },
  'mkt-brand-upgrade-flow-design': { display_name: '升级转化', task_summary: '品牌官网·免费转付费路径' },
  'mkt-brand-creative-brief': { display_name: '创意Brief', task_summary: '品牌官网·创意简报撰写' },
  'mkt-brand-creative-brief-selector': { display_name: 'Brief选型', task_summary: '品牌官网·参考站驱动 Brief' },
  'mkt-brand-creative-direction': { display_name: '创意方向', task_summary: '品牌官网·四轴创意方向' },
  'edu-sci-scientific-brainstorming': { display_name: '科研·头脑暴', task_summary: '科研·开放课题头脑风暴' },
  'edu-sci-scientific-schematics': { display_name: '科研·示意图', task_summary: '科研·论文级示意图' },
  'edu-sci-scientific-slides': { display_name: '科研·幻灯', task_summary: '科研·学术报告幻灯' },
  'edu-sci-scientific-visualization': { display_name: '科研·可视化', task_summary: '科研·出版级图表' },
  'edu-sci-scientific-writing': { display_name: '科研·写作', task_summary: '科研·论文深度写作' },
  'edu-sci-market-research-reports': { display_name: '科研·市报', task_summary: '科研·长篇市场研究报告' },
  'edu-sci-research-grants': { display_name: '科研·基金', task_summary: '科研·基金申请书' },
  'edu-sci-research-lookup': { display_name: '科研·检索', task_summary: '科研·并行文献检索' },
  'pmd-ai-shaped-readiness-advisor': { display_name: 'AI就绪顾问', task_summary: '方法论：AI-first 就绪评估' },
  'pmd-director-readiness-advisor': { display_name: '总监就绪', task_summary: '方法论：PM 升总监辅导' },
  'pmd-vp-cpo-readiness-advisor': { display_name: 'VP就绪', task_summary: '方法论：升 VP/CPO 辅导' },
  'mkt-aso-app-icon-optimization': { display_name: 'ASO·图标', task_summary: '应用商店·图标 A/B 优化' },
  'mkt-aso-paywall-optimization': { display_name: 'ASO·付费墙', task_summary: '应用商店·付费墙优化' },
  'mkt-aso-retention-optimization': { display_name: 'ASO·留存', task_summary: '应用商店·留存与 engagement' },
  'mkt-aso-app-analytics': { display_name: 'ASO·应用分析', task_summary: '应用商店·分析看板解读' },
  'mkt-aso-crash-analytics': { display_name: 'ASO·崩溃', task_summary: '应用商店·崩溃监控治理' },
  'mkt-image': { display_name: '营销生图', task_summary: '按营销场景生成广告配图' },
  'tool-generate-image': { display_name: '对话生图', task_summary: '对话内按描述生成海报配图' },
  'mkt-emails': { display_name: '邮件营销', task_summary: '邮件序列与触达编排' },
  'mkt-email-sequence': { display_name: '邮件序列', task_summary: 'AI 友好结构邮件序列' },
  'anth-docx': { display_name: 'Word文档', task_summary: 'Anthropic 官方 Word 读写' },
  'edu-sci-docx': { display_name: '科研·Word', task_summary: '科研场景 Word 文档处理' },
  'anth-xlsx': { display_name: 'Excel表格', task_summary: 'Anthropic 官方 Excel 读写' },
  'edu-sci-xlsx': { display_name: '科研·Excel', task_summary: '科研场景 Excel 处理' },
  'anth-pptx': { display_name: 'PPT幻灯', task_summary: 'Anthropic 官方 PPT 读写' },
  'edu-sci-pptx': { display_name: '科研·PPT', task_summary: '科研场景 PPT 处理' },
  'anth-pdf': { display_name: 'PDF工具', task_summary: 'PDF 提取合并与分析' },
  'edu-sci-pdf': { display_name: '科研·PDF', task_summary: '科研场景 PDF 处理' },
  'df-deep-research': { display_name: '深度调研', task_summary: 'DeerFlow 多源深度调研' },
  'ala-deep-research': { display_name: '助手调研', task_summary: '多源综合调研助手' },
  'mkt-aso-market-movers': { display_name: 'ASO·榜单动', task_summary: '应用商店·榜单排名异动跟踪' },
  'mkt-aso-market-pulse': { display_name: 'ASO·市场脉', task_summary: '应用商店·市场整体脉搏概览' },
  'mkt-brand-ai-content-collaboration': { display_name: '人机协作', task_summary: '品牌站·人机内容协作分工' },
  'mkt-brand-long-form-content-frameworks': { display_name: '长文框架', task_summary: '品牌站·长文内容结构模式' },
  'mkt-brand-documentation-strategy': { display_name: '文档策略', task_summary: '品牌站·产品文档体系规划' },
  'mkt-brand-domain-strategy': { display_name: '域名策略', task_summary: '品牌站·域名组合与治理' },
  'fal-genmedia': { display_name: 'Fal·媒体CLI', task_summary: 'Fal genmedia 命令行检索与运行' },
  'fal-genmedia-workflow': { display_name: 'Fal·工作流', task_summary: 'Fal 多步媒体工作流编排' },
  'pmd-discovery-interview-prep': { display_name: '发现访谈备', task_summary: '方法论：客户发现访谈准备' },
  'pmd-product-sense-interview-answer': { display_name: '产品感面试', task_summary: '方法论：产品感面试答题结构' },
  'pmd-positioning-statement': { display_name: '定位陈述', task_summary: '方法论：Moore 式定位陈述' },
  'pmd-positioning-workshop': { display_name: '定位工作坊', task_summary: '方法论：定位工作坊引导' },
  'mkt-analytics': { display_name: '营销分析', task_summary: '营销漏斗与投放数据分析' },
  'college-data-analysis': { display_name: '学业·数据分析', task_summary: '课程作业与实验数据分析' },
  'mkt-screenshots': { display_name: '截图优化', task_summary: '应用商店截图设计与 A/B 测试' },
  'anth-mcp-builder': { display_name: 'MCP构建', task_summary: '搭建与调试 MCP 服务端' },
  'brainstorm-structured': { display_name: '结构化脑暴', task_summary: '分步骤引导式头脑风暴' },
  'create-color-expert': { display_name: '配色专家', task_summary: '品牌与界面配色方案' },
  'create-taste-skill': { display_name: '审美规范', task_summary: 'Anti-Slop 前端审美 v2（落地页/作品集/改版）' },
  'create-taste-brandkit': { display_name: '品牌视觉板', task_summary: 'Taste 品牌 kit 与参考板生成' },
  'create-taste-imagegen-web': { display_name: '网页参考板', task_summary: '生成网页 UI 参考图板（配 Taste 实现）' },
  'create-taste-imagegen-mobile': { display_name: '移动端参考板', task_summary: '生成移动端 UI 参考图板' },
  'create-taste-image-to-code': { display_name: '设计稿转代码', task_summary: '参考图还原为前端页面' },
  'create-taste-redesign': { display_name: '站点改版审美', task_summary: '审计优先的网站改版约束' },
  'create-taste-minimalist': { display_name: '极简风前端', task_summary: '极简 Linear 风界面约束' },
  'create-taste-brutalist': { display_name: '粗野风前端', task_summary: 'Brutalist 网页审美约束' },
  'create-taste-soft': { display_name: '柔和风前端', task_summary: '柔和渐变与圆角界面约束' },
  'create-taste-stitch': { display_name: 'Stitch 设计稿', task_summary: 'Google Stitch 设计稿协作约束' },
  'create-taste-output': { display_name: '输出规范', task_summary: 'Taste 交付物格式与预检' },
  'cyber-ppt': { display_name: 'Cyber 咨询PPT', task_summary: 'MBB 风高密度可编辑 PPTX（SCR+QA）' },
  'ppt-gorden-super': { display_name: 'Gorden 超级PPT', task_summary: 'AI 出图幻灯 + 四层还原可编辑 PPTX' },
  'ppt-gorden-image-gen': { display_name: 'Gorden 图片PPT', task_summary: '豪华高密度图片型幻灯' },
  'ppt-gorden-image2pptx': { display_name: 'Gorden 图转PPT', task_summary: '幻灯截图四层拆解为可编辑 PPTX' },
  'create-ui-baseline-ui': { display_name: 'UI基线', task_summary: '生产级 UI 组件基线' },
  'create-ui-fixing-accessibility': { display_name: '无障碍修复', task_summary: '修复界面无障碍与可用性' },
  'dev-playwright': { display_name: 'Playwright', task_summary: '浏览器自动化与 E2E 测试' },
  'edu-tutor-skills': { display_name: '家教技能', task_summary: '一对一辅导与作业讲解' },
  'office-nutrient': { display_name: '文档API', task_summary: 'Nutrient 文档处理 API' },
  'mkt-typefully-typefully': { display_name: 'Typefully', task_summary: '社交媒体长文排程发布' },
  'fal-cinematography': { display_name: '镜头语言', task_summary: 'Fal·影视镜头与构图' },
  'fal-commercial': { display_name: '商业广告', task_summary: 'Fal·商业广告视频生成' },
  'fal-gamedev': { display_name: '像素游戏', task_summary: 'Fal·2D 像素游戏资产' },
  'fal-fal-gamedev': { display_name: '像素游戏', task_summary: 'Fal·2D 像素游戏资产' },
  'fal-models-catalog': { display_name: '模型目录', task_summary: 'Fal·模型检索与选型' },
  'fal-fal-models-catalog': { display_name: '模型目录', task_summary: 'Fal·模型检索与选型' },
  'fal-prompting': { display_name: '提示词', task_summary: 'Fal·多模态提示词技巧' },
  'fal-fal-prompting': { display_name: '提示词', task_summary: 'Fal·多模态提示词技巧' },
  'fal-recipes': { display_name: '配方速查', task_summary: 'Fal·常用生成配方' },
  'fal-fal-recipes': { display_name: '配方速查', task_summary: 'Fal·常用生成配方' },
  'fal-redesign': { display_name: '界面重设计', task_summary: 'Fal·界面视觉重设计' },
  'fal-fal-redesign': { display_name: '界面重设计', task_summary: 'Fal·界面视觉重设计' },
  'fal-regenerate-3d': { display_name: '3D再生', task_summary: 'Fal·3D 资产再生' },
  'fal-fal-regenerate-3d': { display_name: '3D再生', task_summary: 'Fal·3D 资产再生' },
  'fal-workflow': { display_name: '媒体工作流', task_summary: 'Fal·多步媒体流水线' },
  'fal-fal-workflow': { display_name: '媒体工作流', task_summary: 'Fal·多步媒体流水线' },
  'fal-fan-cam': { display_name: '粉丝镜头', task_summary: 'Fal·粉丝视角镜头' },
  'fal-marketing': { display_name: 'Fal·营销片', task_summary: 'Fal·营销短视频制作' },
  'fal-model-routing': { display_name: '模型路由', task_summary: 'Fal·按场景选模型' },
  'fal-storytelling': { display_name: '叙事技巧', task_summary: 'Fal·视频叙事结构' },
  'fal-ugc': { display_name: 'UGC内容', task_summary: 'Fal·用户生成内容风' },
  'geo-competitor-analysis': { display_name: 'GEO竞品分析', task_summary: '对比竞品在 AI 搜索中的提及与引用', description: '分析竞品关键词、内容、外链与 AI 引用份额，输出优劣势与行动清单。' },
  'geo-keyword-research': { display_name: 'GEO·挖词', task_summary: 'AI 搜索场景关键词与提问句式', description: '梳理 AI 搜索场景下的关键词、提问句式与话题簇。' },
  'geo-content-optimizer': { display_name: 'AI可引用优化', task_summary: '改写内容以提高被大模型引用概率', description: '提升内容在 ChatGPT、Perplexity、AI Overviews 等中的可引用性与引用就绪度。' },
  'geo-seo-content-writer': { display_name: 'AI搜索成稿', task_summary: '撰写面向 AI 搜索与引用的长文', description: '按关键词与结构撰写利于 AI 搜索收录与引用的文章与落地页。' },
  'geo-on-page-audit': { display_name: '页面可见审计', task_summary: '单页 AI 可见度与 on-page 审计', description: '诊断单页标题、结构、关键词与内链，给出优先级修复建议。' },
  'geo-citability': { display_name: 'AI引用评分', task_summary: '评估页面被 AI 引用的可能性', description: '对页面段落做可引用性评分（0–100）并给出改写建议。' },
  'geo-technical-seo': { display_name: 'AI爬虫可达', task_summary: '检查 AI 爬虫可达性与技术 SEO', description: '审计爬取、索引、Core Web Vitals、robots 与站点地图等技术项。' },
  'geo-aeo-audit': { display_name: 'AI可见审计', task_summary: '四维 GEO 评分与修复建议', description: '综合技术、可引用性、Schema 与实体四维评分，含 llms.txt 等修复建议。' },
  'geo-rank-track': { display_name: 'AI可见跟踪', task_summary: '跟踪品牌在 AI 回答中的可见度变化', description: '监测关键词与品牌在 AI 回答/SERP 中的排名与变化趋势。' },
  'hub-pack-brand-website': { display_name: '品牌官网全案', task_summary: '品牌发现→定位→文案→SEO→上线', description: '官网全生命周期能力包，自动选用包内子技能。' },
  'hub-pack-ad-funnel': { display_name: '广告漏斗全案', task_summary: '创意→落地页→投放→转化优化', description: '付费增长漏斗能力包，自动选用包内子技能。' },
  'hub-pack-aso': { display_name: '应用商店优化', task_summary: '关键词、元数据、截图与 ASO 审计', description: 'ASO 能力包，自动选用包内子技能。' },
  'hub-pack-threejs': { display_name: '3D网页创作', task_summary: 'Three.js 场景、材质、动画与交互', description: 'Three.js 3D 网页能力包，自动选用包内子技能。' },
  'hub-pack-fal-video': { display_name: 'Fal多模态视频', task_summary: 'Fal 生图生视频、工作流与模型路由', description: 'fal.ai 多模态视频能力包，需配置 Key。' },
  'hub-pack-pm-toolkit': { display_name: 'PM工具包', task_summary: 'PRD、路线图、竞品、实验与 GTM', description: 'Phuryn PM 工具包，自动选用包内子技能。' },
  'hub-pack-pm-methods': { display_name: '产品方法论', task_summary: '工作坊式 OST、定位、用户故事地图', description: 'Dean Peters 方法论包，自动选用包内子技能。' },
  'od-mobile-app': { display_name: '手机界面示意', task_summary: 'App 多屏界面示意图', description: '制作手机应用界面示意，可单屏或多屏并排（含手机外框）。' },
  'od-mobile-onboarding': { display_name: '新手引导三屏', task_summary: '首次打开引导页', description: '制作新用户首次打开应用的引导画面，通常 3 屏。' },
  'od-dashboard': { display_name: '数据看板页', task_summary: '管理后台首页', description: '制作带侧边栏的数据看板或管理后台首页，含指标卡片与图表。' },
  'od-resume': { display_name: '简历网页', task_summary: '个人求职页', description: '制作个人求职简历页面（经历、技能、项目、联系方式）。' },
  'od-image-gen': { display_name: '生图存档', task_summary: '生成并保存图片文件', description: '按描述生成 png/jpg 并保存到项目中，适合海报、封面与营销图。' },
  'od-saas-landing': { display_name: '官网落地页', task_summary: '产品介绍落地页', description: '制作官网或产品落地页：首屏价值、功能区、试用/价格与页脚。' },
  'od-pricing-page': { display_name: '定价页', task_summary: '套餐对比定价页', description: '制作多档套餐对比与付费常见问题页。' },
  'od-pricing-upgrade': { display_name: '升级付费页', task_summary: '升级会员付费墙', description: '制作升级会员或付费墙页面。' },
  'od-faq-page': { display_name: 'FAQ 页面', task_summary: '帮助中心问答', description: '制作常见问题与帮助中心页面。' },
  'od-waitlist-page': { display_name: '候补名单页', task_summary: '预发布邮箱收集页', description: '制作产品预发布候补名单落地页（品牌、价值主张与邮箱收集）。' },
  'od-web-prototype': { display_name: '网页原型页', task_summary: '可点击网页原型', description: '制作高保真网页原型（导航、核心区块与关键交互示意）。' },
  'od-team-okrs': { display_name: '团队 OKR 页', task_summary: '季度目标与关键结果', description: '制作团队 OKR 跟踪页：目标、关键结果进度与负责人状态。' },
  'od-kanban-board': { display_name: '看板任务板', task_summary: '看板式任务列', description: '制作多列看板任务板页面（状态列、卡片与优先级）。' },
  'od-meeting-notes': { display_name: '会议纪要页', task_summary: '结构化会议纪要', description: '制作会议纪要展示页：议题、决议与行动项。' },
  'od-docs-page': { display_name: '文档站点页', task_summary: '产品文档帮助页', description: '制作产品文档或帮助中心单页（目录 + 正文）。' },
  'od-blog-post': { display_name: '博客文章页', task_summary: '长文博客排版', description: '制作博客或长文阅读页（标题、导语与正文层级）。' },
  'od-finance-report': { display_name: '财务报告页', task_summary: '财务摘要可视化', description: '制作财务或经营摘要报告页（指标卡与图表区）。' },
  'od-hr-onboarding': { display_name: '入职引导页', task_summary: '新人入职流程页', description: '制作 HR 新人入职引导页（步骤、清单与对接人）。' },
  'od-pm-spec': { display_name: '产品规格页', task_summary: 'PRD 规格说明页', description: '制作产品规格或 PRD 展示页（背景、需求与验收）。' },
  'od-gamified-app': { display_name: '游戏化应用页', task_summary: '游戏化界面示意', description: '制作游戏化产品界面示意（等级、任务与奖励反馈）。' },
  'od-deck-swiss': { display_name: '瑞士国际主义 Deck', task_summary: '16 列网格 HTML 演示稿', description: '制作瑞士国际主义风格 HTML 演示稿（强网格、单一强调色）。' },
  'od-social-x-card': { display_name: 'X 分享卡片', task_summary: '推特金句分享卡', description: '制作 X（Twitter）金句或数据分享卡，适合配推文截图。' },
  'od-creative-director': { display_name: '创意总监审稿', task_summary: '设计审稿与改稿指引', description: '对设计稿或 HTML 做创意总监式审稿并给出优先改项。' },
  'od-wireframe-mobile-flow': { display_name: '手机流程线框', task_summary: '多屏手机流程线框', description: '制作手机多屏流程线框（灰盒结构与流转标注）。' },
  'od-poster-hero': { display_name: '海报主视觉', task_summary: '竖版海报分享长图', description: '制作活动或品牌竖版海报主视觉页。' },
  'od-social-carousel': { display_name: '社媒轮播', task_summary: '社媒多图轮播页', description: '制作社交媒体多图轮播展示页。' },
  'od-email-marketing': { display_name: '邮件营销页', task_summary: '营销邮件版面', description: '制作营销邮件版面 HTML。' },
  'od-article-magazine': { display_name: '杂志长文', task_summary: '杂志风长文页', description: '制作杂志风格长文阅读页。' },
  'od-deck-magazine': { display_name: 'HTML 比稿', task_summary: '杂志风演示稿', description: '制作杂志风横屏 HTML 演示稿。' },
  'od-data-report': { display_name: '数据报告页', task_summary: '数据汇报摘要页', description: '制作数据汇报摘要 HTML 页。' },
  'od-login-flow': { display_name: '登录流程界面', task_summary: '登录注册验证页', description: '设计登录、注册与验证码等流程界面。' },
  'od-wireframe-sketch': { display_name: '线框草图', task_summary: '结构线框草图', description: '制作页面结构线框草图。' },
  'open-design': { display_name: '设计总控', task_summary: '设计流程总控', description: '将含糊需求转为高质量 HTML 设计产物的总控技能。' },
  'anth-canvas-design': { display_name: '视觉画布设计', task_summary: '艺术海报与视觉创作', description: '设计艺术海报、插画与视觉画布作品。' },
  'create-ui-fixing-metadata': { display_name: '页面元数据优化', task_summary: 'SEO 与分享元数据', description: '补全 title、description 与社交分享卡片等页面元数据。' },
  'create-ui-fixing-motion-performance': { display_name: '动效性能优化', task_summary: '动画性能排查', description: '排查并优化页面动画与动效的性能问题。' },
  'create-youtube-clipper': { display_name: 'YouTube 剪辑', task_summary: '下载分章剪辑与双语字幕', description: 'YouTube 视频智能剪辑：章节分析、片段裁剪与中英双语字幕。' },
  'create-nanobanana-ppt': { display_name: 'AI 配图幻灯', task_summary: 'AI 生成配图 PPT', description: '基于 AI 自动生成高质量 PPT 配图与转场视频。' },
  'create-wonda': { display_name: 'wonda 创作', task_summary: 'wonda 创意辅助', description: 'wonda 创意与内容辅助能力。' },
  'video-db-python': { display_name: '视频库检索', task_summary: 'VideoDB 内容搜索', description: 'VideoDB 视频上传与按内容语义搜索片段。' },
  'office-ecom': { display_name: '电商助手', task_summary: '电商运营文案与方案', description: '电商 listing、商品文案与运营方案辅助。' },
  'office-epub': { display_name: '电子书制作', task_summary: 'EPUB 打包', description: '将文稿或章节目录打包为 EPUB 电子书。' },
  'df-bootstrap': { display_name: 'AI 伙伴引导', task_summary: '个性化 AI 身份配置', description: '通过对话生成个性化 AI 身份与风格配置（SOUL.md）。' },
  'df-claude-to-deerflow': { display_name: 'DeerFlow 对接', task_summary: '对接研究平台', description: '向 DeerFlow 发送任务、管理线程与深度研究。' },
  'df-find-skills': { display_name: '技能发现安装', task_summary: '发现与安装技能包', description: '帮用户找到并安装可扩展能力的技能包。' },
  'df-newsletter-generation': { display_name: '电子报生成', task_summary: 'Newsletter 编排', description: '撰写与编排邮件通讯（Newsletter）内容。' },
  'pilotdeck-skills-migration': { display_name: '技能迁移', task_summary: '迁移外部技能', description: '从 Claude Code/OpenClaw 等目录迁移技能到 Nova Ai-Studio。' },
  'karpathy-guidelines': { display_name: 'AI 编码规范', task_summary: '减少 AI 编码失误', description: '降低 LLM 写代码常见问题的行为准则与审查清单。' },
  'dev-playwright': { display_name: '浏览器自动化', task_summary: 'E2E 与网页自动化', description: '浏览器自动化与端到端测试。' },
  'mkt-typefully-typefully': { display_name: '长文排程发布', task_summary: 'Typefully 长文排程', description: '社交媒体长文排程发布（Typefully）。' },
  github: { display_name: 'GitHub协作', task_summary: 'GitHub 仓库与 PR 操作', description: 'GitHub 仓库、Issue 与 Pull Request 协作。' },
  notion: { display_name: 'Notion文档', task_summary: 'Notion 页面读写', description: 'Notion 工作区页面创建与更新。' },
  obsidian: { display_name: 'Obsidian笔记', task_summary: 'Obsidian  vault 笔记', description: 'Obsidian 本地知识库读写。' },
  tmux: { display_name: '终端会话', task_summary: 'tmux 会话管理', description: '终端多窗格与会话管理。' },
  'meeting-recorder-assistant': { display_name: '会议录音', task_summary: '会议录音转写与纪要', description: '录制会议并生成结构化纪要。' },
  'create-ui-ui-skills-root': { display_name: 'UI技能库', task_summary: 'UI 设计技能集合', description: 'UI/UX 设计相关技能入口。' },
  'legal-lav-canned-responses-anthropic': { display_name: '法务·回复库', task_summary: '法务常用回复模板', description: 'Anthropic 法务场景 canned responses。' },
  'legal-lav-compliance-anthropic': { display_name: '法务·合规', task_summary: '合规审查辅助', description: 'Anthropic 法务合规审查。' },
  'legal-lav-contract-review-anthropic': { display_name: '法务·合同审', task_summary: '合同条款审查', description: 'Anthropic 合同审阅辅助。' },
  'legal-lav-assignation-refere-communication-associe-selim-brihi': { display_name: '法务·传票', task_summary: '传票与送达沟通', description: '法务传票送达沟通模板。' },
  'legal-lav-assignation-refere-recouvrement-creance-selim-brihi': { display_name: '法务·追债', task_summary: '债权追讨传票', description: '债权追讨传票与送达。' },
};

function hasCjk(text) {
  return typeof text === 'string' && CJK.test(text);
}

function resolvePrefixMeta(slug) {
  const keys = Object.keys(PREFIX_META).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (slug.startsWith(key)) return { key, ...PREFIX_META[key], tail: slug.slice(key.length) };
  }
  return { key: '', label: '', vendor: '', summaryPrefix: '', tail: slug };
}

function tailToZh(tail, slugPrefix = '') {
  if (!tail) return '';
  if (slugPrefix === 'mkt-dmp-') {
    const dmpZh = dmpTailToZh(tail);
    if (dmpZh) return dmpZh;
  }
  const packZh = pmPackTailZh(tail);
  if (packZh && CJK.test(packZh)) return packZh;
  const normalized = tail.replace(/^skills-/, '').replace(/^fal-/, '').replace(/^threejs-/, 'threejs-');
  const keys = Object.keys(SEGMENT_ZH).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (normalized === key || normalized.endsWith(`-${key}`) || normalized.startsWith(`${key}-`)) {
      return SEGMENT_ZH[key];
    }
  }
  const parts = normalized.split('-').filter(Boolean);
  const translated = parts.map((p) => WORD_ZH[p] || '').filter(Boolean);
  if (translated.length >= 2) return translated.slice(-2).join('');
  if (translated.length === 1) return translated[0];
  return parts.slice(-2).join(' ') || normalized;
}

function trimDisplayName(name, max = 12) {
  if (!name) return '';
  return name.length <= max ? name : name.slice(0, max);
}

export function autoZhDisplayName(slug) {
  if (PERSONA_ZH[slug]) return PERSONA_ZH[slug];
  if (SLUG_ZH_OVERRIDE[slug]?.display_name) return SLUG_ZH_OVERRIDE[slug].display_name;

  if (slug.startsWith('pms-')) {
    const zh = pmPackTailZh(slug.slice(4));
    const name = zh.length <= 9 ? `PM·${zh}` : zh;
    return trimDisplayName(name, 12);
  }
  if (slug.startsWith('pmd-')) {
    return trimDisplayName(pmPackTailZh(slug.slice(4)), 12);
  }

  const { key, label, tail } = resolvePrefixMeta(slug);
  const zhTail = tailToZh(tail, key);
  if (label && zhTail) {
    const combined = `${label}·${zhTail}`;
    return trimDisplayName(combined.length <= 12 ? combined : zhTail);
  }
  if (zhTail) return trimDisplayName(zhTail);
  if (label) return trimDisplayName(label);
  return trimDisplayName(slug.replace(/-/g, '').slice(0, 8));
}

export function autoZhTaskSummary(slug, englishText = '') {
  if (SLUG_ZH_OVERRIDE[slug]?.task_summary) return SLUG_ZH_OVERRIDE[slug].task_summary;
  if (PERSONA_ZH[slug]) return `用${PERSONA_ZH[slug].replace('思维', '')}视角拆解问题`;

  if (slug.startsWith('pms-')) {
    const zh = pmPackTailZh(slug.slice(4));
    if (zh) return `PM 包：${zh}`;
  }
  if (slug.startsWith('pmd-')) {
    const zh = pmPackTailZh(slug.slice(4));
    if (zh) return `方法论：${zh}`;
  }

  const { key, label, vendor, summaryPrefix, tail } = resolvePrefixMeta(slug);
  const zhTail = tailToZh(tail, key);

  if (slug.startsWith('mkt-aso-') && zhTail) return `应用商店·${zhTail}`;
  if (slug.startsWith('mkt-dmp-') && zhTail) return `数字营销·${zhTail}`;
  if (slug.startsWith('fc-') && zhTail) return `Firecrawl·${zhTail}`;
  if (slug.startsWith('legal-lav-') && zhTail) return `法务·${zhTail}`;
  if (slug.startsWith('mkt-adv-') && zhTail) return `广告漏斗·${zhTail}`;
  if (slug.startsWith('mkt-brand-') && zhTail) return `品牌官网·${zhTail}`;
  if (slug.startsWith('geo-') && zhTail) return `GEO·${zhTail}`;
  if (slug.startsWith('edu-sci-') && zhTail) return `科研·${zhTail}`;
  if (slug.startsWith('fal-') && zhTail) return `Fal·${zhTail}`;
  if (slug.startsWith('create-threejs-') && zhTail) return `Three.js ${zhTail}`;
  if (zhTail) return zhTail;

  if (hasCjk(englishText)) return englishText.split(/[.。\n]/)[0].slice(0, 48);
  if (summaryPrefix) return `${summaryPrefix}：${englishText.split(/[.。\n]/)[0].slice(0, 36) || '专项能力'}`;
  return englishText.split(/[.。\n]/)[0].slice(0, 48) || `完成 ${slug} 相关任务`;
}

export function autoZhDescription(slug, englishText = '') {
  const summary = autoZhTaskSummary(slug, englishText);
  if (hasCjk(englishText) && englishText.length > 16) {
    return englishText.slice(0, 160);
  }
  if (slug.startsWith('pms-')) return `${summary}。源自 Phuryn PM 技能包，适合脑暴与方案产出。`;
  if (slug.startsWith('pmd-')) return `${summary}。源自 Dean Peters 方法论包，适合工作坊式拆解。`;
  if (slug.startsWith('mkt-aso-')) return `${summary}。面向 iOS/Android 商店优化。`;
  if (slug.startsWith('mkt-brand-')) return `${summary}。品牌官网全生命周期专项。`;
  if (slug.startsWith('edu-sci-')) return `${summary}。学术研究工具（默认不在能力中心展示）。`;
  if (slug.startsWith('fal-')) return `${summary}。需配置 fal.ai Key。`;
  if (slug.startsWith('consult-')) {
    return `${summary}。脑爆·企业咨询口语顾问；正式清单请用能力中心「企业」Tab。`;
  }
  return `${summary}。按技能指引产出可交付文件。`;
}

export function hasExplicitZhOverride(slug) {
  return Boolean(SLUG_ZH_OVERRIDE[slug]);
}

export function enrichZhLocaleFields(slug, englishSummary = '', englishDesc = '') {
  const override = SLUG_ZH_OVERRIDE[slug];
  const task_summary = override?.task_summary
    || (hasCjk(englishSummary) ? englishSummary.split(/[.。\n]/)[0].slice(0, 48) : autoZhTaskSummary(slug, englishSummary || englishDesc));
  const description = override?.description
    || (hasCjk(englishDesc) ? englishDesc.slice(0, 160) : autoZhDescription(slug, englishDesc || englishSummary));
  let display_name = override?.display_name || autoZhDisplayName(slug);
  if (!hasCjk(display_name)) {
    const fromSummary = trimDisplayName(task_summary.slice(0, 12));
    display_name = hasCjk(fromSummary) ? fromSummary : trimDisplayName(`${resolvePrefixMeta(slug).label || '能力'}·专项`.slice(0, 12));
  }
  return { display_name, task_summary, description };
}
