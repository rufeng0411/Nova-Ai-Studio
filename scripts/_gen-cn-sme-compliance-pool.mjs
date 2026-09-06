import fs from 'node:fs';

const channels = [
  { id: 1, group: 'A', name: 'skills.sh 安装榜 + npx skills find', status: 'done', note: '多词检索 bookkeeping/tax/contract/rfp/tender/hr' },
  { id: 2, group: 'A', name: 'officialskills.sh', status: 'done', note: '交叉确认官方向条目' },
  { id: 3, group: 'A', name: 'VoltAgent/awesome-agent-skills', status: 'done', note: '命中 draft-nda/privacy-policy/finance 有限' },
  { id: 4, group: 'A', name: 'heilcheng → agent-skill.co', status: 'done', note: '可达，域内条目少' },
  { id: 5, group: 'A', name: 'SkillsMP', status: 'done', note: 'PossibLaw/Nexus 系列' },
  { id: 6, group: 'A', name: 'Claude Partners Skills', status: 'done', note: '经 skills.sh/partners 交叉' },
  { id: 7, group: 'A', name: 'anthropics/skills', status: 'done', note: '偏通用/开发元技能' },
  { id: 8, group: 'A', name: 'anthropics/knowledge-work-plugins', status: 'done', note: 'legal/finance/HR 三插件' },
  { id: 9, group: 'A', name: 'anthropics/claude-for-legal', status: 'done', note: '美法原版，CN fork 另列' },
  { id: 10, group: 'A', name: 'openai/skills', status: 'done', note: '几乎无法务/财税领域' },
  { id: 11, group: 'A', name: 'GitHub 主题直搜（七类英文词）', status: 'done', note: 'WebSearch+API' },
  { id: 12, group: 'A', name: 'Skillselion / ClaudePluginHub 交叉', status: 'done', note: '与 skills.sh 重叠确认' },
  { id: 13, group: 'A', name: 'Composio / awesome-claude-skills', status: 'done', note: '合规向命中有限' },
  { id: 14, group: 'B', name: 'vivy-yi/Greater-China-Legal', status: 'done', note: 'P0 深读' },
  { id: 15, group: 'B', name: 'elfbobo/Greater-China-Legal', status: 'done', note: '过时 fork' },
  { id: 16, group: 'B', name: 'drdavid-kor/claude-for-legal-cn', status: 'done', note: '美法未本土化' },
  { id: 17, group: 'B', name: 'huodebing-alt/Claude-Code-Law-Firm', status: 'done', note: '律所多Agent架构' },
  { id: 18, group: 'B', name: 'zhou210712 employment-legal / legal-zh', status: 'done', note: '主候选 176★' },
  { id: 19, group: 'B', name: 'skill-hub (kevinaimonster)', status: 'done', note: '泛目录，合规子集弱' },
  { id: 20, group: 'B', name: 'JimLiu/baoyu-skills', status: 'done', note: '企服命中弱，未作主候选' },
  { id: 21, group: 'B', name: '中文 GitHub：招投标/税务/劳动/合规', status: 'done', note: '命中 bidsmart/BiaoShu/zh-xx' },
  { id: 22, group: 'B', name: '飞书/企微生态 Skills', status: 'done', note: 'skills.sh 企业向交叉' },
  { id: 23, group: 'B', name: 'bytedance/deer-flow', status: 'done', note: '政策研究组合非专向合规' },
  { id: 24, group: 'B', name: '本仓 skills/vendor/legal 上游对照', status: 'done', note: 'legal-lav / lpm' },
  { id: 25, group: 'C', name: 'punkpeye/awesome-mcp-servers', status: 'done', note: 'Finance 富 / Legal 薄' },
  { id: 26, group: 'C', name: 'Smithery.ai', status: 'done', note: '快扫 Xero/QBO/HR/Handaas' },
  { id: 27, group: 'C', name: 'Glama MCP', status: 'done', note: '会计/HR/政府类索引' },
  { id: 28, group: 'C', name: 'MCP 官方 Registry', status: 'done', note: '交叉确认' },
  { id: 29, group: 'C', name: 'handaas/policy-mcp-server', status: 'done', note: '惠企补贴' },
  { id: 30, group: 'C', name: 'guangxiangdebizi/China-Central-Policy-MCP', status: 'done', note: 'gov.cn' },
  { id: 31, group: 'C', name: '其他政策/企业数据 MCP', status: 'done', note: 'Handaas bidding/industry-chain；企查查类仅许可评' },
  { id: 32, group: 'C', name: 'Firecrawl / Tavily / Apify', status: 'done', note: '组合抓取能力' },
  { id: 33, group: 'C', name: '元典/北大法宝/威科/无讼', status: 'done', note: '商用许可专评，不入库正文' },
  { id: 34, group: 'D', name: '中国政府网/国务院政策库/国家法律法规数据库', status: 'done', note: '权威数据面' },
  { id: 35, group: 'D', name: '部委：工信/发改/科技/人社/财政/税务/市监/司法', status: 'done', note: '入口表' },
  { id: 36, group: 'D', name: '31 省人民政府惠企专栏', status: 'done', note: '≥90% URL' },
  { id: 37, group: 'D', name: '抽样市/区县一网通办惠企页', status: 'done', note: '圈层配额' },
  { id: 38, group: 'D', name: '中国政府采购网+省公招入口', status: 'done', note: 'ccgp.gov.cn' },
  { id: 39, group: 'D', name: '专精特新服务网等第三方', status: 'done', note: '标注非官方' },
];

const cats = {
  1: '小微合规政策',
  2: '合同招投标标书',
  3: '财务税务会计出纳',
  4: '人力合规',
  5: '企业法律',
  6: '合法税务筹划',
  7: '扶持政策国家至区县',
};

function score(L, T, P, I, D, G) {
  const total = L + T + P + I + D + G;
  const stars = total >= 27 ? 5 : total >= 22 ? 4 : total >= 16 ? 3 : total >= 11 ? 2 : 1;
  return { L, T, P, I, D, G, total, stars };
}

const candidates = [];
function add(row) {
  candidates.push({ id: candidates.length + 1, wave: row.wave || 'wave1', ...row });
}

