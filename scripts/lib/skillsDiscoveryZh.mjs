/** Skills 调研表：英文描述 → 中文介绍/行业/应用范围 */

const SECTION_INDUSTRY_ZH = {
  'Official Claude Skills': '通用·文档与创意',
  'Official Skills by': '通用·文档与创意',
  'Skills by Anthropic': '通用·文档与创意',
  'Skills by OpenAI (Codex)': 'AI·Codex 官方',
  'Skills by OpenAI': 'AI·Codex 官方',
  'Skills by Google Gemini': 'AI·大模型开发',
  'Skills by Hugging Face': 'AI·机器学习',
  'Skills by Replicate': 'AI·模型推理',
  'Skills by fal.ai Team': 'AI·图像视频',
  'Skills by fal.ai': 'AI·图像视频',
  'Skills by MiniMax Team': 'AI·多模态',
  'Skills by MiniMax': 'AI·多模态',
  'Skills by Cloudflare': '云·边缘计算',
  'Skills by Netlify': '部署·Jamstack',
  'Skills by Vercel': '前端·Web 框架',
  'Skills by Vercel Engineering Team': '前端·部署',
  'Skills by HashiCorp (Terraform)': 'DevOps·Terraform',
  'Skills by HashiCorp Team for Terraform': 'DevOps·Terraform',
  'Skills by Stripe Team': '金融科技·支付',
  'Skills by Supabase Team': '数据·后端',
  'Skills by Composio Team': '集成·自动化',
  'Skills by Courier': '消息·通知',
  'Skills by CallStack': '移动·React Native',
  'Skills by Better Auth Team': '安全·认证',
  'Skills by Tinybird Team': '数据·实时分析',
  'Skills by Sanity Team': 'CMS·内容管理',
  'Skills by Firecrawl Team': '数据·网页抓取',
  'Skills by Neon Team': '数据库·Postgres',
  'Skills by Remotion': '视频·动效制作',
  'Skills by Typefully': '社媒·增长',
  'Skills by Google Labs (Stitch)': '设计·UI 生成',
  'Skills by Google Workspace CLI': '办公·协作',
  'Security Skills by Trail of Bits Team': '安全·审计',
  'Skills by Sentry Team for their dev team': '监控·可观测',
  'Skills by Microsoft': '企业·开发',
  'Skills by WordPress Development Team': 'CMS·WordPress',
  'Skills by Figma': '设计·Figma',
  'Marketing Skills by Corey Haines': '营销·增长',
  'Skills by Binance': '金融·Web3',
  'Product Manager Skills by Dean Peters': '产品·管理',
  'Product Management Skills by Pawel Huryn': '产品·策略',
  'Skills by DuckDB': '数据·分析',
  'Skills by GSAP (GreenSock)': '前端·动效',
  'Skills by Garry Tan (gstack)': '创业·全栈',
  'Skills by Notion': '协作·知识库',
  'Skills by Resend': '邮件·触达',
  'Skills by Addy Osmani (Web Quality)': '前端·质量',
  'Skills by MongoDB': '数据库·NoSQL',
  'Advertising Skills by Kim Barrett': '广告·投放',
  'Skills by Apollo GraphQL': 'API·GraphQL',
  'Skills by Auth0': '身份·认证',
  'Skills by Brave': '搜索·隐私',
  'Skills by Browserbase': '浏览器·自动化',
  'Skills by CodeRabbit': '代码·Review',
  'Skills by Coinbase': 'Web3·交易',
  'Skills by Datadog Labs': '监控·APM',
  'Skills by Firebase': '移动·后端',
  'Skills by Flutter': '移动·跨平台',
  'Skills by Venice.ai': 'AI·隐私计算',
  'Skills by Red Hat': '企业·OpenShift',
  'Skills by Redis': '缓存·数据库',
  'Skills by NVIDIA': 'AI·GPU',
  'Skills by Google Cloud': '云·GCP',
  'Skills by Expo Team': '移动·Expo',
  'Skills by VoltAgent': '开发·Agent 框架',
  'Skills by Angular': '前端·Angular',
  Community: '社区·综合',
  'Community Skills': '社区·综合',
  'Claude 官方文档技能（anthropics/skills · 未 vendor 项）': '通用·文档与创意',
  '待整合 GitHub 项目（AGENTS.md P0-P2）': '营销·发布与 GEO',
  'skills.sh 安装榜（Vercel 生态 telemetry）': 'skills.sh 热门',
  'SkillsMP 精选索引（跨 GitHub 聚合）': 'SkillsMP 聚合',
  'Claude 合作伙伴目录（Partner Skills）': 'SaaS·协作集成',
  'OpenAI Codex 官方目录': 'AI·Codex 官方',
  'Agent Skill Index（agent-skill.co）': '多源·官方精选',
};

