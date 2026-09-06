/** MCP 分类 → 中文应用场景 + 热门 MCP 精选 */

export const MCP_CATEGORY_ZH = {
  Aggregators: '聚合·发现',
  'Art & Culture': '艺术·文化·创作',
  'Architecture & Design': '架构·设计·可视化',
  'Browser Automation': '浏览器·自动化',
  'Biology, Medicine and Bioinformatics': '医疗·生物信息',
  'Cloud Platforms': '云·基础设施',
  'Code Execution': '代码·执行',
  'Coding Agents': '编程·Agent',
  'Command Line': '命令行·运维',
  Communication: '沟通·协作',
  'Conversational AI': '对话·AI',
  Cryptography: '加密·安全',
  'Customer Data Platforms': '客户数据·CDP',
  Databases: '数据库',
  'Data Platforms': '数据·平台',
  Delivery: '物流·配送',
  'Developer Tools': '开发者·工具',
  'Data Science Tools': '数据·科学',
  'Data Visualization': '数据·可视化',
  'Embedded system': '嵌入式',
  Education: '教育·学习',
  'E-Commerce': '电商·零售',
  'Environment & Nature': '环境·自然',
  'File Systems': '文件·存储',
  Finance: '金融·支付',
  'Fitness & Sports': '健身·运动',
  'Food & Drink': '餐饮·食品',
  Gaming: '游戏',
  'Government & Politics': '政务·公共',
  'Health & Wellness': '健康· wellness',
  'Home Automation': '智能家居',
  'Human Resources': '人力·HR',
  'Image & Video Generation': '图像·视频生成',
  'IoT & Hardware': '物联网·硬件',
  'Knowledge & Memory': '知识·记忆',
  Legal: '法务·合规',
  Location: '地图·位置',
  Marketing: '营销·增长',
  'Media & Entertainment': '媒体·娱乐',
  Monitoring: '监控·可观测',
  'Multimedia Processing': '多媒体·处理',
  'News & Information': '新闻·资讯',
  'Note Taking & Knowledge Management': '笔记·知识库',
  'Office & Productivity': '办公·效率',
  'Open Data': '开放数据',
  'Payment & Billing': '支付·账单',
  'Productivity & Collaboration': '协作·效率',
  'Programming Languages': '编程语言',
  'Project Management': '项目·管理',
  'Real Estate': '房地产',
  'Research & Data Extraction': '调研·数据抓取',
  'Search & Data Extraction': '搜索·抓取',
  Security: '安全·审计',
  'Social Media': '社媒·发布',
  'Software Development': '软件·开发',
  'Speech & Audio': '语音·音频',
  'Sports & Gaming': '体育·游戏',
  Storage: '存储·对象',
  'Testing & QA': '测试·QA',
  Translation: '翻译·本地化',
  Travel: '旅行·出行',
  'Version Control': '版本·Git',
  Weather: '天气·环境',
  'Web Scraping': '网页·爬虫',
  'Workflow Automation': '工作流·自动化',
};