const zhouPlugins = [
  ['employment-legal', '人力/劳动合同社保解除', [4, 1], score(5, 4, 4, 5, 3, 5)],
  ['commercial-legal', '商事合同审查', [2, 5], score(5, 4, 4, 5, 3, 5)],
  ['corporate-legal', '公司法股权章程', [5, 1], score(5, 4, 4, 5, 3, 5)],
  ['privacy-legal', 'PIPL/数据合规', [1, 5], score(5, 4, 4, 5, 3, 4)],
  ['product-legal', '产品上线/广告法', [1, 5], score(5, 4, 4, 5, 3, 4)],
  ['regulatory-legal', '监管合规入门', [1, 5], score(4, 4, 4, 5, 3, 4)],
  ['ip-legal', '知产商标专利', [5], score(4, 4, 4, 5, 3, 3)],
  ['litigation-legal', '诉讼仲裁', [5, 4], score(4, 3, 3, 5, 3, 3)],
  ['ai-governance-legal', 'AI治理合规', [1, 5], score(3, 4, 3, 5, 3, 2)],
  ['law-student', '法学学习', [5], score(3, 3, 2, 5, 3, 1)],
  ['legal-clinic', '法律诊所', [5], score(3, 3, 2, 5, 3, 1)],
  ['legal-builder-hub', '技能构建中枢', [5], score(3, 4, 3, 5, 3, 2)],
];
for (const [slug, desc, catsArr, sc] of zhouPlugins) {
  add({
    name: `claude-for-legal-ZH / ${slug}`,
    slug: `zh-legal-${slug}`,
    categories: catsArr,
    url: 'https://github.com/zhou210712/claude-for-legal-ZH',
    jurisdiction: 'CN',
    type: 'plugin',
    desc,
    stars: 176,
    license: 'Apache-2.0',
    source_channel: 18,
    scores: sc,
    suggest: sc.total >= 22 && sc.L >= 4 && sc.I >= 3 ? '安装' : '观察',
  });
}

const vivyScenes = [
  ['employment-legal', '社保/合同/竞业/仲裁', [4, 1], score(5, 4, 3, 3, 3, 4)],
  ['contract-review', '合同审查场景', [2, 5], score(5, 4, 3, 3, 3, 4)],
  ['tax-compliance', '发票/增值税/税优', [3, 6], score(5, 4, 3, 3, 3, 5)],
  ['corporate-governance', '公司治理/设立/ESOP', [5], score(5, 4, 3, 3, 3, 4)],
  ['data-compliance', '数据合规', [1, 5], score(5, 4, 3, 3, 3, 3)],
  ['regulatory-compliance', '监管合规', [1], score(4, 4, 3, 3, 3, 3)],
  ['labor-arbitration', '劳动仲裁', [4], score(5, 4, 3, 3, 3, 3)],
  ['m-and-a', '并购', [5, 6], score(3, 4, 2, 3, 3, 2)],
  ['product-legal', '产品合规', [1], score(4, 4, 3, 3, 3, 3)],
  ['tax-preference-advisor', '高新小微研发加计', [6, 7], score(5, 4, 3, 3, 3, 5)],
];
for (const [slug, desc, catsArr, sc] of vivyScenes) {
  add({
    name: `Greater-China-Legal / ${slug}`,
    slug: `gcl-${slug}`,
    categories: catsArr,
    url: 'https://github.com/vivy-yi/Greater-China-Legal',
    jurisdiction: 'CN/HK/TW/SG',
    type: 'plugin',
    desc,
    stars: 16,
    license: 'Apache-2.0(README; LICENSE文件未登记)',
    source_channel: 14,
    scores: sc,
    suggest: '观察',
  });
}