const SCOPE_BY_INDUSTRY = {
  '通用·文档与创意': '办公文档、提案演示、品牌物料与内部沟通',
  'AI·Codex 官方': 'AI 辅助开发、部署、设计与多媒体生成',
  'AI·大模型开发': 'Gemini/Vertex 应用开发与流式交互',
  'AI·机器学习': '数据集、训练、推理与浏览器端 ML',
  'AI·模型推理': '云端模型调用与 AI 应用集成',
  'AI·图像视频': '生图、生视频、放大与实时生成',
  'AI·多模态': '前端开发、PDF 与多媒体处理',
  '云·边缘计算': 'Workers、MCP、性能与边缘部署',
  '部署·Jamstack': '无服务器函数、边缘与静态站点发布',
  '前端·Web 框架': 'React/Next 最佳实践与 Web 设计规范',
  'DevOps·Terraform': 'IaC 模块、Provider 开发与测试',
  '金融科技·支付': '支付集成、订阅与账务流程',
  '数据·后端': 'PostgreSQL、数据库设计与后端规范',
  '集成·自动化': '跨应用连接、工作流与 OAuth',
  '消息·通知': '邮件、短信、推送与多渠道触达',
  '移动·React Native': 'RN 性能、升级与 GitHub 工作流',
  '安全·认证': '登录、组织、双因素与身份体系',
  '数据·实时分析': '实时数据管道与 SDK 规范',
  'CMS·内容管理': '结构化内容、Headless CMS',
  '数据·网页抓取': '网页抓取、结构化提取与调研',
  '数据库·Postgres': 'Serverless Postgres 与分支预览',
  '视频·动效制作': '程序化视频与 React 视频组件',
  '社媒·增长': '社媒发布、排期与增长文案',
  '设计·UI 生成': 'UI 原型、设计稿与视觉探索',
  '办公·协作': 'Google 办公套件与 CLI 自动化',
  '安全·审计': '代码审计、漏洞分析与安全基线',
  '监控·可观测': '错误追踪、性能与日志分析',
  '企业·开发': 'Azure、.NET 与企业级工程规范',
  'CMS·WordPress': '主题、插件与站点构建',
  '设计·Figma': '设计稿读取、还原与协作',
  '营销·增长': '获客、转化、SEO 与品牌传播',
  '金融·Web3': '交易所、链上数据与加密产品',
  '产品·管理': '需求、路线图、PRD 与决策',
  '数据·分析': 'OLAP、SQL 分析与报表',
  '前端·动效': '动画、交互与视觉动效',
  '创业·全栈': '初创产品快速搭建与迭代',
  '协作·知识库': 'Wiki、笔记与团队知识沉淀',
  '邮件·触达': '事务邮件、营销邮件与送达优化',
  '前端·质量': '性能、可访问性与 Web 质量',
  '数据库·NoSQL': 'MongoDB 建模与查询优化',
  '广告·投放': '广告创意、投放与效果优化',
  'API·GraphQL': 'GraphQL Schema 与联邦',
  '身份·认证': 'OAuth、SSO 与企业身份',
  '搜索·隐私': '隐私搜索与检索增强',
  '浏览器·自动化': '无头浏览器、E2E 与抓取',
  '代码·Review': 'PR 审查、静态分析与质量门禁',
  'Web3·交易': '钱包、交易与 DeFi 集成',
  '监控·APM': 'APM、指标与告警',
  '移动·后端': 'Firebase、推送与移动 BaaS',
  '移动·跨平台': 'Flutter/Dart 应用开发',
  'AI·隐私计算': '本地化与隐私优先 AI',
  '企业·OpenShift': '容器平台与 K8s 运维',
  '缓存·数据库': 'Redis 缓存与数据结构',
  'AI·GPU': 'CUDA、推理加速与 GPU 工作流',
  '云·GCP': 'Google Cloud 部署与 AI 服务',
  '移动·Expo': 'Expo/React Native 发布',
  '开发·Agent 框架': 'Agent 架构、工作流与记忆',
  '前端·Angular': 'Angular 组件与工程化',
  '社区·综合': '垂直场景插件与社区工作流',
  '营销·发布与 GEO': '社媒矩阵、短视频与生成式搜索优化',
  'skills.sh 热门': '高安装量、经 telemetry 验证的通用技能',
  'SkillsMP 聚合': '跨仓库发现、职业分类与技能检索',
  'SaaS·协作集成': 'Asana、Jira、Notion 等 SaaS 工作流',
  '多源·官方精选': '官方团队维护的跨平台技能',
};