export const HOT_MCP_CURATED = [
  ['postiz-mcp', 'Postiz MCP', 'https://github.com/gitroomhq/postiz-app', '社媒·发布', '海外 30+ 平台排期发布、AI 文案/图/短视频', 5, 'L3'],
  ['figma-developer-mcp', 'Figma MCP', 'https://github.com/GLips/Figma-Developer-MCP', '设计·创作', '读写 Figma 设计稿、组件与变量', 5, 'L3'],
  ['firecrawl-mcp', 'Firecrawl MCP', 'https://github.com/firecrawl/firecrawl-mcp-server', '搜索·抓取', '网页抓取、爬取、结构化提取', 5, 'L3'],
  ['apify-mcp', 'Apify MCP', 'https://github.com/apify/apify-mcp-server', '搜索·抓取', '上千爬虫 Actor，舆情/竞品/社媒', 5, 'L3'],
  ['notion-mcp', 'Notion MCP', 'https://github.com/makenotion/notion-mcp-server', '协作·办公', 'Brief、Wiki、数据库读写', 5, 'L3'],
  ['slack-mcp', 'Slack MCP', 'https://api.slack.com/docs/mcp', '协作·办公', '消息、搜索、频道通知', 5, 'L3'],
  ['github-mcp', 'GitHub MCP', 'https://github.com/github/github-mcp-server', '开发者·工具', 'PR、Issue、代码审查、Actions', 5, 'L3'],
  ['playwright-mcp', 'Playwright MCP', 'https://github.com/microsoft/playwright-mcp', '浏览器·自动化', 'Microsoft 官方浏览器自动化与测试', 5, 'L3'],
  ['brave-search-mcp', 'Brave Search MCP', 'https://github.com/brave/brave-search-mcp-server', '搜索·抓取', '隐私搜索 API，联网调研', 5, 'L3'],
  ['tavily-mcp', 'Tavily MCP', 'https://github.com/tavily-ai/tavily-mcp', '搜索·抓取', 'AI 优化网页搜索与摘要', 5, 'L3'],
  ['exa-mcp', 'Exa MCP', 'https://github.com/exa-labs/exa-mcp-server', '搜索·抓取', '神经搜索、论文与竞品调研', 5, 'L3'],
  ['google-workspace-mcp', 'Google Workspace MCP', 'https://github.com/googleworkspace/cli', '办公·协作', 'Gmail/Calendar/Docs/Sheets 100+ 工具', 5, 'L3'],
  ['office-mcp', 'Office MCP Server', 'https://github.com/claude-office-skills/skills', '办公·文档', '39 个 Office 文档 MCP 工具', 4, 'L3'],
  ['pixelle-mcp', 'Pixelle-MCP', 'https://github.com/AIDC-AI/Pixelle-MCP', '图像·视频生成', 'ComfyUI 文生图/视频/TTS 流水线', 4, 'L3'],
  ['canva-mcp', 'Canva MCP', 'https://www.canva.com/help/mcp/', '设计·创作', '模板、品牌 Kit、导出物料', 4, 'L3'],
  ['ads-mcp', 'ads-mcp', 'https://github.com/manlikemuneeb/ads-mcp', '营销·投放', 'Meta/Google/LinkedIn/GA4/GSC 89 工具', 4, 'L3'],
  ['dataforseo-mcp', 'DataForSEO MCP', 'https://github.com/dataforseo/mcp-server-typescript', '营销·SEO', '关键词、SERP、品牌情感', 4, 'L3'],
  ['seo-mcp', 'seo-mcp', 'https://github.com/Autom8Minds/seo-mcp', '营销·SEO', '29 个开源 SEO 工具', 4, 'L3'],
  ['hubspot-mcp', 'HubSpot MCP', 'https://developers.hubspot.com/docs/guides/crm/tools/mcp', '营销·CRM', 'CRM、Campaign、线索数据', 4, 'L3'],
  ['linear-mcp', 'Linear MCP', 'https://linear.app/docs/mcp', '项目·管理', 'Issue、项目、路线图', 4, 'L3'],
  ['stripe-mcp', 'Stripe MCP', 'https://github.com/stripe/agent-toolkit', '金融·支付', '支付、订阅、账务查询', 5, 'L3'],
  ['supabase-mcp', 'Supabase MCP', 'https://github.com/supabase-community/supabase-mcp', '数据库·后端', 'Postgres、Auth、Storage', 4, 'L3'],
  ['filesystem-mcp', 'Filesystem MCP', 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem', '文件·工具', '官方本地文件读写', 5, 'L2'],
  ['memory-mcp', 'Memory MCP', 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory', '知识·记忆', '官方知识图谱持久记忆', 4, 'L2'],
  ['fetch-mcp', 'Fetch MCP', 'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch', '搜索·抓取', '官方 HTTP 抓取（只读）', 4, 'L2'],
  ['sentry-mcp', 'Sentry MCP', 'https://github.com/getsentry/sentry-mcp', '监控·可观测', '错误追踪、性能、日志', 4, 'L3'],
  ['cloudflare-mcp', 'Cloudflare MCP', 'https://github.com/cloudflare/mcp-server-cloudflare', '云·边缘', 'Workers、KV、R2、DNS', 5, 'L3'],
  ['creatorcrawl-mcp', 'CreatorCrawl MCP', 'https://github.com/creatorcrawl/mcp-server', '社媒·监测', 'TikTok/IG/YouTube/LinkedIn 数据', 4, 'L3'],
  ['browserbase-mcp', 'Browserbase MCP', 'https://github.com/browserbase/mcp-server-browserbase', '浏览器·自动化', '云端无头浏览器、E2E', 4, 'L3'],
  ['composio-mcp', 'Composio MCP', 'https://github.com/ComposioHQ/composio', '集成·自动化', '1000+ SaaS 连接器', 4, 'L3'],
  ['mcpfinder', 'MCPfinder', 'https://github.com/mcpfinder/mcpfinder', '聚合·发现', '搜索/评估/安装 25K+ MCP', 4, 'L3'],
  ['a2asearch-mcp', 'A2A Search MCP', 'https://github.com/tadas-github/a2asearch-mcp', '聚合·发现', '搜索 4800+ MCP/Agent/Skill', 4, 'L3'],
  ['yixiaoer-api', '蚁小二（Skill+API）', 'https://github.com/yixiaoer888/yixiaoer-skill', '社媒·发布', '国内 40+ 平台矩阵（REST，非 MCP）', 4, 'L2 已接入'],
  ['render-html-video', 'render_html_video（内置工具）', 'https://github.com/OpenBMB/PilotDeck', 'HTML·视频', 'PilotDeck 内置 HTML→MP4 渲染', 5, '✅ 已接入'],
];

export function mapMcpCategory(title) {
  const t = title.replace(/^#+\s*/, '').trim();
  for (const [en, zh] of Object.entries(MCP_CATEGORY_ZH)) {
    if (t.toLowerCase().includes(en.toLowerCase())) return zh;
  }
  if (/marketing|social|ads/i.test(t)) return '营销·增长';
  if (/office|productivity|document/i.test(t)) return '办公·效率';
  if (/image|video|media|art/i.test(t)) return '图像·视频·创作';
  if (/search|scrap|fetch|research/i.test(t)) return '搜索·抓取';
  if (/database|sql|postgres/i.test(t)) return '数据库';
  if (/security|crypto/i.test(t)) return '安全·审计';
  if (/education|learning/i.test(t)) return '教育·学习';
  if (/finance|payment|stripe/i.test(t)) return '金融·支付';
  if (/health|medical|bio/i.test(t)) return '医疗·健康';
  if (/legal|compliance/i.test(t)) return '法务·合规';
  if (/hr|human resource/i.test(t)) return '人力·HR';
  if (/e-?commerce|shop/i.test(t)) return '电商·零售';
  return '开发者·工具';
}

export function mcpIntroZh(desc, displayName, scenario) {
  if (!desc) return `${displayName}：${scenario} 场景 MCP 服务`;
  if (/[\u4e00-\u9fff]/.test(desc)) return desc.slice(0, 110);
  let t = desc
    .replace(/MCP server/gi, 'MCP 服务')
    .replace(/integration/gi, '集成')
    .replace(/enables AI assistants/gi, '供 AI 助手')
    .replace(/search/gi, '搜索')
    .replace(/generate/gi, '生成')
    .replace(/image/gi, '图像')
    .replace(/video/gi, '视频')
    .replace(/database/gi, '数据库')
    .replace(/workflow/gi, '工作流');
  if (/[\u4e00-\u9fff]/.test(t)) return t.slice(0, 110);
  return `${scenario} MCP：${t.slice(0, 90)}`;
}

export function mcpScopeZh(scenario) {
  const map = {
    '社媒·发布': '多平台排期、矩阵分发、草稿与数据分析',
    '设计·创作': '设计稿读取、品牌物料、模板导出',
    '搜索·抓取': '联网调研、竞品页、舆情与结构化提取',
    '协作·办公': '团队消息、文档、日历与任务协同',
    '办公·文档': 'Word/Excel/PPT/PDF 生成与编辑',
    '办公·协作': 'Gmail、Drive、Docs、Sheets 自动化',
    '营销·投放': '广告账户、素材、报表与归因',
    '营销·SEO': '关键词、SERP、站点审计',
    '营销·CRM': '线索、客户、Campaign 数据',
    '图像·视频生成': '文生图、文生视频、配音与剪辑',
    'HTML·视频': 'HTML 分镜渲染为 MP4',
    '社媒·监测': '竞品社媒数据、热点与互动分析',
    '浏览器·自动化': '无头浏览器、E2E、截图与表单',
    '开发者·工具': '代码仓库、CI、调试与工程效率',
    '数据库': 'SQL 查询、Schema 与数据管道',
    '数据库·后端': 'BaaS、Auth、Storage 一体化',
    '监控·可观测': '错误、性能、日志与告警',
    '云·边缘': 'Workers、CDN、DNS 与边缘部署',
    '聚合·发现': '发现、评估与安装 MCP/Skill',
    '金融·支付': '支付、订阅与账务',
    '项目·管理': 'Issue、路线图与团队协作',
    '文件·工具': '本地/远程文件读写',
    '知识·记忆': '长期记忆与知识沉淀',
    '医疗·健康': '临床、文献与健康数据',
    '教育·学习': '课程、题库与学习辅助',
    '电商·零售': '商品、订单与店铺运营',
  };
  return map[scenario] || 'Agent 工作流扩展与外部系统连接';
}