const packs = [
  ['elfbobo/Greater-China-Legal', 'elfbobo-gcl', [1, 4, 5], 'https://github.com/elfbobo/Greater-China-Legal', 'CN', 'plugin', 'vivy过时fork', 0, 'Apache-2.0', 15, score(4, 2, 2, 4, 3, 1), '不装'],
  ['drdavid-kor/claude-for-legal-cn', 'drdavid-cfl-cn', [5], 'https://github.com/drdavid-kor/claude-for-legal-cn', 'US-leaning', 'plugin', '劳务法fork未本土化', 2, 'Apache-2.0', 16, score(2, 2, 3, 5, 3, 1), '不装'],
  ['MapleEve/legal-skills-cn', 'mapleeve-legal-cn', [4, 5, 2], 'https://github.com/MapleEve/legal-skills-cn', 'CN', 'plugin', '与zhou同系CN fork', 5, 'Apache-2.0', 18, score(4, 3, 4, 5, 3, 3), '观察'],
  ['huodebing Claude-Code-Law-Firm', 'huodebing-law-firm', [5, 6, 4], 'https://github.com/huodebing-alt/Claude-Code-Law-Firm', 'CN', 'combo', '律所多Agent+connectors', 0, 'MIT', 17, score(4, 3, 1, 4, 2, 2), '不装'],
  ['zh-xx/legal-assistant-skills', 'zh-xx-legal-assistant', [1, 2, 5], 'https://github.com/zh-xx/legal-assistant-skills', 'CN', 'skill', '合同审/广告法/食品标签', 155, 'Apache-2.0', 21, score(5, 4, 4, 5, 4, 4), '安装'],
  ['pa1nrui1/legal-skills', 'pa1nrui1-legal', [4, 5], 'https://github.com/pa1nrui1/legal-skills', 'CN', 'skill', '劳动争议/合同/刑辩流程', 57, 'MIT', 21, score(4, 3, 3, 4, 4, 3), '观察'],
  ['Get00/BiaoShu-SKILL', 'biaoshu-skill', [2], 'https://github.com/Get00/BiaoShu-SKILL', 'CN', 'skill', '多行业标书生成', 86, 'Apache-2.0', 21, score(5, 4, 4, 5, 4, 5), '安装'],
  ['youyouhe/bidsmart-claude-skills', 'bidsmart', [2, 7], 'https://github.com/youyouhe/bidsmart-claude-skills', 'CN', 'skill', '政府采购全链路', 4, 'MIT', 21, score(5, 4, 4, 4, 4, 5), '安装'],
  ['Hugin-Z/tender-writer-v3', 'tender-writer-v3', [2], 'https://github.com/Hugin-Z/tender-writer-v3', 'CN', 'skill', '政府技术标工程化', 5, 'MIT', 21, score(4, 3, 3, 4, 4, 4), '观察'],
  ['seam3/bidsmart-claude-skills', 'seam3-bidsmart', [2], 'https://github.com/seam3/bidsmart-claude-skills', 'CN', 'skill', 'youyouhe fork', 0, 'MIT', 21, score(4, 2, 3, 4, 4, 1), '不装'],
  ['anthropics/claude-for-legal', 'anthropic-cfl', [2, 4, 5], 'https://github.com/anthropics/claude-for-legal', 'US', 'plugin', '官方美法法律套件', 8985, 'Apache-2.0', 9, score(1, 5, 3, 5, 3, 1), '观察'],
  ['KW legal plugin', 'kw-legal', [2, 5], 'https://github.com/anthropics/knowledge-work-plugins/tree/main/legal', 'US', 'plugin', '合同/NDA/合规', 23100, 'unknown', 8, score(1, 5, 3, 3, 3, 1), '观察'],
  ['KW finance plugin', 'kw-finance', [3], 'https://github.com/anthropics/knowledge-work-plugins/tree/main/finance', 'US-GAAP', 'plugin', '月结对账SOX', 23100, 'unknown', 8, score(1, 5, 3, 3, 3, 2), '观察'],
  ['KW HR plugin', 'kw-hr', [4], 'https://github.com/anthropics/knowledge-work-plugins/tree/main/human-resources', 'US', 'plugin', '录用入职政策薪酬', 23100, 'unknown', 8, score(1, 5, 3, 3, 3, 1), '观察'],
  ['Receiptor bookkeeping-skills', 'receiptor-bookkeeping', [3, 6], 'https://github.com/Receiptor-AI/bookkeeping-skills', 'US-primary', 'skill', 'SME记账闭环', 0, 'MIT', 1, score(2, 4, 4, 5, 4, 2), '观察'],
  ['openaccountant/skills', 'openaccountant-skills', [3, 6], 'https://github.com/openaccountant/skills', 'US', 'skill', '税筹/1099/销售税', 42, 'unknown', 1, score(1, 4, 3, 3, 4, 1), '不装'],
  ['GAJETOso/financeskills', 'financeskills', [3, 6], 'https://github.com/GAJETOso/financeskills', 'IFRS/GAAP', 'skill', '税务筹划收入确认审计', 0, 'unknown', 11, score(2, 3, 3, 3, 4, 2), '观察'],
  ['lawve awesome-legal-skills', 'lawve-awesome', [2, 4, 5], 'https://github.com/lawve-ai/awesome-legal-skills', 'multi', 'combo', '~139法律技能目录', 570, 'other', 13, score(2, 4, 2, 3, 3, 2), '观察'],
  ['legalopsconsulting/lpm-skills', 'lpm-skills', [5], 'https://github.com/legalopsconsulting/lpm-skills', 'global-firm', 'skill', '法律项目管理16技能', 0, 'Apache-2.0', 24, score(1, 4, 4, 5, 4, 1), '观察'],
  ['rfp-responder', 'rfp-responder', [2], 'https://www.skills.sh/alirezarezvani/claude-skills/rfp-responder', 'global', 'skill', 'Shipley投标策略', 374, 'unknown', 1, score(2, 4, 3, 3, 4, 3), '观察'],
  ['rfp-response', 'rfp-response', [2], 'https://www.skills.sh/guia-matthieu/clawfu-skills/rfp-response', 'global', 'skill', '合规矩阵提案结构', 263, 'unknown', 1, score(2, 3, 3, 3, 4, 2), '观察'],
  ['tender-analyzer', 'tender-analyzer', [2], 'https://www.skills.sh/somarkai/skills/tender-analyzer', 'global', 'skill', '标书要求评分红旗', 290, 'unknown', 1, score(2, 4, 3, 3, 4, 3), '观察'],
  ['draft-nda pm-skills', 'draft-nda', [2], 'https://github.com/phuryn/pm-skills', 'global', 'skill', 'NDA条款起草', 0, 'unknown', 3, score(2, 3, 3, 3, 4, 1), '观察'],
  ['privacy-policy pm-skills', 'privacy-policy', [1], 'https://github.com/phuryn/pm-skills', 'GDPR', 'skill', '隐私政策起草', 0, 'unknown', 3, score(2, 3, 3, 3, 4, 1), '观察'],
  ['due-diligence-agents', 'due-diligence-agents', [5, 3, 4], 'https://github.com/zoharbabin/due-diligence-agents', 'global', 'combo', '九域尽调多智能体', 0, 'unknown', 11, score(2, 3, 2, 3, 3, 2), '观察'],
  ['bytedance/deer-flow', 'deer-flow', [7], 'https://github.com/bytedance/deer-flow', 'CN', 'combo', '政策研究工作流组合', 0, 'unknown', 23, score(3, 4, 2, 3, 3, 3), '观察'],
  ['policy-research-combo firecrawl+gov', 'policy-research-combo', [7, 1], 'https://www.gov.cn/', 'CN', 'combo', 'Firecrawl/搜索+政府网政策研究组合（非独立仓）', 0, 'n/a', 32, score(4, 4, 3, 4, 3, 4), '观察'],
  ['specialized-sme-playbook-stub', 'specialized-sme-playbook', [7], 'search-hit://zjtx', 'CN', 'skill', '专精特新申报材料清单类自建候选（生态真空声明）', 0, 'n/a', 21, score(4, 2, 3, 3, 4, 4), '数据源组合/自建'],
];
for (const p of packs) {
  const [name, slug, categories, url, jurisdiction, type, desc, stars, license, source_channel, scores, suggest] = p;
  add({ name, slug, categories, url, jurisdiction, type, desc, stars, license, source_channel, scores, suggest });
}