/** 常见英文片段 → 中文（按长度降序匹配） */
const PHRASE_REPLACEMENTS = [
  ['Create, edit, and analyze PowerPoint presentations', '创建、编辑与分析 PowerPoint 演示文稿'],
  ['Create, edit, and analyze Excel spreadsheets', '创建、编辑与分析 Excel 电子表格'],
  ['Create, edit, and analyze Word documents', '创建、编辑与分析 Word 文档'],
  ['Collaborative document editing and co-authoring', '协作文档编辑与共创流程'],
  ['Extract text, create PDFs, and handle forms', '提取 PDF 文本、生成 PDF 与处理表单'],
  ['Test local web applications using Playwright', '使用 Playwright 测试本地 Web 应用'],
  ['Create MCP servers to integrate external APIs and services', '构建 MCP 服务器以集成外部 API 与服务'],
  ['Best practices for building Stripe integrations', 'Stripe 支付集成的最佳实践'],
  ['Best practices for developing Gemini-powered apps using the Gemini API', 'Gemini API 应用开发最佳实践'],
  ['Developing Gemini-powered apps on Google Cloud Vertex AI using the Gen AI SDK', 'Vertex AI Gen AI SDK 开发 Gemini 应用'],
  ['Building real-time bidirectional streaming apps with the Gemini Live API', '用 Gemini Live API 构建实时双向流式应用'],
  ['Building apps with the Gemini Interactions API for text, chat, streaming, and image generation', '用 Gemini Interactions API 构建文本、聊天、流式与图像应用'],
  ['Build and test web games iteratively using Playwright', '用 Playwright 迭代开发与测试 Web 小游戏'],
  ['Generate and edit images using OpenAI', '使用 OpenAI 生成与编辑图像'],
  ['Generate, remix, and manage short video clips', '生成、混剪与管理短视频片段'],
  ['Generate spoken audio from text', '将文本合成为语音音频'],
  ['Design LLM-as-Judge evaluators for subjective criteria', '设计 LLM-as-Judge 主观评测提示词'],
  ['Build annotation interfaces for reviewing LLM traces', '构建 LLM 轨迹标注与审阅界面'],
  ['Generate diverse synthetic test inputs for LLM evals', '为 LLM 评测生成多样化合成测试输入'],
  ['Secure environment variable management', '安全的环境变量管理，防止密钥泄露'],
  ['penetration testing', '渗透测试'],
  ['pen testing', '渗透测试'],
  ['management', '管理'],
  ['testing', '测试'],
  ['evaluation', '评测'],
  ['synthetic', '合成'],
  ['diverse', '多样化'],
  ['subjective', '主观'],
  ['criteria', '标准'],
  ['annotation', '标注'],
  ['interfaces', '界面'],
  ['traces', '轨迹'],
  ['inputs', '输入'],
  ['evals', '评测'],
  ['Judge', '评判'],
  ['LLM', '大语言模型'],
  ['Deploy apps to Cloudflare using Workers and Pages', '用 Cloudflare Workers 与 Pages 部署应用'],
  ['Debug and fix failing GitHub Actions PR checks', '调试并修复 GitHub Actions PR 检查失败'],
  ['Address review and issue comments on open GitHub PRs', '处理 GitHub PR 上的 Review 与 Issue 评论'],
  ['Manage issues, projects, and team workflows in Linear', '在 Linear 管理 Issue、项目与团队工作流'],
  ['Automate Netlify deployments with CLI support', '通过 CLI 自动化 Netlify 部署'],
  ['Convert conversations into structured Notion wiki entries', '将对话整理为 Notion 结构化 Wiki'],
  ['Automate real browser interactions for navigation and forms', '自动化浏览器导航、表单与交互'],
  ['Use the Figma MCP server to fetch design context', '通过 Figma MCP 获取设计上下文'],
  ['Translate Figma designs into production-ready code', '将 Figma 设计稿转为可上线代码'],
  ['Create visually strong landing pages and web apps', '创建高完成度落地页与 Web 应用'],
  ['React best practices and patterns', 'React 最佳实践与常用模式'],
  ['Next.js best practices and recommended patterns', 'Next.js 最佳实践与推荐模式'],
  ['Web design guidelines and standards', 'Web 设计规范与质量标准'],
  ['PostgreSQL best practices for Supabase', 'Supabase 场景下的 PostgreSQL 最佳实践'],
  ['Connect AI agents to 1000+ external apps with managed authentication', '以托管鉴权连接 AI Agent 与 1000+ 外部应用'],
  ['Multi-channel notifications via email, SMS, push, and chat', '邮件、短信、推送与聊天等多渠道通知'],
  ['Performance optimization for React Native apps', 'React Native 应用性能优化'],
  ['Guide for creating skills that extend Claude', '扩展 Claude 能力的新 Skill 编写指南'],
  ['Write status reports, newsletters, and FAQs', '撰写状态报告、Newsletter 与 FAQ'],
  ['Apply Anthropic\'s brand colors and typography to artifacts', '将 Anthropic 品牌色与字体规范应用于产物'],
  ['Style artifacts with professional themes or generate custom themes', '为产物套用专业主题或生成自定义主题'],
  ['Build complex claude.ai HTML artifacts with React and Tailwind', '用 React 与 Tailwind 构建复杂 HTML 产物'],
  ['Create animated GIFs optimized for Slack size constraints', '创建适配 Slack 体积限制的 GIF 动图'],
  ['Design visual art in PNG and PDF formats', '输出 PNG/PDF 格式的视觉设计作品'],
  ['Create generative art using p5.js with seeded randomness', '用 p5.js 与固定随机种子生成算法艺术'],
  ['Frontend design and UI/UX development tools', '前端设计与 UI/UX 开发辅助'],
  ['Scaffold a new Terraform provider project', '脚手架化新建 Terraform Provider 项目'],
  ['Implement Terraform Provider resources and data sources', '实现 Terraform Provider 资源与数据源'],
  ['Discover and run AI models via API', '通过 API 发现与运行 AI 模型'],
  ['Generate images and videos using fal.ai', '使用 fal.ai 生成图像与视频'],
  ['Train models with TRL', '使用 TRL 训练模型（SFT/DPO/GRPO）'],
  ['Run ML models in the browser with Transformers.js', '在浏览器端用 Transformers.js 运行模型'],
  ['Build stateful AI agents with scheduling, RPC, and MCP servers', '构建带调度、RPC 与 MCP 的有状态 AI Agent'],
  ['Audit Core Web Vitals and render-blocking resources', '审计 Core Web Vitals 与阻塞渲染资源'],
  ['Deploy and manage Workers, KV, R2, D1', '部署与管理 Workers、KV、R2、D1 等云资源'],
  ['Best practices', '最佳实践'],
  ['best practices', '最佳实践'],
  ['Create', '创建'],
  ['Edit', '编辑'],
  ['Analyze', '分析'],
  ['Build', '构建'],
  ['Deploy', '部署'],
  ['Manage', '管理'],
  ['Generate', '生成'],
  ['Automate', '自动化'],
  ['Debug', '调试'],
  ['Fix', '修复'],
  ['Test', '测试'],
  ['Design', '设计'],
  ['Write', '撰写'],
  ['Implement', '实现'],
  ['Upgrade', '升级'],
  ['Connect', '连接'],
  ['Integrate', '集成'],
];

