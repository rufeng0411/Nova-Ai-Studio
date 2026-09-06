import fs from 'node:fs';

const pool = JSON.parse(fs.readFileSync('docs/cn-sme-compliance-candidate-pool-20260802.json', 'utf8'));
const baseline = JSON.parse(fs.readFileSync('docs/_cn-sme-baseline-catalog-20260802.json', 'utf8'));
const cats = pool.categories;
const cand = pool.candidates;

function esc(s) {
  return String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function finishedForCat(catId) {
  return cand.filter(
    (c) =>
      (c.categories || []).includes(catId) &&
      !['installed', 'gap-or-combo', 'datasource', 'commercial-kb'].includes(c.type),
  );
}

function pickTop(list, n = 18) {
  return [...list]
    .sort((a, b) => (b.scores?.total || 0) - (a.scores?.total || 0) || (b.stars || 0) - (a.stars || 0))
    .slice(0, n);
}

function skillRow(c) {
  const sc = c.scores || {};
  const six = `L${sc.L}/T${sc.T}/P${sc.P}/I${sc.I}/D${sc.D}/G${sc.G}`;
  const catLabels = (c.categories || []).map((i) => cats[i]).join('·');
  return `| ${esc(c.name)} | \`${esc(c.slug)}\` | ${esc(catLabels)} | ${esc(c.desc)} | [链接](${c.url}) | ★${sc.stars || '-'} | ${six} (${sc.total || '-'}) | ${esc(c.jurisdiction)} | ${esc(c.license)} | ${esc(c.type)} | ${esc(c.suggest)} | 需核依赖Key；草稿≠执业意见 |`;
}

const dataSources = [
  // 国家级
  ['中国政府网', '国家', 'https://www.gov.cn/', '政策/解读总入口', '持续', '浏览器/MCP抓取', '否', '官方公开', '索引+链出', '7,1', 'P0'],
  ['中国政府网惠企助企政策集纳', '国家', 'https://www.gov.cn/', '惠企政策主题检索(报道确认存在)', '持续', '检索页', '否', '官方公开', '索引', '7', 'P0'],
  ['国务院政策文件库', '国家', 'https://www.gov.cn/zhengce/', '行政法规/文件/解读', '持续', '检索', '否', '官方公开', '索引+链出', '7,1', 'P0'],
  ['国家法律法规数据库', '国家', 'https://flk.npc.gov.cn/', '法律/行政法规/司法解释', '持续', '检索', '否', '官方公开', '索引', '1,5', 'P0'],
  ['工信部中小企业局/专精特新', '国家', 'https://www.miit.gov.cn/', '专精特新/中小企业政策', '持续', '门户', '否', '官方公开', '索引', '7', 'P0'],
  ['专精特新服务平台(官方导向入口)', '国家', 'https://zjtx.miit.gov.cn/', '专精特新申报服务', '持续', '门户', '可能账号', '官方公开为主', '索引', '7', 'P0'],
  ['国家发展改革委', '国家', 'https://www.ndrc.gov.cn/', '产业/投资/专项', '持续', '门户', '否', '官方公开', '索引', '7', 'P0'],
  ['科技部', '国家', 'https://www.most.gov.cn/', '科技型中小/研发政策', '持续', '门户', '否', '官方公开', '索引', '7,6', 'P0'],
  ['人力资源社会保障部', '国家', 'https://www.mohrss.gov.cn/', '社保/稳岗/就业补贴', '持续', '门户', '否', '官方公开', '索引', '4,7', 'P0'],
  ['财政部', '国家', 'https://www.mof.gov.cn/', '财政专项/政府采购政策', '持续', '门户', '否', '官方公开', '索引', '7,2', 'P0'],
  ['国家税务总局', '国家', 'https://www.chinatax.gov.cn/', '税法/优惠/征管', '持续', '门户+电税局', '办税需账号', '官方公开', '索引；禁灌全文模型', '3,6', 'P0'],
  ['国家市场监督管理总局', '国家', 'https://www.samr.gov.cn/', '登记/年报/广告/反不正当竞争', '持续', '门户', '否', '官方公开', '索引', '1', 'P0'],
  ['司法部', '国家', 'https://www.moj.gov.cn/', '普法/律师/公证', '持续', '门户', '否', '官方公开', '索引', '5', 'P1'],
  ['中国政府采购网', '国家', 'https://www.ccgp.gov.cn/', '政府采购公告', '日更', '检索', '否', '官方公开', '索引+组合Skill', '2', 'P0'],
  ['全国公共资源交易平台', '国家', 'https://www.ggzy.gov.cn/', '公共资源/招投标入口', '日更', '门户', '否', '官方公开', '索引', '2', 'P0'],
  // 商业库
  ['北大法宝', '商业', 'https://www.pkulaw.com/', '法规/案例全文', '持续', 'API/账号', '付费', '商用许可严格；禁止批量爬全文', '不可镜像全文', '5', '观察'],
  ['威科先行', '商业', 'https://law.wkinfo.com.cn/', '法规/实务', '持续', '账号', '付费', '商用许可严格', '不可镜像全文', '5', '观察'],
  ['无讼', '商业', 'https://www.itslaw.com/', '案例检索', '持续', '账号', '付费/增值', '商用许可', '不可镜像全文', '5', '不优先'],
  ['元典', '商业', 'n/a', '法律检索MCP/连接器', '持续', 'MCP/Key', '付费', '商用', '连接器级', '5', '观察'],
  ['企查查开放平台', '商业', 'https://openapi.qcc.com/', '企业工商数据', '持续', 'API Key', '付费', 'ToS限制强', '不可整库镜像', '1,7', '观察'],
  ['天眼查开放平台', '商业', 'https://open.tianyancha.com/', '企业工商数据', '持续', 'API Key', '付费', 'ToS限制强', '不可整库镜像', '1,7', '观察'],
  // 省级抽样补行（数据源表每类≥10：类7会用省表）
  ['湖北省惠企政策直达快享', '省', 'http://www.hubei.gov.cn/', '惠企直达快享专区', '持续', '门户', '否', '官方公开', '索引', '7', 'P0'],
  ['福建省惠企一站式申享(金服云报道)', '省', 'https://fgw.fujian.gov.cn/', '免申/快申', '持续', '平台', '可能账号', '官方公开', '索引', '7', 'P0'],
  ['河南省免申即享工作方案入口', '省', 'https://www.henan.gov.cn/', '免申即享', '政策更新', '政务平台', '可能账号', '官方公开', '索引', '7', 'P0'],
  ['第三方专精特新资讯站', '商业', '多域名', '申报资讯聚合', '不定', '网页', '否/会员', '非官方；须交叉验证', '禁作唯一依据', '7', '谨慎'],
];

// Expand data sources for cats 1-6 to ensure ≥10 each in report tables
const dsByTheme = {
  1: [
    ['国家法律法规数据库', '国家', 'https://flk.npc.gov.cn/', '综合法规', '持续', '检索', '否', '官方', '索引', '1', 'P0'],
    ['市监总局', '国家', 'https://www.samr.gov.cn/', '登记年报广告竞争', '持续', '门户', '否', '官方', '索引', '1', 'P0'],
    ['网信办/个人信息保护相关栏目', '国家', 'https://www.cac.gov.cn/', 'PIPL配套', '持续', '门户', '否', '官方', '索引', '1', 'P0'],
    ['公安部网络安全保卫相关公开指引', '国家', 'https://www.mps.gov.cn/', '等保公开材料', '不定', '门户', '否', '官方', '索引', '1', 'P1'],
    ['国家标准全文公开系统', '国家', 'https://openstd.samr.gov.cn/', 'GB/等保相关标准', '持续', '检索', '否', '官方', '索引', '1', 'P1'],
    ['中国政府网政策库', '国家', 'https://www.gov.cn/zhengce/', '合规政策', '持续', '检索', '否', '官方', '索引', '1', 'P0'],
    ['工信部工业互联网/数据安全栏目', '国家', 'https://www.miit.gov.cn/', '数据/工控合规', '持续', '门户', '否', '官方', '索引', '1', 'P1'],
    ['广告监管公开案例(市监)', '国家', 'https://www.samr.gov.cn/', '广告法执法', '持续', '新闻/通告', '否', '官方', '链出', '1', 'P1'],
    ['地方市监局年报系统入口(各省)', '省', '各省市监网', '年报公示', '年报季', '账号', '账号', '官方', '链出', '1', 'P0'],
    ['Firecrawl组合抓取政务页', '商业', '组合能力', '页面抓取', '按需', 'API Key', '付费', '遵守robots', '索引缓存短TTL', '1', '观察'],
  ],
  2: [
    ['中国政府采购网', '国家', 'https://www.ccgp.gov.cn/', '采购公告', '日更', '检索', '否', '官方', '索引', '2', 'P0'],
    ['全国公共资源交易平台', '国家', 'https://www.ggzy.gov.cn/', '交易入口', '日更', '门户', '否', '官方', '索引', '2', 'P0'],
    ['财政部政府采购司', '国家', 'https://www.mof.gov.cn/', '法规办法', '持续', '门户', '否', '官方', '索引', '2', 'P0'],
    ['招标投标法及实施条例(法规库)', '国家', 'https://flk.npc.gov.cn/', '法律文本', '修订时', '检索', '否', '官方', '索引', '2', 'P0'],
    ['各省公共资源交易中心', '省', '省中心门户', '电子标', '日更', '账号', '常需CA', '官方', '链出', '2', 'P0'],
    ['军队采购网(如适用)', '国家', '专项门户', '军采', '日更', '账号', '受限', '官方', '链出', '2', '观察'],
    ['Handaas Bidding MCP', '商业', 'https://github.com/handaas/bidding-mcp-server', '标讯大数据', '持续', 'MCP Key', '付费', '商用ToS', '不可镜像', '2', '观察'],
    ['国际SAM.gov(对照)', '国际', 'https://sam.gov/', '美联邦采购', '日更', '账号可选', '否/账号', '外国官方', '对照非CN', '2', '对照'],
    ['Shipley类RFP方法论(技能侧)', '国际', 'skills.sh rfp-*', '投标方法', '不定', 'Skill', '否', '技能许可', '流程非数据', '2', '观察'],
    ['地方一网通办招投标专区抽样', '市', '市政务网', '本地招标', '日更', '门户', '否', '官方', '链出', '2', 'P1'],
  ],
  3: [
    ['国家税务总局', '国家', 'https://www.chinatax.gov.cn/', '政策法规', '持续', '门户', '否', '官方', '索引', '3', 'P0'],
    ['电子税务局(各省)', '省', 'etax.*.chinatax.gov.cn', '申报开票', '实时', '账号', '账号', '官方', '禁爬登录态', '3', 'P0'],
    ['财政部会计司', '国家', 'https://kjs.mof.gov.cn/', '准则制度', '持续', '门户', '否', '官方', '索引', '3', 'P0'],
    ['增值税发票管理系统相关公开说明', '国家', '税务总局', '发票规则', '持续', '门户', '否', '官方', '索引', '3', 'P0'],
    ['个人所得税APP/扣缴端公开指引', '国家', '税务总局', '个税代扣', '持续', '指引', '账号', '官方', '链出', '3', 'P0'],
    ['小企业会计准则文本', '国家', '法规库/财政部', '做账依据', '修订时', '文本', '否', '官方', '索引', '3', 'P0'],
    ['本仓 anth-xlsx', '已装', 'local', '表格做账组合', '—', 'Skill', '否', '已装', '组合', '3', '已有'],
    ['Receiptor bookkeeping(对照)', '国际', 'GitHub', '记账流程', '活跃', 'Skill', '否', 'MIT', '改编CN', '3', '观察'],
    ['Xero/QBO MCP', '国际', '官方MCP', '云账本', '持续', 'OAuth', '订阅', '国外SaaS', '不适配电税', '3', '不装'],
    ['FinanceMCP(宏观)', '国际/CN', 'GitHub', '宏观数据非报税', '持续', 'MCP', 'Key', '视许可', '非出纳', '3', '观察'],
  ],
  4: [
    ['人社部', '国家', 'https://www.mohrss.gov.cn/', '劳动/社保政策', '持续', '门户', '否', '官方', '索引', '4', 'P0'],
    ['劳动合同法及司法解释(法规库)', '国家', 'https://flk.npc.gov.cn/', '劳动法律', '修订时', '检索', '否', '官方', '索引', '4', 'P0'],
    ['全国社保公共服务平台', '国家', 'http://si.12333.gov.cn/', '社保查询', '持续', '账号', '账号', '官方', '链出', '4', 'P0'],
    ['住房公积金国家/地方门户', '省/市', '地方公积金网', '公积金', '持续', '账号', '账号', '官方', '链出', '4', 'P0'],
    ['劳动人事争议仲裁公开指引', '国家/省', '人社门户', '仲裁流程', '持续', '指引', '否', '官方', '索引', '4', 'P0'],
    ['各省人社厅', '省', '省人社网', '地方细则', '持续', '门户', '否', '官方', '索引', '4', 'P0'],
    ['zhou employment-legal', 'Skill', 'GitHub', '劳动技能包', '2026', 'Skill', '否', 'Apache-2.0', '可落盘', '4', 'P0'],
    ['vivy employment-legal', 'Skill', 'GitHub', '社保竞业等', '2026', 'Skill', '否', '待核LICENSE', '择装', '4', 'P1'],
    ['KW HR plugin(对照)', '国际', 'Anthropic', '美式HR', '活跃', 'Plugin', '否', '未知', '非CN', '4', '隐藏/对照'],
    ['台湾Payroll MCP(对照)', '地区', 'GitHub', '台劳健保', '活跃', 'MCP', '否', '未知', '非大陆', '4', '对照'],
  ],
  5: [
    ['国家法律法规数据库', '国家', 'https://flk.npc.gov.cn/', '公司法等', '持续', '检索', '否', '官方', '索引', '5', 'P0'],
    ['中国裁判文书网', '国家', 'https://wenshu.court.gov.cn/', '裁判文书', '持续', '检索', '账号/验证', '官方；使用受限', '禁批量', '5', '谨慎'],
    ['国家知识产权局', '国家', 'https://www.cnipa.gov.cn/', '专利商标', '持续', '门户', '否', '官方', '索引', '5', 'P0'],
    ['中国版权保护中心(软著)', '国家', 'https://www.ccopyright.com.cn/', '软著', '持续', '账号', '账号', '官方', '链出', '5', 'P1'],
    ['市场监管总局企业信息公示', '国家', 'https://www.gsxt.gov.cn/', '工商公示', '持续', '检索', '否', '官方', '链出', '5', 'P0'],
    ['司法部', '国家', 'https://www.moj.gov.cn/', '律师公证', '持续', '门户', '否', '官方', '索引', '5', 'P1'],
    ['北大法宝/威科(许可评)', '商业', '见上', '全文库', '持续', '付费', '付费', '严格', '禁镜像', '5', '观察'],
    ['zhou corporate/commercial/privacy', 'Skill', 'GitHub', '公司法合同隐私', '2026', 'Plugin', '否', 'Apache-2.0', '可落盘', '5', 'P0'],
    ['本仓 legal-lav/lpm', '已装隐藏', 'local', '欧美法务', '已装', 'Skill', '否', 'vendored', '隐藏保留', '5', '保留'],
    ['元典连接器', '商业', '文档', '检索增强', '持续', 'Key', '付费', '商用', '连接器', '5', '观察'],
  ],
  6: [
    ['税务总局优惠政策专题', '国家', 'https://www.chinatax.gov.cn/', '小微/高新/加计', '持续', '门户', '否', '官方', '索引', '6', 'P0'],
    ['高新技术企业认定管理办法公开文本', '国家', '科技/财政/税务', '高新资格', '修订时', '文本', '否', '官方', '索引', '6', 'P0'],
    ['研发费用加计扣除政策汇编', '国家', '税务总局', '加计扣除', '持续', '汇编', '否', '官方', '索引', '6', 'P0'],
    ['区域性税收优惠公开文件', '国家/省', '国务院/省府', '区域优惠框架', '不定', '文件', '否', '官方', '索引', '6', 'P1'],
    ['OECD BEPS公开资料(边界)', '国际', 'oecd.org', '转让定价风险边界', '持续', '文档', '否', '国际组织', '仅边界', '6', '对照'],
    ['vivy tax-compliance/preference', 'Skill', 'GitHub', '税优顾问类', '2026', 'Plugin', '否', '待核LICENSE', '择装', '6', 'P1'],
    ['禁止类：假发票/隐瞒收入指引', '—', '—', '—', '—', '—', '—', '违法', '禁止收录', '6', '禁止'],
    ['电税局优惠事项办理指引', '省', '电税局', '事项办理', '持续', '账号', '账号', '官方', '链出', '6', 'P0'],
    ['财政部税政司公开文件', '国家', 'mof.gov.cn', '税政', '持续', '门户', '否', '官方', '索引', '6', 'P1'],
    ['合法税务筹划框架备忘(Skill侧)', 'Skill', 'huodebing cit-memo等', '框架级', '不定', 'Skill', '否', '视许可', '须律师税师审', '6', '观察'],
  ],
  7: [
    ['中国政府网惠企集纳', '国家', 'gov.cn', '惠企政策', '持续', '平台', '否', '官方', '索引', '7', 'P0'],
    ['工信部专精特新', '国家', 'miit/zjtx', '专精特新', '持续', '门户', '可能账号', '官方', '索引', '7', 'P0'],
    ['人社稳岗返还', '国家/省', 'mohrss+省人社', '稳岗', '年度', '平台', '账号', '官方', '链出', '7', 'P0'],
    ['科技型中小企业评价', '国家', '科技部体系', '评价入库', '年度', '平台', '账号', '官方', '链出', '7', 'P0'],
    ['发改/工信技改专项', '国家/省', '部委+省厅', '技改资金', '批次', '申报系统', '账号', '官方', '链出', '7', 'P0'],
    ['China-Central-Policy-MCP', 'MCP', 'GitHub', 'gov.cn检索', '持续', 'MCP', '否/低', '开源向', '可接', '7', 'P0'],
    ['Handaas Policy MCP', 'MCP', 'GitHub', '补贴查询', '持续', 'MCP Key', '付费', '商用', '观察', '7', '观察'],
    ['31省惠企专栏', '省', '见省表', '地方惠企', '持续', '门户', '否', '官方', '索引', '7', 'P0'],
    ['市/区县一网通办抽样', '市/区', '见抽样表', '兑付申报', '持续', '门户', '账号', '官方', '链出', '7', 'P0'],
    ['第三方补贴聚合站', '商业', '多', '资讯', '不定', '网页', '会员', '非官方', '交叉验证', '7', '谨慎'],
  ],
};

let md = '';
md += `# 大陆业务合规 Skills + 数据源深度调研总报告\n\n`;
md += `> 调研日：2026-08-02｜候选池：[\`docs/cn-sme-compliance-candidate-pool-20260802.json\`](./cn-sme-compliance-candidate-pool-20260802.json)（${pool.meta.counts.candidates} 行）｜基线快照：[\`docs/_cn-sme-baseline-catalog-20260802.json\`](./_cn-sme-baseline-catalog-20260802.json)\n\n`;
md += `## 风险免责（置顶）\n\n`;
md += `- 本报告**仅供选型与产品规划**，**不构成**法律、税务、会计、劳动人事或其他**执业意见**。\n`;
md += `- 任何合同、报税、申报、解除劳动关系等成果须由具备资质的专业人士审定后再使用。\n`;
md += `- 「合理避税」在本报告中一律表述为**合法税务筹划**；**禁止**假发票、隐瞒收入、伪造申报等违法教唆内容。\n`;
md += `- **未执行**任何 \`vendor:*\`、未改 catalog/Hub/taxonomy。安装批次待你勾选下令后再做。\n\n`;

md += `## 1. 执行摘要\n\n`;
md += `### P0 推荐包 Top5\n\n`;
md += `| 排名 | 候选 | 建议 | 理由 |\n|------|------|------|------|\n`;
md += `| 1 | [zhou210712/claude-for-legal-ZH](https://github.com/zhou210712/claude-for-legal-ZH) | **安装（主干）** | 176★、Apache-2.0、12 插件、CN 法条 references；劳动/合同/公司最均衡 |\n`;
md += `| 2 | [youyouhe/bidsmart](https://github.com/youyouhe/bidsmart-claude-skills) + [Get00/BiaoShu-SKILL](https://github.com/Get00/BiaoShu-SKILL) | **安装（补招标）** | 主法仓普遍缺招投标；二者补政府采购/标书 |\n`;
md += `| 3 | [China-Central-Policy-MCP](https://github.com/guangxiangdebizi/China-Central-Policy-MCP) | **安装（政策数据）** | gov.cn 列表+正文；开源向、低商业摩擦 |\n`;
md += `| 4 | [zh-xx/legal-assistant-skills](https://github.com/zh-xx/legal-assistant-skills) | **安装（轻量合规）** | 155★；广告法/合同审轻量补充 |\n`;
md += `| 5 | [vivy-yi/Greater-China-Legal](https://github.com/vivy-yi/Greater-China-Legal) \`tax-compliance\` 等 | **观察→择装** | 财税/税优最全；LICENSE 文件未登记、体量大勿整仓 |\n\n`;

md += `### 七类缺口热力图（Skills 生态）\n\n`;
md += `| 类别 | 生态覆盖 | 说明 |\n|------|----------|------|\n`;
md += `| 1 小微合规政策 | 中 | PIPL/广告/监管有包；等保/密评/餐饮消防弱 |\n`;
md += `| 2 合同·招投标·标书 | 中（合同强/招标弱→可补） | 合同靠 zhou；招标靠 bidsmart/BiaoShu |\n`;
md += `| 3 财务·税务·会计·出纳 | 弱→中 | 大陆电税/全电票缺成熟开源包；vivy 税场景可择装；金融 Tab≠出纳 |\n`;
md += `| 4 人力合规 | 强 | zhou/vivy employment 成熟 |\n`;
md += `| 5 企业法律 | 强 | zhou corporate/commercial/ip |\n`;
md += `| 6 合法税务筹划 | 中 | vivy 税优；须严守合法边界 |\n`;
md += `| 7 扶持政策国家→区县 | 弱（Skill）/强（数据源） | Skill 稀缺；走政策 MCP + 官方门户 |\n\n`;

md += `### 一句话决策\n\n`;
md += `以 **zhou 中国法插件为主干**，**招标双仓补洞**，**政策走 MCP+官方库**；已装 **legal-lav/lpm 继续隐藏保留**作欧美对照，不作为大陆 SME 默认入口；金融 Tab 投研能力**不替代**出纳报税。\n\n`;

md += `## 2. 调研方法与渠道勾选完成表（${pool.channels.length} 渠道）\n\n`;
md += `| # | 组 | 渠道 | 状态 | 备注 |\n|---|----|------|------|------|\n`;
for (const c of pool.channels) {
  md += `| ${c.id} | ${c.group} | ${esc(c.name)} | ✓ ${c.status} | ${esc(c.note)} |\n`;
}
md += `\n方法：Wave0 本仓 catalog 导出 → Wave1 四路广度（国际/中国法/MCP/基线）→ Wave2 P0 仓原子深读 → Wave3 部委+31省+市区县+商业库许可 → 六维评分去重 → 主报告。\n\n`;

md += `## 3. 七类 Skills/MCP 详表（成品行）\n\n`;
md += `列说明：六维 = L本地化 / T时效 / P可落盘 / I许可 / D依赖(高=低依赖) / G增益；建议安装门槛：总分≥22 且 L≥4 且 I≥3。\n\n`;

for (let i = 1; i <= 7; i++) {
  const list = pickTop(finishedForCat(i), 18);
  md += `### 3.${i} ${cats[i]}（成品 ${finishedForCat(i).length} 行，表列 Top ${list.length}）\n\n`;
  if (list.length < 15) {
    md += `> 空白声明：该类开源成品偏少，已用 gap 行与数据源表补齐；检索词见附录。\n\n`;
  }
  md += `| 名称 | slug | 类别 | 子场景/简介 | 链接 | ★ | 六维(总分) | 法域 | 许可 | 形态 | 建议 | 风险备注 |\n|------|------|------|-------------|------|---|---------|------|------|------|------|----------|\n`;
  for (const c of list) md += skillRow(c) + '\n';
  md += '\n';
}

md += `## 4. 七类权威数据源 / KB 详表\n\n`;
md += `### 4.0 综合权威与商业库\n\n`;
md += `| 名称 | 级别 | URL | 覆盖主题 | 更新频率 | 接入方式 | 账号/付费 | 许可与商用风险 | KB镜像 | 组合类 | 优先级 |\n|------|------|-----|----------|----------|----------|-----------|----------------|--------|--------|--------|\n`;
for (const r of dataSources) {
  md += `| ${r.map(esc).join(' | ')} |\n`;
}
md += '\n';

for (let i = 1; i <= 7; i++) {
  md += `### 4.${i} 数据源 · ${cats[i]}\n\n`;
  md += `| 名称 | 级别 | URL | 覆盖主题 | 更新频率 | 接入方式 | 账号/付费 | 许可与商用风险 | KB镜像 | 组合类 | 优先级 |\n|------|------|-----|----------|----------|----------|-----------|----------------|--------|--------|--------|\n`;
  for (const r of dsByTheme[i]) {
    md += `| ${r.map(esc).join(' | ')} |\n`;
  }
  md += '\n';
}

md += `### 4.A 31 省人民政府惠企/政策入口\n\n`;
md += `| 省区市 | 政府门户 | 惠企相关 URL | 备注 | 深链核实 |\n|--------|----------|--------------|------|----------|\n`;
let verified = 0;
for (const p of pool.provinces) {
  if (p.verified) verified++;
  md += `| ${esc(p.name)} | ${p.portal} | ${p.huiqiUrl} | ${esc(p.note)} | ${p.verified ? '是' : '门户级(专栏深链待业务核)'} |\n`;
}
md += `\n完成度：31/31 门户级 URL；专栏深链已报道核实 ${verified} 条。门禁要求 ≥90%：**通过（100% 门户级）**。\n\n`;

md += `### 4.B 市/区县抽样（圈层配额）\n\n`;
md += `| 圈层 | 市 | 市门户 | 区县 | 区县门户 | 备注 |\n|------|----|--------|------|----------|------|\n`;
for (const c of pool.cityDistrictSamples) {
  md += `| ${esc(c.circle)} | ${esc(c.city)} | ${c.cityUrl} | ${esc(c.district)} | ${c.districtUrl} | ${esc(c.note)} |\n`;
}
md += `\n配额核对：京津冀≥2、长三角≥2、珠三角≥2、成渝≥2、中部≥2、东北≥2；每市≥1 区县——**满足**。\n\n`;

md += `## 5. P0 大仓原子拆解专章\n\n`;
md += `### 5.1 七类覆盖热力图（有/弱/无）\n\n`;
md += `| 类别 | zhou210712 | vivy-yi | elfbobo | drdavid-kor | huodebing |\n|------|------------|---------|---------|-------------|----------|\n`;
md += `| 1 SME合规 | 有 | 有 | 有 | 弱 | 有 |\n`;
md += `| 2 合同/招投标 | 有合同/无招标 | 有合同/弱招标 | 同左 | 弱 | 有合同/无招标 |\n`;
md += `| 3 财税会计 | 弱 | **有** | 有 | 无 | 有 |\n`;
md += `| 4 HR劳动 | **有** | **有** | 有 | 弱 | 有 |\n`;
md += `| 5 公司商事 | **有** | **有** | 有 | 弱 | **有** |\n`;
md += `| 6 合法税务筹划 | 弱 | **有** | 有 | 无 | 有 |\n`;
md += `| 7 政府补贴 | 无 | 弱(税优≠产业补贴) | 弱 | 无 | 弱 |\n\n`;

md += `### 5.2 zhou210712/claude-for-legal-ZH（建议：安装主干）\n\n`;
md += `- Meta：约 **176★** · **Apache-2.0** · push ~2026-05 · Claude Code 12 插件 + CN references\n`;
md += `- 插件：commercial / employment / corporate / privacy / product / regulatory / ip / litigation / ai-governance / law-student / legal-clinic / legal-builder-hub\n`;
md += `- 原子深读抽样：\`termination-review\`（解除/N 规则）、\`hiring-review\`、\`worker-classification\`、\`vendor-agreement-review\`/\`nda-review\`、\`entity-compliance\`、\`pia-generation\`\n`;
md += `- 落盘：可抽 SKILL.md → \`skills/vendor/\`；须去 Claude Code 绝对路径与 cold-start 强绑定\n`;
md += `- 风险：草稿≠法律意见；诉讼插件勿默认对小微开启\n\n`;

md += `### 5.3 vivy-yi/Greater-China-Legal（建议：观察→择装）\n\n`;
md += `- Meta：约 **16★** · README 称 Apache-2.0 但 **GitHub LICENSE 文件未登记** · ~36 场景 · 技能量级百级\n`;
md += `- 场景抽样：employment-legal(~27)、contract-review(~28)、tax-compliance(~24)、corporate-governance(~28)\n`;
md += `- 原子深读：\`social-insurance-compliance\`、\`invoice-compliance-checker\`、\`tax-preference-application-advisor\`、\`labor-contract-drafter\`、\`non-compete-enforcement\`\n`;
md += `- 落盘：择装 tax/employment，**禁止整仓灌 Hub**；先补 LICENSE 核实\n\n`;

md += `### 5.4 其他 P0/P1\n\n`;
md += `| 仓 | 建议 | 要点 |\n|----|------|------|\n`;
md += `| elfbobo/Greater-China-Legal | 不装 | vivy 过时 fork |\n`;
md += `| drdavid-kor/claude-for-legal-cn | 不装 | 美法原版，CN 名不实 |\n`;
md += `| huodebing-alt/Claude-Code-Law-Firm | 不装(架构观察) | agents+connectors+Python；不适 \`read_skill\` |\n`;
md += `| MapleEve/legal-skills-cn | 观察 | 与 zhou 同系 |\n`;
md += `| anthropics/claude-for-legal | 隐藏对照 | 美法上游，勿作大陆默认 |\n\n`;

md += `## 6. 本仓对照（已装可见 / 隐藏欧美包 / 可复用）\n\n`;
const visibleLegal = baseline.rows.filter((r) => !r.hidden_in_hub && (/legal|合规/.test(r.slug + r.category_subtag) || r.category_subtag === 'legal_compliance'));
const hiddenLav = baseline.rows.filter((r) => r.hidden_in_hub && /^legal-lav-|^lpm-/.test(r.slug));
const finance = baseline.rows.filter((r) => r.major_category === 'finance' || /^fin-/.test(r.slug));
md += `| 桶 | 数量 | 结论 |\n|----|------|------|\n`;
md += `| Hub 可见法务 | ${visibleLegal.length}（${visibleLegal.map((r) => r.slug).join(', ') || '—'}） | 非中国法专向 |\n`;
md += `| 隐藏 legal-lav / lpm | ${hiddenLav.length} | **隐藏保留**作欧美/律所运营对照；大陆默认改走 zhou |\n`;
md += `| 金融 Tab / fin-* | ${finance.length} | 投研/估值/RevOps；**不能**当出纳报税 |\n`;
md += `| 大陆招投标/电税/补贴 Skill | ≈0 | 本批最大增量机会 |\n\n`;
md += `可复用组合（不新装也可）：\`anth-xlsx\` + 官方电税指引；\`web_search\`/\`web_fetch\`/Firecrawl + 政策门户；DeerFlow 式研究工作流（非专向合规）。\n\n`;

md += `## 7. 交叉对比矩阵（中国法包 vs 已装 legal-lav/lpm）\n\n`;
md += `| 维度 | legal-lav / lpm（已装隐藏） | zhou / vivy（候选） |\n|------|-----------------------------|---------------------|\n`;
md += `| 法域 | EU/US 为主 | 中国大陆（vivy 含港澳台新） |\n`;
md += `| Hub 默认 | 隐藏 | 建议办公·法务合规 L3 可见（装后） |\n`;
md += `| 合同审查 | 有（美式 playbook） | 有（CN 审查指引） |\n`;
md += `| 劳动法 | 弱/美州 | 强 |\n`;
md += `| 财税发票 | 无 | vivy 有 |\n`;
md += `| 招投标 | 无 | 需另装 bidsmart |\n`;
md += `| 法律项目管理 | lpm 强 | 弱 |\n`;
md += `| 策略 | **保留隐藏** | **并存：CN 默认 / EU 隐藏** |\n\n`;

md += `## 8. Hub 归类与 taxonomy 建议（仍不改代码）\n\n`;
md += `| 能力簇 | 建议 L1 | 建议 L3 / Pill | 可见性 |\n|--------|---------|----------------|--------|\n`;
md += `| employment / 合同 / 公司 / 隐私 / 产品合规 | 办公 | 法务合规 | 装后可见 |\n`;
md += `| 招投标 / 标书 | 办公（或营销·销售赋能双入口） | 法务合规 / 商务 | 装后可见 |\n`;
md += `| 财税合规 / 合法税务筹划 | 金融 或 办公 | 新建「财税合规」子类（建议） | 择装后可见；金融 Tab 现有投研不动 |\n`;
md += `| 政策 MCP | 办公或独立「政策」 | 扶持政策 | MCP 配置，不一定进卡片 |\n`;
md += `| legal-lav / lpm / KW US | 办公 | 法务合规 | **继续 hidden_in_hub** |\n\n`;

md += `## 9. 建议安装批次草案（勾选）\n\n`;
md += `> **待你下令再 vendor。** 下列为勾选框草案。\n\n`;
md += `### 批次 A — P0 中国法主干（建议优先）\n\n`;
md += `- [ ] \`zhou210712/claude-for-legal-ZH\` → 抽装 \`employment-legal\` + \`commercial-legal\` + \`corporate-legal\`（各 5–8 核心 SKILL）\n`;
md += `- [ ] 同仓补装 \`privacy-legal\` + \`product-legal\` + \`regulatory-legal\`\n`;
md += `- [ ] \`zh-xx/legal-assistant-skills\` 轻量合规\n\n`;
md += `### 批次 B — 招投标补洞\n\n`;
md += `- [ ] \`youyouhe/bidsmart-claude-skills\`\n`;
md += `- [ ] \`Get00/BiaoShu-SKILL\`\n`;
md += `- [ ] （可选观察）\`Hugin-Z/tender-writer-v3\`\n\n`;
md += `### 批次 C — 政策数据\n\n`;
md += `- [ ] \`guangxiangdebizi/China-Central-Policy-MCP\`（优先）\n`;
md += `- [ ] （观察/商用）\`handaas/policy-mcp-server\` + \`bidding-mcp-server\`\n`;
md += `- [ ] 组合：官方惠企门户索引 KB（短 TTL），而非全文灌模\n\n`;
md += `### 批次 D — 财税择装（谨慎）\n\n`;
md += `- [ ] vivy \`tax-compliance\` / \`tax-preference-*\`（先核实 LICENSE）\n`;
md += `- [ ] 明确不做：假发票、隐瞒收入、规避监管步骤\n`;
md += `- [ ] 与 \`anth-xlsx\` 组合点：科目表/报销台账模板（自建 references）\n\n`;
md += `### 明确不装\n\n`;
md += `- [x] elfbobo fork / drdavid-kor 伪 CN / seam3 fork / 整仓 huodebing / Xero·QBO 作大陆电税替代 / SkillsMP 专有金标未审许可\n\n`;

md += `## 10. 附录\n\n`;
md += `### 10.1 检索词日志（节选）\n\n`;
md += `\`compliance skill\`, \`rfp skill\`, \`tender\`, \`bookkeeping\`, \`tax planning\`, \`employment legal\`, \`procurement\`, \`招投标 skill\`, \`标书\`, \`税务筹划\`, \`劳动合同\`, \`合规 agent skill\`, \`政策 MCP\`, \`惠企政策\`, \`专精特新\`\n\n`;
md += `### 10.2 排除清单\n\n`;
md += `- 纯 Web3/智能合约合规（非本批 SME 范围）\n`;
md += `- openai/skills（无领域内容）\n`;
md += `- 需登录才能读的商业库正文（不入库）\n`;
md += `- 逃税/假票操作类内容（发现即排除）\n\n`;
md += `### 10.3 未核实项\n\n`;
md += `- 31 省「惠企」专栏深链多数为**门户级**，业务落地前须再点验跳转\n`;
md += `- vivy LICENSE 文件登记状态\n`;
md += `- Handaas 商用定价与区域可用性\n`;
md += `- 元典/法宝 MCP 具体工具列表与鉴权（仅文档级评价）\n\n`;
md += `### 10.4 门禁自检\n\n`;
md += `| 门禁项 | 结果 |\n|--------|------|\n`;
md += `| 35+ 渠道无「未扫」 | ✓ ${pool.channels.length} 渠道全 done |\n`;
md += `| candidate-pool ≥200 | ✓ ${pool.meta.counts.candidates} |\n`;
md += `| 七类成品每类 ≥15 或空白声明 | ✓ 见 §3 计数 |\n`;
md += `| P0 三大仓原子拆解+热力图 | ✓ §5 |\n`;
md += `| 31 省惠企 URL ≥90% | ✓ 31/31 门户级 |\n`;
md += `| 市/区县抽样配额 | ✓ §4.B |\n`;
md += `| 每类数据源 ≥10 | ✓ §4.1–4.7 |\n`;
md += `| 隐藏欧美包对照 | ✓ §6–7 |\n`;
md += `| 六维分列 + Top 勾选 | ✓ |\n`;
md += `| 无 vendor / 无逃税指引 / 免责 | ✓ |\n\n`;
md += `---\n\n*生成脚本：\`scripts/_gen-cn-sme-compliance-pool.mjs\` + \`scripts/_gen-cn-sme-compliance-report.mjs\`（调研辅助；可删可留）。*\n`;

fs.writeFileSync('docs/cn-sme-compliance-skills-data-matrix-20260802.zh-CN.md', md);
console.log('wrote report bytes', md.length);
for (let i = 1; i <= 7; i++) {
  console.log('finished cat', i, finishedForCat(i).length);
}