const mcps = [
  ['Handaas Policy MCP', 'handaas-policy', [7, 1], 'https://github.com/handaas/policy-mcp-server', 'CN', 'mcp', '政府补贴/政策优惠查询', 2, 'commercial', 29, score(5, 4, 4, 2, 2, 5), '观察'],
  ['Handaas Bidding MCP', 'handaas-bidding', [2, 7], 'https://github.com/handaas/bidding-mcp-server', 'CN', 'mcp', '招投标/中标/拟建', 0, 'commercial', 31, score(5, 4, 4, 2, 2, 5), '观察'],
  ['Handaas Industry Chain MCP', 'handaas-industry', [7, 2], 'https://github.com/handaas/industry-chain-mcp-server', 'CN', 'mcp', '政策+招投标+企业', 0, 'commercial', 31, score(5, 3, 3, 2, 2, 4), '观察'],
  ['China-Central-Policy-MCP', 'cn-central-policy-mcp', [7, 1], 'https://github.com/guangxiangdebizi/China-Central-Policy-MCP', 'CN', 'mcp', 'gov.cn政策列表+正文', 19, 'unknown', 30, score(5, 5, 5, 4, 4, 5), '安装'],
  ['FinanceMCP', 'finance-mcp', [3], 'https://github.com/guangxiangdebizi/FinanceMCP', 'CN', 'mcp', '宏观/金融数据非报税', 603, 'unknown', 30, score(3, 4, 3, 3, 3, 2), '观察'],
  ['GovRider MCP', 'govrider', [2, 7], 'https://github.com/carlosahumada89/govrider-mcp-server', 'global', 'mcp', '全球政府招标补助', 0, 'unknown', 25, score(1, 3, 3, 3, 3, 2), '观察'],
  ['GovToolsPro MCP', 'govtoolspro', [2, 7], 'https://github.com/smythmyke/govtoolspro-mcp-server', 'US', 'mcp', 'SAM.gov投标go/no-go', 0, 'unknown', 25, score(1, 3, 3, 3, 3, 1), '不装'],
  ['Xero MCP', 'xero-mcp', [3], 'https://github.com/XeroAPI/xero-mcp-server', 'global', 'mcp', 'Xero账务API', 0, 'unknown', 26, score(1, 5, 4, 4, 2, 1), '不装'],
  ['QuickBooks Online MCP', 'qbo-mcp', [3], 'https://github.com/intuit/quickbooks-online-mcp-server', 'US', 'mcp', 'QBO CRUD+报表', 0, 'unknown', 26, score(1, 5, 4, 4, 2, 1), '不装'],
  ['OpenAccountants MCP', 'openaccountants-mcp', [3, 6], 'https://github.com/openaccountants/openaccountants', 'multi', 'mcp', '多司法辖区会计', 0, 'unknown', 27, score(2, 3, 3, 3, 3, 2), '观察'],
  ['HR Management AI MCP', 'hr-mgmt-mcp', [4], 'https://glama.ai/mcp/servers/CSOAI-ORG/hr-management-ai-mcp', 'EU', 'mcp', '休假薪资绩效合规', 0, 'unknown', 27, score(1, 3, 3, 3, 3, 1), '不装'],
  ['SEC EDGAR MCP', 'sec-edgar-mcp', [5, 3], 'https://github.com/AEGISGOVDAO/aegisgov-sec-mcp', 'US', 'mcp', 'SEC申报', 0, 'unknown', 25, score(1, 4, 3, 3, 3, 1), '不装'],
  ['2s-io Legal Data MCP', '2s-io-legal', [5], 'https://github.com/2s-io/sdk', 'US', 'mcp', '判例/Federal Register/OFAC', 0, 'x402', 25, score(1, 3, 2, 2, 2, 1), '不装'],
  ['Taiwan Payroll MCP', 'taiwan-payroll', [4, 3], 'https://github.com/supra126/taiwan-payroll', 'TW', 'mcp', '劳健保扣缴', 0, 'unknown', 27, score(2, 4, 3, 3, 3, 1), '观察'],
  ['Flexorch Docs MCP', 'flexorch-mcp', [2, 3], 'https://github.com/flexorch/flexorch-mcp', 'multi', 'mcp', '合同发票工资单OCR', 0, 'unknown', 27, score(2, 3, 3, 3, 3, 2), '观察'],
  ['Firecrawl MCP (combo)', 'firecrawl-combo', [1, 7], 'https://github.com/mendableai/firecrawl', 'global', 'mcp', '网页抓取组合政策页', 0, 'commercial', 32, score(3, 5, 4, 3, 3, 3), '观察'],
  ['Tavily Search (combo)', 'tavily-combo', [1, 7], 'https://tavily.com/', 'global', 'mcp', '检索组合', 0, 'commercial', 32, score(3, 5, 4, 3, 2, 2), '观察'],
  ['Apify (combo)', 'apify-combo', [2, 7], 'https://apify.com/', 'global', 'mcp', '爬虫Actors组合', 0, 'commercial', 32, score(2, 4, 3, 3, 2, 2), '观察'],
];
for (const m of mcps) {
  const [name, slug, categories, url, jurisdiction, type, desc, stars, license, source_channel, scores, suggest] = m;
  add({ name, slug, categories, url, jurisdiction, type, desc, stars, license, source_channel, scores, suggest });
}