const CURATED_ZH = {
  'anthropics/pptx': {
    intro: '创建、编辑与分析 PowerPoint，用于提案、比稿与客户演示',
    scope: '客户提案、路演 Deck、培训课件与营销演示',
  },
  'anthropics/pdf': {
    intro: 'PDF 文本提取、生成、合并与表单处理',
    scope: '合同附件、报告交付、资料归档与表单填写',
  },
  'anthropics/xlsx': {
    intro: 'Excel 表格创建、编辑、公式与数据分析',
    scope: '预算表、投放排期、销售漏斗与运营报表',
  },
  'postiz/postiz-mcp': {
    intro: '海外社媒一键发布与 MCP 矩阵分发（Postiz）',
    scope: '多平台社媒排期、矩阵账号与海外触达',
  },
  'pixelle-video/short-video': {
    intro: 'AI 短视频生成、口播与剪辑流水线（Pixelle-Video）',
    scope: '短视频营销、口播切片与社媒素材',
  },
  'chnjames/aigeotools-geo': {
    intro: 'GEO 生成式引擎优化：AI 搜索可见性与内容布局',
    scope: '品牌 GEO、问答占位与 AI 搜索流量',
  },
  'vercel-labs/react-best-practices': {
    intro: 'React 性能与架构最佳实践（skills.sh 高安装量）',
    scope: '中大型 React 应用、组件设计与性能优化',
  },
  'vercel-labs/next-best-practices': {
    intro: 'Next.js 路由、缓存与部署最佳实践',
    scope: 'SSR/SSG 站点、全栈 Web 与 Vercel 部署',
  },
};