const atomics = [
  ['termination-review', '解除高风险/N+1', [4], 'zhou', score(5, 4, 4, 5, 3, 5)],
  ['hiring-review', 'Offer/竞业/服务期', [4], 'zhou', score(5, 4, 4, 5, 3, 5)],
  ['worker-classification', '劳动关系三要素', [4], 'zhou', score(5, 4, 4, 5, 3, 4)],
  ['wage-hour-qa', '工时加班问答', [4], 'zhou', score(5, 4, 4, 5, 3, 4)],
  ['handbook-review', '员工手册审查', [4], 'zhou', score(5, 4, 4, 5, 3, 4)],
  ['nda-review', 'NDA审查', [2], 'zhou', score(5, 4, 4, 5, 3, 4)],
  ['vendor-agreement-review', '供应商协议', [2], 'zhou', score(5, 4, 4, 5, 3, 4)],
  ['saas-msa-review', 'SaaS主协议', [2], 'zhou', score(4, 4, 4, 5, 3, 3)],
  ['contract-review-router', '合同审查路由', [2], 'zhou', score(5, 4, 4, 5, 3, 4)],
  ['entity-compliance', '年报申报截止', [5, 1], 'zhou', score(5, 4, 4, 5, 3, 4)],
  ['diligence-issue-extraction', '尽调问题提取', [5], 'zhou', score(4, 4, 4, 5, 3, 3)],
  ['tabular-review', '表格化审查', [5], 'zhou', score(4, 4, 4, 5, 3, 3)],
  ['pia-generation', '个人信息影响评估', [1, 5], 'zhou', score(5, 4, 4, 5, 3, 4)],
  ['dsar-response', '主体权利响应', [1], 'zhou', score(5, 4, 4, 5, 3, 3)],
  ['invoice-compliance-checker', '发票三流一致', [3, 6], 'vivy', score(5, 4, 3, 3, 3, 5)],
  ['vat-compliance', '增值税合规', [3], 'vivy', score(5, 4, 3, 3, 3, 5)],
  ['cit-quarterly', '企税季度预缴', [3], 'vivy', score(5, 3, 3, 3, 3, 4)],
  ['rd-super-deduction', '研发加计扣除', [6], 'vivy', score(5, 4, 3, 3, 3, 5)],
  ['sme-tax-preference', '小微优惠', [6, 7], 'vivy', score(5, 4, 3, 3, 3, 5)],
  ['social-insurance-compliance', '社保公积金', [4], 'vivy', score(5, 4, 3, 3, 3, 5)],
  ['labor-contract-drafter', '劳动合同起草', [4], 'vivy', score(5, 4, 3, 3, 3, 4)],
  ['non-compete-enforcement', '竞业限制', [4], 'vivy', score(5, 4, 3, 3, 3, 4)],
  ['entity-setup', '主体设立', [5, 1], 'vivy', score(5, 4, 3, 3, 3, 4)],
  ['esop-incentive-plan', 'ESOP', [5, 6], 'vivy', score(4, 4, 3, 3, 3, 3)],
  ['odi-compliance', '境外投资ODI', [5], 'vivy', score(3, 4, 2, 3, 3, 2)],
  ['bookkeeping-setup', '账套建立', [3], 'receiptor', score(2, 4, 4, 5, 4, 2)],
  ['receipt-processing', '收据发票提取', [3], 'receiptor', score(2, 4, 4, 5, 4, 2)],
  ['bank-reconciliation', '银行对账', [3], 'receiptor', score(2, 4, 4, 5, 4, 2)],
  ['monthly-close', '月结清单', [3], 'receiptor', score(2, 4, 4, 5, 4, 2)],
  ['expense-categorization', '费用分类', [3], 'receiptor', score(2, 4, 4, 5, 4, 2)],
  ['review-contract', '按playbook审合同', [2], 'kw', score(1, 5, 3, 3, 3, 1)],
  ['nda-triage', 'NDA绿黄红', [2], 'kw', score(1, 5, 3, 3, 3, 1)],
  ['journal-entry', '分录编制', [3], 'kw', score(1, 5, 3, 3, 3, 1)],
  ['reconciliation', '总账对账', [3], 'kw', score(1, 5, 3, 3, 3, 1)],
  ['close-management', '月结管理', [3], 'kw', score(1, 5, 3, 3, 3, 1)],
  ['sox-testing', 'SOX测试', [1, 3], 'kw', score(1, 5, 3, 3, 3, 1)],
  ['draft-offer', '录用信', [4], 'kw', score(1, 5, 3, 3, 3, 1)],
  ['policy-lookup', '公司政策检索', [4], 'kw', score(1, 5, 3, 3, 3, 1)],
  ['cfl-vendor-agreement-review', '供应商协议偏差备忘', [2], 'cfl-us', score(1, 5, 3, 5, 3, 1)],
  ['cfl-entity-compliance', '实体年检', [5], 'cfl-us', score(1, 5, 3, 5, 3, 1)],
  ['cfl-worker-classification', '雇员vs承包商', [4], 'cfl-us', score(1, 5, 3, 5, 3, 1)],
  ['matter-intake-scoping', '案件intake', [5], 'lpm', score(1, 4, 4, 5, 4, 1)],
  ['matter-plan-builder', '事项计划', [5], 'lpm', score(1, 4, 4, 5, 4, 1)],
  ['budget-and-fee-manager', '律师费预算', [5], 'lpm', score(1, 4, 4, 5, 4, 1)],
  ['billing-cycle-manager', '账单周期', [5], 'lpm', score(1, 4, 4, 5, 4, 1)],
  ['rfp-pitch-management', '外所RFP', [2, 5], 'lawve', score(2, 4, 2, 3, 3, 2)],
  ['employment-law-research', '雇佣法研究', [4], 'lawve', score(2, 4, 2, 3, 3, 2)],
  ['dpia-sentinel', 'GDPR DPIA', [1], 'lawve', score(1, 4, 2, 3, 3, 1)],
  ['eu-ai-act-triage', 'AI Act分流', [1], 'lawve', score(1, 4, 2, 3, 3, 1)],
  ['vendor-due-diligence', 'IT供应商尽调', [1, 2], 'lawve', score(1, 4, 2, 3, 3, 1)],
  ['bidsmart-bid-analysis', '招标文件解析', [2], 'bidsmart', score(5, 4, 4, 4, 4, 5)],
  ['bidsmart-commercial-bid', '商务标', [2], 'bidsmart', score(5, 4, 4, 4, 4, 5)],
  ['bidsmart-technical-bid', '技术标', [2], 'bidsmart', score(5, 4, 4, 4, 4, 5)],
  ['bidsmart-clarification', '澄清答疑', [2], 'bidsmart', score(5, 4, 4, 4, 4, 4)],
  ['biaoshu-multi-industry', '多行业标书模板', [2], 'biaoshu', score(5, 4, 4, 5, 4, 5)],
  ['draft-employment-contract', '劳动合同草稿', [4], 'huodebing', score(4, 3, 1, 4, 2, 2)],
  ['cit-planning-memo', '企税筹划备忘', [6], 'huodebing', score(4, 3, 1, 4, 2, 3)],
  ['pipl-compliance-program-full', 'PIPL合规项目', [1], 'huodebing', score(4, 3, 1, 4, 2, 2)],
  ['tax-planning-ifrs', '税务筹划框架', [6], 'financeskills', score(2, 3, 3, 3, 4, 2)],
  ['revenue-recognition', '收入确认', [3], 'financeskills', score(2, 3, 3, 3, 4, 2)],
  ['audit-checklist', '审计清单', [3], 'financeskills', score(2, 3, 3, 3, 4, 1)],
  ['statement-preparation', '三表编制', [3], 'financeskills', score(2, 3, 3, 3, 4, 2)],
  ['oa-quarterly-taxes', '季度税估算', [3, 6], 'oa', score(1, 4, 3, 3, 4, 1)],
  ['oa-sales-tax-nexus', '销售税nexus', [3], 'oa', score(1, 4, 3, 3, 4, 1)],
  ['oa-contractor-tracking', '承包商追踪', [3, 4], 'oa', score(1, 4, 3, 3, 4, 1)],
  ['ccgp-gov-tender-portal', '中国政府采购网入口组合', [2, 7], 'datasource', score(5, 5, 5, 5, 5, 4)],
  ['miit-zjtx-specialized', '工信部专精特新', [7], 'datasource', score(5, 5, 5, 5, 5, 5)],
  ['sat-policy-lib', '税务总局政策法规库', [3, 6], 'datasource', score(5, 5, 5, 5, 5, 5)],
  ['npc-law-database', '国家法律法规数据库', [1, 5], 'datasource', score(5, 5, 5, 5, 5, 4)],
  ['samr-enterprise-credit', '市监总局企业信用', [1], 'datasource', score(5, 5, 5, 5, 5, 4)],
  ['mohrss-policy', '人社部政策', [4, 7], 'datasource', score(5, 5, 5, 5, 5, 4)],
  ['gov-cn-huiqi', '中国政府网惠企集纳', [7], 'datasource', score(5, 5, 5, 5, 5, 5)],
  ['pkulaw-connector-doc', '北大法宝连接器文档', [5], 'commercial-kb', score(5, 3, 1, 1, 1, 3)],
  ['weike-connector-doc', '威科先行连接器文档', [5], 'commercial-kb', score(5, 3, 1, 1, 1, 3)],
  ['itslaw-connector-doc', '无讼连接器文档', [5], 'commercial-kb', score(4, 3, 1, 1, 1, 2)],
  ['yuandian-mcp-doc', '元典MCP文档', [5], 'commercial-kb', score(5, 4, 2, 2, 2, 3)],
  ['qichacha-api-doc', '企查查API许可评', [1, 7], 'commercial-kb', score(5, 4, 2, 1, 1, 3)],
  ['tianyancha-api-doc', '天眼查API许可评', [1, 7], 'commercial-kb', score(5, 4, 2, 1, 1, 3)],
  ['accounting-whawkins', '初创记账体系', [3], 'skills.sh', score(2, 3, 3, 3, 4, 1)],
  ['financial-operations-expert', '财务运营专家', [3], 'skills.sh', score(1, 3, 2, 3, 3, 1)],
  ['nexus-legal-analyzer', 'Nexus合同分析', [2, 5], 'skillsmp', score(1, 3, 1, 1, 2, 1)],
  ['nexus-eu-ai-compliance', 'EU AI合规', [1], 'skillsmp', score(1, 3, 1, 1, 2, 1)],
  ['possiblaw-legal', 'PossibLaw法律', [5], 'skillsmp', score(1, 3, 1, 2, 2, 1)],
  ['federal-agent', 'US联邦采购数据', [2, 7], 'github', score(1, 3, 2, 3, 3, 1)],
  ['rfp-ingest', 'SAM.gov RFP入库', [2], 'github', score(1, 3, 2, 3, 3, 1)],
  ['mcp-accounting-practice', 'MCP Accounting实践', [3, 6], 'glama', score(1, 3, 3, 3, 3, 1)],
  ['keycae-ar-invoicing', '阿根廷电子发票', [3], 'glama', score(1, 3, 2, 3, 2, 1)],
];

const urlMap = {
  zhou: 'https://github.com/zhou210712/claude-for-legal-ZH',
  vivy: 'https://github.com/vivy-yi/Greater-China-Legal',
  receiptor: 'https://github.com/Receiptor-AI/bookkeeping-skills',
  kw: 'https://github.com/anthropics/knowledge-work-plugins',
  'cfl-us': 'https://github.com/anthropics/claude-for-legal',
  lpm: 'https://github.com/legalopsconsulting/lpm-skills',
  lawve: 'https://github.com/lawve-ai/awesome-legal-skills',
  bidsmart: 'https://github.com/youyouhe/bidsmart-claude-skills',
  biaoshu: 'https://github.com/Get00/BiaoShu-SKILL',
  huodebing: 'https://github.com/huodebing-alt/Claude-Code-Law-Firm',
  financeskills: 'https://github.com/GAJETOso/financeskills',
  oa: 'https://github.com/openaccountant/skills',
  datasource: 'https://www.gov.cn/',
  'commercial-kb': 'n/a',
  'skills.sh': 'https://skills.sh/',
  skillsmp: 'https://skillsmp.com/',
  github: 'https://github.com/',
  glama: 'https://glama.ai/mcp/servers',
};

for (const [slug, desc, categories, src, scores] of atomics) {
  add({
    name: slug,
    slug: `atom-${slug}`,
    categories,
    url: urlMap[src] || 'n/a',
    jurisdiction: ['zhou', 'vivy', 'bidsmart', 'biaoshu', 'huodebing', 'datasource', 'commercial-kb'].includes(src) ? 'CN' : 'non-CN',
    type: src === 'commercial-kb' ? 'commercial-kb' : src === 'datasource' ? 'datasource' : 'skill',
    desc,
    stars: 0,
    license: 'see-parent',
    source_channel: 11,
    scores,
    suggest: scores.total >= 22 && scores.L >= 4 && scores.I >= 3 ? '安装' : scores.L <= 2 ? '不装' : '观察',
    parent: src,
  });
}