export function getIndustryZh(section, owner, descEn = '') {
  const ownerKey = (owner || '').toLowerCase();
  const OWNER_INDUSTRY = {
    anthropics: '通用·文档与创意',
    'google-gemini': 'AI·大模型开发',
    stripe: '金融科技·支付',
    supabase: '数据·后端',
    voltagent: '开发·Agent 框架',
    angular: '前端·Angular',
    composiohq: '集成·自动化',
    trycourier: '消息·通知',
    callstackincubator: '移动·React Native',
    'better-auth': '安全·认证',
    tinybirdco: '数据·实时分析',
    hashicorp: 'DevOps·Terraform',
    'sanity-io': 'CMS·内容管理',
    firecrawl: '数据·网页抓取',
    neon: '数据库·Postgres',
    remotion: '视频·动效制作',
    replicate: 'AI·模型推理',
    typefully: '社媒·增长',
    'vercel-labs': 'skills.sh 热门',
    cloudflare: '云·边缘计算',
    netlify: '部署·Jamstack',
    'google-labs': '设计·UI 生成',
    huggingface: 'AI·机器学习',
    trailofbits: '安全·审计',
    getsentry: '监控·可观测',
    microsoft: '企业·开发',
    wordpress: 'CMS·WordPress',
    openai: 'AI·Codex 官方',
    figma: '设计·Figma',
    coreyhaines31: '营销·增长',
    binance: '金融·Web3',
    deanpeters: '产品·管理',
    phuryn: '产品·策略',
    minimax: 'AI·多模态',
    duckdb: '数据·分析',
    garrytan: '创业·全栈',
    notion: '协作·知识库',
    resend: '邮件·触达',
    mongodb: '数据库·NoSQL',
    apollographql: 'API·GraphQL',
    auth0: '身份·认证',
    browserbase: '浏览器·自动化',
    coderabbit: '代码·Review',
    coinbase: 'Web3·交易',
    datadog: '监控·APM',
    firebase: '移动·后端',
    flutter: '移动·跨平台',
    redis: '缓存·数据库',
    nvidia: 'AI·GPU',
    expo: '移动·Expo',
    'anthropic-partners': 'SaaS·协作集成',
    skillsmp: 'SkillsMP 聚合',
    postiz: '营销·发布与 GEO',
    'pixelle-video': '视频·多媒体',
    chnjames: '营销·发布与 GEO',
  };
  if (OWNER_INDUSTRY[ownerKey]) return OWNER_INDUSTRY[ownerKey];

  if (SECTION_INDUSTRY_ZH[section]) return SECTION_INDUSTRY_ZH[section];
  const s = section.replace(/^Skills by\s+/i, '').trim();
  if (SECTION_INDUSTRY_ZH[s]) return SECTION_INDUSTRY_ZH[s];
  const d = descEn.toLowerCase();
  if (/marketing|seo|ads|campaign|copywriting/.test(d)) return '营销·增长';
  if (/security|audit|vulnerabilit/.test(d)) return '安全·审计';
  if (/terraform|kubernetes|docker|deploy|cloudflare|worker/.test(d)) return 'DevOps·云原生';
  if (/react native|flutter|expo|mobile|ios|android/.test(d)) return '移动·跨平台';
  if (/postgres|sql|database|mongo|redis|duckdb/.test(d)) return '数据·数据库';
  if (/figma|design|ui|ux|canvas/.test(d)) return '设计·UI/UX';
  if (/video|remotion|sora|animation/.test(d)) return '视频·多媒体';
  if (/stripe|payment|fintech|binance|coinbase/.test(d)) return '金融科技';
  if (/legal|compliance|gdpr/.test(d)) return '法务·合规';
  if (/health|medical|clinical/.test(d)) return '医疗·健康';
  if (/education|learning|teaching|course/.test(d)) return '教育·学习';
  if (/ecommerce|shopify|product catalog/.test(d)) return '电商·零售';
  if (/agent|mcp|llm|gemini|openai|claude/.test(d)) return 'AI·Agent 开发';
  return '社区·综合';
}