const baseline = JSON.parse(fs.readFileSync('docs/_cn-sme-baseline-catalog-20260802.json', 'utf8'));
for (const r of baseline.rows) {
  if (!(/^legal-|^lpm-|^fin-/.test(r.slug) || r.category_subtag === 'legal_compliance' || r.major_category === 'finance')) continue;
  let categories = [5];
  if (/^fin-|^mkt-rev|^mkt-pric|^anth-xlsx|^df-/.test(r.slug) || r.major_category === 'finance') categories = [3];
  if (/employment|hr|wage/i.test(r.slug)) categories = [4];
  if (/compliance|gdpr|privacy|pipl/i.test(r.slug)) categories = [1];
  if (/contract|nda|rfp/i.test(r.slug)) categories = [2];
  add({
    name: `INSTALLED:${r.display_name || r.slug}`,
    slug: r.slug,
    categories,
    url: 'local://catalog',
    jurisdiction: /^legal-lav|^lpm-/.test(r.slug) ? 'EU/US' : r.major_category === 'finance' ? 'global-finance' : 'CN-neutral',
    type: 'installed',
    desc: `major=${r.major_category}; sub=${r.category_subtag}; hidden=${r.hidden_in_hub}`,
    stars: 0,
    license: 'vendored',
    source_channel: 24,
    scores: score(/^legal-lav|^lpm-/.test(r.slug) ? 1 : 2, 3, 5, 4, 4, 1),
    suggest: r.hidden_in_hub ? '隐藏保留' : '已装可见',
    hidden_in_hub: r.hidden_in_hub,
    wave: 'wave0',
  });
}

const fillThemes = [
  [1, '等保2.0入门指引 skill 检索', 'mlps-entry', '未发现成熟独立仓；建议数据源+自建'],
  [1, '反不正当竞争审查', 'auc-review', '分散在产品合规 skill'],
  [1, '广告法违禁词', 'ad-law-words', 'zh-xx/product-legal 覆盖'],
  [1, '年报公示提醒', 'annual-report', 'entity-compliance'],
  [1, '餐饮许可合规', 'catering-license', '生态真空'],
  [1, '电商平台规则合规', 'ecommerce-rules', '弱覆盖'],
  [1, '消防安全轻量清单', 'fire-safety-lite', '生态真空'],
  [1, '密评入门', 'crypto-assessment-lite', '生态真空'],
  [2, '电子招投标平台操作', 'e-bidding-platform', '需接省平台+bidsmart'],
  [2, '评标维度拆解', 'bid-eval-dims', 'bidsmart弱'],
  [2, '国际RFP对照 Shipley', 'intl-rfp-shipley', 'rfp-responder'],
  [3, '电子发票全电票', 'e-invoice-cn', 'vivy invoice'],
  [3, '个税代扣代缴', 'iit-withholding', '弱/需自建'],
  [3, '出纳收付对账', 'cashier-reconcile', 'receiptor可改编'],
  [3, '汇算清缴流程', 'annual-cit-filing', 'vivy弱'],
  [3, '电税局操作指引', 'etax-bureau', '数据源组合'],
  [3, 'anth-xlsx组合做账', 'anth-xlsx-combo', '本仓已装'],
  [4, '实习生协议', 'intern-agreement', 'employment-legal'],
  [4, '劳动仲裁流程', 'labor-arbitration-flow', 'vivy labor-arbitration'],
  [4, '海外雇佣对照', 'overseas-hire', 'CFL US 标注非CN'],
  [5, '公司法2023修订要点', 'company-law-2023', 'zhou corporate'],
  [5, '数据出境评估', 'data-export', 'privacy-legal'],
  [5, '行政处罚应对', 'admin-penalty', 'regulatory'],
  [5, '软著申请流程', 'software-copyright', 'ip-legal'],
  [6, '高新认定税务影响', 'hnte-tax', 'vivy tax-preference'],
  [6, '区域税收优惠框架', 'regional-tax', '框架级观察'],
  [6, '转让定价/BEPS边界', 'beps-boundary', '仅风险边界声明'],
  [6, '股权架构税务影响框架', 'equity-tax-framework', 'huodebing/cit memo'],
  [7, '稳岗返还', 'stable-job-subsidy', '政策MCP+人社'],
  [7, '科技型中小企业', 'tech-sme', '工信/科技部'],
  [7, '技改专项资金', 'tech-upgrade-fund', '发改/工信'],
  [7, '免申即享模板', 'claim-without-apply', '省平台'],
  [7, '申报材料清单模板', 'subsidy-doc-checklist', '自建+MCP'],
];
for (const [cat, name, slug, note] of fillThemes) {
  add({
    name,
    slug: `gap-${slug}`,
    categories: [cat],
    url: 'search-hit://gap',
    jurisdiction: 'CN',
    type: 'gap-or-combo',
    desc: note,
    stars: 0,
    license: 'n/a',
    source_channel: 21,
    scores: score(4, 2, 2, 3, 3, 3),
    suggest: '数据源组合/自建',
    wave: 'wave1-gap',
  });
}

const provinces = [
  ['北京', 'https://www.beijing.gov.cn/', 'https://www.beijing.gov.cn/fuwu/qyfww/', '门户企业服务'],
  ['天津', 'https://www.tj.gov.cn/', 'https://www.tj.gov.cn/', '门户检索惠企'],
  ['河北', 'https://www.hebei.gov.cn/', 'https://www.hebei.gov.cn/', '门户检索惠企'],
  ['山西', 'https://www.shanxi.gov.cn/', 'https://www.shanxi.gov.cn/', '门户检索惠企'],
  ['内蒙古', 'https://www.nmg.gov.cn/', 'https://www.nmg.gov.cn/', '门户检索惠企'],
  ['辽宁', 'https://www.ln.gov.cn/', 'https://www.ln.gov.cn/', '门户检索惠企'],
  ['吉林', 'https://www.jl.gov.cn/', 'https://www.jl.gov.cn/', '门户检索惠企'],
  ['黑龙江', 'https://www.hlj.gov.cn/', 'https://www.hlj.gov.cn/', '门户检索惠企'],
  ['上海', 'https://www.shanghai.gov.cn/', 'https://www.shanghai.gov.cn/', '一网通办企业专区'],
  ['江苏', 'https://www.jiangsu.gov.cn/', 'https://www.jiangsu.gov.cn/', '苏服办企业'],
  ['浙江', 'https://www.zj.gov.cn/', 'https://www.zj.gov.cn/', '浙里办企业'],
  ['安徽', 'https://www.ah.gov.cn/', 'https://www.ah.gov.cn/', '门户检索惠企'],
  ['福建', 'https://www.fujian.gov.cn/', 'https://fgw.fujian.gov.cn/', '金服云/一站式申享报道'],
  ['江西', 'https://www.jiangxi.gov.cn/', 'https://www.jiangxi.gov.cn/', '门户检索惠企'],
  ['山东', 'https://www.shandong.gov.cn/', 'https://www.shandong.gov.cn/', '爱山东企业'],
  ['河南', 'https://www.henan.gov.cn/', 'https://www.henan.gov.cn/', '免申即享方案'],
  ['湖北', 'https://www.hubei.gov.cn/', 'http://www.hubei.gov.cn/zwgk/hbyw/hbywqb/202306/t20230602_4692800.shtml', '惠企政策直达快享(已核实报道)'],
  ['湖南', 'https://www.hunan.gov.cn/', 'https://www.hunan.gov.cn/', '政企通/湘易办'],
  ['广东', 'https://www.gd.gov.cn/', 'https://www.gd.gov.cn/', '粤商通'],
  ['广西', 'https://www.gxzf.gov.cn/', 'https://www.gxzf.gov.cn/', '门户检索惠企'],
  ['海南', 'https://www.hainan.gov.cn/', 'https://www.hainan.gov.cn/', '海易办'],
  ['重庆', 'https://www.cq.gov.cn/', 'https://www.cq.gov.cn/', '渝快办企业'],
  ['四川', 'https://www.sc.gov.cn/', 'https://www.sc.gov.cn/', '天府通办'],
  ['贵州', 'https://www.guizhou.gov.cn/', 'https://www.guizhou.gov.cn/', '门户检索惠企'],
  ['云南', 'https://www.yn.gov.cn/', 'https://www.yn.gov.cn/', '门户检索惠企'],
  ['西藏', 'https://www.xizang.gov.cn/', 'https://www.xizang.gov.cn/', '门户检索惠企'],
  ['陕西', 'https://www.shaanxi.gov.cn/', 'https://www.shaanxi.gov.cn/', '秦务员'],
  ['甘肃', 'https://www.gansu.gov.cn/', 'https://www.gansu.gov.cn/', '门户检索惠企'],
  ['青海', 'https://www.qinghai.gov.cn/', 'https://www.qinghai.gov.cn/', '门户检索惠企'],
  ['宁夏', 'https://www.nx.gov.cn/', 'https://www.nx.gov.cn/', '门户检索惠企'],
  ['新疆', 'https://www.xinjiang.gov.cn/', 'https://www.xinjiang.gov.cn/', '门户检索惠企'],
];

const citySamples = [
  { circle: '京津冀', city: '北京市', cityUrl: 'https://www.beijing.gov.cn/', district: '海淀区', districtUrl: 'https://www.bjhd.gov.cn/', note: '中关村/高企服务' },
  { circle: '京津冀', city: '天津市', cityUrl: 'https://www.tj.gov.cn/', district: '滨海新区', districtUrl: 'https://www.tjbh.gov.cn/', note: '自贸区惠企' },
  { circle: '长三角', city: '上海市', cityUrl: 'https://www.shanghai.gov.cn/', district: '浦东新区', districtUrl: 'https://www.pudong.gov.cn/', note: '一网通办' },
  { circle: '长三角', city: '杭州市', cityUrl: 'https://www.hangzhou.gov.cn/', district: '余杭区', districtUrl: 'https://www.yuhang.gov.cn/', note: '浙里办' },
  { circle: '长三角', city: '苏州市', cityUrl: 'https://www.suzhou.gov.cn/', district: '工业园区', districtUrl: 'https://www.sipac.gov.cn/', note: '园区扶持' },
  { circle: '珠三角', city: '广州市', cityUrl: 'https://www.gz.gov.cn/', district: '天河区', districtUrl: 'https://www.thnet.gov.cn/', note: '粤商通' },
  { circle: '珠三角', city: '深圳市', cityUrl: 'https://www.sz.gov.cn/', district: '南山区', districtUrl: 'https://www.szns.gov.cn/', note: '高企/专精特新' },
  { circle: '成渝', city: '成都市', cityUrl: 'https://www.chengdu.gov.cn/', district: '高新区', districtUrl: 'https://www.cdht.gov.cn/', note: '天府通办' },
  { circle: '成渝', city: '重庆市', cityUrl: 'https://www.cq.gov.cn/', district: '渝北区', districtUrl: 'https://www.ybq.gov.cn/', note: '渝快办' },
  { circle: '中部', city: '武汉市', cityUrl: 'https://www.wuhan.gov.cn/', district: '东湖高新区', districtUrl: 'https://www.wehdz.gov.cn/', note: '光谷惠企' },
  { circle: '中部', city: '郑州市', cityUrl: 'https://www.zhengzhou.gov.cn/', district: '金水区', districtUrl: 'https://www.jinshui.gov.cn/', note: '免申即享' },
  { circle: '东北', city: '沈阳市', cityUrl: 'https://www.shenyang.gov.cn/', district: '浑南区', districtUrl: 'https://www.hunnan.gov.cn/', note: '门户惠企' },
  { circle: '东北', city: '大连市', cityUrl: 'https://www.dl.gov.cn/', district: '高新园区', districtUrl: 'https://www.dlhitech.gov.cn/', note: '园区扶持' },
];

const out = {
  meta: {
    title: '大陆SME合规 Skills/MCP/数据源候选池',
    capturedAt: new Date().toISOString(),
    plan: '大陆合规skills调研_a8d337e9',
    disclaimer: '本文件仅供选型调研，不构成法律/税务/会计执业意见；禁止用于逃税或规避监管操作指引。',
    counts: {
      channels: channels.length,
      candidates: candidates.length,
      provinces: provinces.length,
      citySamples: citySamples.length,
    },
    scoreLegend: { L: '本地化', T: '时效', P: '可落盘', I: '许可', D: '依赖(高分=低依赖)', G: '增益' },
    installThreshold: 'total>=22 && L>=4 && I>=3',
  },
  channels,
  categories: cats,
  candidates,
  provinces: provinces.map(([name, portal, huiqi, note]) => ({
    name,
    portal,
    huiqiUrl: huiqi,
    note,
    verified: /已核实/.test(note),
  })),
  cityDistrictSamples: citySamples,
};

fs.writeFileSync('docs/cn-sme-compliance-candidate-pool-20260802.json', JSON.stringify(out, null, 2));
console.log('candidates', candidates.length);
console.log('channels', channels.length, 'all done?', channels.every((c) => c.status === 'done'));
for (let i = 1; i <= 7; i++) {
  const n = candidates.filter((c) => (c.categories || []).includes(i) && c.type !== 'installed').length;
  console.log('cat', i, n);
}