export function getIntroZh(item) {
  const key = `${item.owner}/${item.skillSlug}`.toLowerCase();
  if (CURATED_ZH[key]?.intro) return CURATED_ZH[key].intro;
  if (/[\u4e00-\u9fff]/.test(item.desc)) return item.desc.replace(/\|/g, ' ').slice(0, 120);

  let text = item.desc;
  const sorted = [...PHRASE_REPLACEMENTS].sort((a, b) => b[0].length - a[0].length);
  for (const [en, zh] of sorted) {
    text = text.replace(new RegExp(en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), zh);
  }
  if (/[\u4e00-\u9fff]/.test(text)) return text.replace(/\|/g, ' ').slice(0, 120);

  const slugHuman = item.skillSlug.replace(/-/g, ' ');
  const industry = getIndustryZh(item.section, item.owner, item.desc);
  return `面向「${industry}」的 Agent 技能：${slugHuman}（${item.owner} 维护）`.slice(0, 120);
}

export function getScopeZh(item, industryZh) {
  const key = `${item.owner}/${item.skillSlug}`.toLowerCase();
  if (CURATED_ZH[key]?.scope) return CURATED_ZH[key].scope;
  if (SCOPE_BY_INDUSTRY[industryZh]) return SCOPE_BY_INDUSTRY[industryZh];
  const d = item.desc.toLowerCase();
  if (/test|playwright|e2e/.test(d)) return '软件测试、回归验证与 CI 质量门禁';
  if (/deploy|ci\/cd|pipeline/.test(d)) return '持续集成、发布流水线与环境部署';
  if (/document|docx|pdf|pptx|xlsx/.test(d)) return '文档生产、格式转换与办公交付';
  return '对话式 Agent 工作流、团队 SOP 自动化与能力扩展';
}

export function getSourceLabel(item) {
  if (item.sourcePlatform) return item.sourcePlatform;
  const url = item.url || '';
  if (url.includes('skillsmp.com')) return 'SkillsMP';
  if (url.includes('skills.sh') || url.includes('officialskills.sh')) return 'skills.sh';
  if (url.includes('agent-skill.co')) return 'agent-skill.co';
  if (url.includes('github.com')) return 'GitHub';
  if (url.includes('anthropic.com') || url.includes('openai.com')) return '官方文档';
  return '多源索引';
}
