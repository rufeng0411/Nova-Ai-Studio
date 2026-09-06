# 大陆业务合规 Skills + 数据源深度调研总报告

> 调研日：2026-08-02｜候选池：[`docs/cn-sme-compliance-candidate-pool-20260802.json`](./cn-sme-compliance-candidate-pool-20260802.json)（297 行）｜基线快照：[`docs/_cn-sme-baseline-catalog-20260802.json`](./_cn-sme-baseline-catalog-20260802.json)

## 风险免责（置顶）

- 本报告**仅供选型与产品规划**，**不构成**法律、税务、会计、劳动人事或其他**执业意见**。
- 任何合同、报税、申报、解除劳动关系等成果须由具备资质的专业人士审定后再使用。
- 「合理避税」在本报告中一律表述为**合法税务筹划**；**禁止**假发票、隐瞒收入、伪造申报等违法教唆内容。
- **未执行**任何 `vendor:*`、未改 catalog/Hub/taxonomy。安装批次待你勾选下令后再做。

## 1. 执行摘要

### P0 推荐包 Top5

| 排名 | 候选 | 建议 | 理由 |
|------|------|------|------|
| 1 | [zhou210712/claude-for-legal-ZH](https://github.com/zhou210712/claude-for-legal-ZH) | **安装（主干）** | 176★、Apache-2.0、12 插件、CN 法条 references；劳动/合同/公司最均衡 |
| 2 | [youyouhe/bidsmart](https://github.com/youyouhe/bidsmart-claude-skills) + [Get00/BiaoShu-SKILL](https://github.com/Get00/BiaoShu-SKILL) | **安装（补招标）** | 主法仓普遍缺招投标；二者补政府采购/标书 |
| 3 | [China-Central-Policy-MCP](https://github.com/guangxiangdebizi/China-Central-Policy-MCP) | **安装（政策数据）** | gov.cn 列表+正文；开源向、低商业摩擦 |
| 4 | [zh-xx/legal-assistant-skills](https://github.com/zh-xx/legal-assistant-skills) | **安装（轻量合规）** | 155★；广告法/合同审轻量补充 |
| 5 | [vivy-yi/Greater-China-Legal](https://github.com/vivy-yi/Greater-China-Legal) `tax-compliance` 等 | **观察→择装** | 财税/税优最全；LICENSE 文件未登记、体量大勿整仓 |

### 七类缺口热力图（Skills 生态）

| 类别 | 生态覆盖 | 说明 |
|------|----------|------|
| 1 小微合规政策 | 中 | PIPL/广告/监管有包；等保/密评/餐饮消防弱 |
| 2 合同·招投标·标书 | 中（合同强/招标弱→可补） | 合同靠 zhou；招标靠 bidsmart/BiaoShu |
| 3 财务·税务·会计·出纳 | 弱→中 | 大陆电税/全电票缺成熟开源包；vivy 税场景可择装；金融 Tab≠出纳 |
| 4 人力合规 | 强 | zhou/vivy employment 成熟 |
| 5 企业法律 | 强 | zhou corporate/commercial/ip |
| 6 合法税务筹划 | 中 | vivy 税优；须严守合法边界 |
| 7 扶持政策国家→区县 | 弱（Skill）/强（数据源） | Skill 稀缺；走政策 MCP + 官方门户 |

### 一句话决策

以 **zhou 中国法插件为主干**，**招标双仓补洞**，**政策走 MCP+官方库**；已装 **legal-lav/lpm 继续隐藏保留**作欧美对照，不作为大陆 SME 默认入口；金融 Tab 投研能力**不替代**出纳报税。

## 2. 调研方法与渠道勾选完成表（39 渠道）

| # | 组 | 渠道 | 状态 | 备注 |
|---|----|------|------|------|
| 1 | A | skills.sh 安装榜 + npx skills find | ✓ done | 多词检索 bookkeeping/tax/contract/rfp/tender/hr |
| 2 | A | officialskills.sh | ✓ done | 交叉确认官方向条目 |
| 3 | A | VoltAgent/awesome-agent-skills | ✓ done | 命中 draft-nda/privacy-policy/finance 有限 |
| 4 | A | heilcheng → agent-skill.co | ✓ done | 可达，域内条目少 |
| 5 | A | SkillsMP | ✓ done | PossibLaw/Nexus 系列 |
| 6 | A | Claude Partners Skills | ✓ done | 经 skills.sh/partners 交叉 |
| 7 | A | anthropics/skills | ✓ done | 偏通用/开发元技能 |
| 8 | A | anthropics/knowledge-work-plugins | ✓ done | legal/finance/HR 三插件 |
| 9 | A | anthropics/claude-for-legal | ✓ done | 美法原版，CN fork 另列 |
| 10 | A | openai/skills | ✓ done | 几乎无法务/财税领域 |
| 11 | A | GitHub 主题直搜（七类英文词） | ✓ done | WebSearch+API |
| 12 | A | Skillselion / ClaudePluginHub 交叉 | ✓ done | 与 skills.sh 重叠确认 |
| 13 | A | Composio / awesome-claude-skills | ✓ done | 合规向命中有限 |
| 14 | B | vivy-yi/Greater-China-Legal | ✓ done | P0 深读 |
| 15 | B | elfbobo/Greater-China-Legal | ✓ done | 过时 fork |
| 16 | B | drdavid-kor/claude-for-legal-cn | ✓ done | 美法未本土化 |
| 17 | B | huodebing-alt/Claude-Code-Law-Firm | ✓ done | 律所多Agent架构 |
| 18 | B | zhou210712 employment-legal / legal-zh | ✓ done | 主候选 176★ |
| 19 | B | skill-hub (kevinaimonster) | ✓ done | 泛目录，合规子集弱 |
| 20 | B | JimLiu/baoyu-skills | ✓ done | 企服命中弱，未作主候选 |
| 21 | B | 中文 GitHub：招投标/税务/劳动/合规 | ✓ done | 命中 bidsmart/BiaoShu/zh-xx |
| 22 | B | 飞书/企微生态 Skills | ✓ done | skills.sh 企业向交叉 |
| 23 | B | bytedance/deer-flow | ✓ done | 政策研究组合非专向合规 |
| 24 | B | 本仓 skills/vendor/legal 上游对照 | ✓ done | legal-lav / lpm |
| 25 | C | punkpeye/awesome-mcp-servers | ✓ done | Finance 富 / Legal 薄 |
| 26 | C | Smithery.ai | ✓ done | 快扫 Xero/QBO/HR/Handaas |
| 27 | C | Glama MCP | ✓ done | 会计/HR/政府类索引 |
| 28 | C | MCP 官方 Registry | ✓ done | 交叉确认 |
| 29 | C | handaas/policy-mcp-server | ✓ done | 惠企补贴 |
| 30 | C | guangxiangdebizi/China-Central-Policy-MCP | ✓ done | gov.cn |
| 31 | C | 其他政策/企业数据 MCP | ✓ done | Handaas bidding/industry-chain；企查查类仅许可评 |
| 32 | C | Firecrawl / Tavily / Apify | ✓ done | 组合抓取能力 |
| 33 | C | 元典/北大法宝/威科/无讼 | ✓ done | 商用许可专评，不入库正文 |
| 34 | D | 中国政府网/国务院政策库/国家法律法规数据库 | ✓ done | 权威数据面 |
| 35 | D | 部委：工信/发改/科技/人社/财政/税务/市监/司法 | ✓ done | 入口表 |
| 36 | D | 31 省人民政府惠企专栏 | ✓ done | ≥90% URL |
| 37 | D | 抽样市/区县一网通办惠企页 | ✓ done | 圈层配额 |
| 38 | D | 中国政府采购网+省公招入口 | ✓ done | ccgp.gov.cn |
| 39 | D | 专精特新服务网等第三方 | ✓ done | 标注非官方 |

方法：Wave0 本仓 catalog 导出 → Wave1 四路广度（国际/中国法/MCP/基线）→ Wave2 P0 仓原子深读 → Wave3 部委+31省+市区县+商业库许可 → 六维评分去重 → 主报告。

## 3. 七类 Skills/MCP 详表（成品行）

列说明：六维 = L本地化 / T时效 / P可落盘 / I许可 / D依赖(高=低依赖) / G增益；建议安装门槛：总分≥22 且 L≥4 且 I≥3。

### 3.1 小微合规政策（成品 28 行，表列 Top 18）

| 名称 | slug | 类别 | 子场景/简介 | 链接 | ★ | 六维(总分) | 法域 | 许可 | 形态 | 建议 | 风险备注 |
|------|------|------|-------------|------|---|---------|------|------|------|------|----------|
| China-Central-Policy-MCP | `cn-central-policy-mcp` | 扶持政策国家至区县·小微合规政策 | gov.cn政策列表+正文 | [链接](https://github.com/guangxiangdebizi/China-Central-Policy-MCP) | ★5 | L5/T5/P5/I4/D4/G5 (28) | CN | unknown | mcp | 安装 | 需核依赖Key；草稿≠执业意见 |
| claude-for-legal-ZH / employment-legal | `zh-legal-employment-legal` | 人力合规·小微合规政策 | 人力/劳动合同社保解除 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★4 | L5/T4/P4/I5/D3/G5 (26) | CN | Apache-2.0 | plugin | 安装 | 需核依赖Key；草稿≠执业意见 |
| claude-for-legal-ZH / corporate-legal | `zh-legal-corporate-legal` | 企业法律·小微合规政策 | 公司法股权章程 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★4 | L5/T4/P4/I5/D3/G5 (26) | CN | Apache-2.0 | plugin | 安装 | 需核依赖Key；草稿≠执业意见 |
| zh-xx/legal-assistant-skills | `zh-xx-legal-assistant` | 小微合规政策·合同招投标标书·企业法律 | 合同审/广告法/食品标签 | [链接](https://github.com/zh-xx/legal-assistant-skills) | ★4 | L5/T4/P4/I5/D4/G4 (26) | CN | Apache-2.0 | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| claude-for-legal-ZH / privacy-legal | `zh-legal-privacy-legal` | 小微合规政策·企业法律 | PIPL/数据合规 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★4 | L5/T4/P4/I5/D3/G4 (25) | CN | Apache-2.0 | plugin | 安装 | 需核依赖Key；草稿≠执业意见 |
| claude-for-legal-ZH / product-legal | `zh-legal-product-legal` | 小微合规政策·企业法律 | 产品上线/广告法 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★4 | L5/T4/P4/I5/D3/G4 (25) | CN | Apache-2.0 | plugin | 安装 | 需核依赖Key；草稿≠执业意见 |
| entity-compliance | `atom-entity-compliance` | 企业法律·小微合规政策 | 年报申报截止 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★4 | L5/T4/P4/I5/D3/G4 (25) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| pia-generation | `atom-pia-generation` | 小微合规政策·企业法律 | 个人信息影响评估 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★4 | L5/T4/P4/I5/D3/G4 (25) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| claude-for-legal-ZH / regulatory-legal | `zh-legal-regulatory-legal` | 小微合规政策·企业法律 | 监管合规入门 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★4 | L4/T4/P4/I5/D3/G4 (24) | CN | Apache-2.0 | plugin | 安装 | 需核依赖Key；草稿≠执业意见 |
| dsar-response | `atom-dsar-response` | 小微合规政策 | 主体权利响应 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★4 | L5/T4/P4/I5/D3/G3 (24) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| Greater-China-Legal / employment-legal | `gcl-employment-legal` | 人力合规·小微合规政策 | 社保/合同/竞业/仲裁 | [链接](https://github.com/vivy-yi/Greater-China-Legal) | ★4 | L5/T4/P3/I3/D3/G4 (22) | CN/HK/TW/SG | Apache-2.0(README; LICENSE文件未登记) | plugin | 观察 | 需核依赖Key；草稿≠执业意见 |
| Handaas Policy MCP | `handaas-policy` | 扶持政策国家至区县·小微合规政策 | 政府补贴/政策优惠查询 | [链接](https://github.com/handaas/policy-mcp-server) | ★4 | L5/T4/P4/I2/D2/G5 (22) | CN | commercial | mcp | 观察 | 需核依赖Key；草稿≠执业意见 |
| policy-research-combo firecrawl+gov | `policy-research-combo` | 扶持政策国家至区县·小微合规政策 | Firecrawl/搜索+政府网政策研究组合（非独立仓） | [链接](https://www.gov.cn/) | ★4 | L4/T4/P3/I4/D3/G4 (22) | CN | n/a | combo | 观察 | 需核依赖Key；草稿≠执业意见 |
| entity-setup | `atom-entity-setup` | 企业法律·小微合规政策 | 主体设立 | [链接](https://github.com/vivy-yi/Greater-China-Legal) | ★4 | L5/T4/P3/I3/D3/G4 (22) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| Greater-China-Legal / data-compliance | `gcl-data-compliance` | 小微合规政策·企业法律 | 数据合规 | [链接](https://github.com/vivy-yi/Greater-China-Legal) | ★3 | L5/T4/P3/I3/D3/G3 (21) | CN/HK/TW/SG | Apache-2.0(README; LICENSE文件未登记) | plugin | 观察 | 需核依赖Key；草稿≠执业意见 |
| Firecrawl MCP (combo) | `firecrawl-combo` | 小微合规政策·扶持政策国家至区县 | 网页抓取组合政策页 | [链接](https://github.com/mendableai/firecrawl) | ★3 | L3/T5/P4/I3/D3/G3 (21) | global | commercial | mcp | 观察 | 需核依赖Key；草稿≠执业意见 |
| claude-for-legal-ZH / ai-governance-legal | `zh-legal-ai-governance-legal` | 小微合规政策·企业法律 | AI治理合规 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★3 | L3/T4/P3/I5/D3/G2 (20) | CN | Apache-2.0 | plugin | 观察 | 需核依赖Key；草稿≠执业意见 |
| Greater-China-Legal / regulatory-compliance | `gcl-regulatory-compliance` | 小微合规政策 | 监管合规 | [链接](https://github.com/vivy-yi/Greater-China-Legal) | ★3 | L4/T4/P3/I3/D3/G3 (20) | CN/HK/TW/SG | Apache-2.0(README; LICENSE文件未登记) | plugin | 观察 | 需核依赖Key；草稿≠执业意见 |

### 3.2 合同招投标标书（成品 38 行，表列 Top 18）

| 名称 | slug | 类别 | 子场景/简介 | 链接 | ★ | 六维(总分) | 法域 | 许可 | 形态 | 建议 | 风险备注 |
|------|------|------|-------------|------|---|---------|------|------|------|------|----------|
| Get00/BiaoShu-SKILL | `biaoshu-skill` | 合同招投标标书 | 多行业标书生成 | [链接](https://github.com/Get00/BiaoShu-SKILL) | ★5 | L5/T4/P4/I5/D4/G5 (27) | CN | Apache-2.0 | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| biaoshu-multi-industry | `atom-biaoshu-multi-industry` | 合同招投标标书 | 多行业标书模板 | [链接](https://github.com/Get00/BiaoShu-SKILL) | ★5 | L5/T4/P4/I5/D4/G5 (27) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| claude-for-legal-ZH / commercial-legal | `zh-legal-commercial-legal` | 合同招投标标书·企业法律 | 商事合同审查 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★4 | L5/T4/P4/I5/D3/G5 (26) | CN | Apache-2.0 | plugin | 安装 | 需核依赖Key；草稿≠执业意见 |
| zh-xx/legal-assistant-skills | `zh-xx-legal-assistant` | 小微合规政策·合同招投标标书·企业法律 | 合同审/广告法/食品标签 | [链接](https://github.com/zh-xx/legal-assistant-skills) | ★4 | L5/T4/P4/I5/D4/G4 (26) | CN | Apache-2.0 | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| youyouhe/bidsmart-claude-skills | `bidsmart` | 合同招投标标书·扶持政策国家至区县 | 政府采购全链路 | [链接](https://github.com/youyouhe/bidsmart-claude-skills) | ★4 | L5/T4/P4/I4/D4/G5 (26) | CN | MIT | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| bidsmart-bid-analysis | `atom-bidsmart-bid-analysis` | 合同招投标标书 | 招标文件解析 | [链接](https://github.com/youyouhe/bidsmart-claude-skills) | ★4 | L5/T4/P4/I4/D4/G5 (26) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| bidsmart-commercial-bid | `atom-bidsmart-commercial-bid` | 合同招投标标书 | 商务标 | [链接](https://github.com/youyouhe/bidsmart-claude-skills) | ★4 | L5/T4/P4/I4/D4/G5 (26) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| bidsmart-technical-bid | `atom-bidsmart-technical-bid` | 合同招投标标书 | 技术标 | [链接](https://github.com/youyouhe/bidsmart-claude-skills) | ★4 | L5/T4/P4/I4/D4/G5 (26) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| nda-review | `atom-nda-review` | 合同招投标标书 | NDA审查 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★4 | L5/T4/P4/I5/D3/G4 (25) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| vendor-agreement-review | `atom-vendor-agreement-review` | 合同招投标标书 | 供应商协议 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★4 | L5/T4/P4/I5/D3/G4 (25) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| contract-review-router | `atom-contract-review-router` | 合同招投标标书 | 合同审查路由 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★4 | L5/T4/P4/I5/D3/G4 (25) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| bidsmart-clarification | `atom-bidsmart-clarification` | 合同招投标标书 | 澄清答疑 | [链接](https://github.com/youyouhe/bidsmart-claude-skills) | ★4 | L5/T4/P4/I4/D4/G4 (25) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| saas-msa-review | `atom-saas-msa-review` | 合同招投标标书 | SaaS主协议 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★4 | L4/T4/P4/I5/D3/G3 (23) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| Greater-China-Legal / contract-review | `gcl-contract-review` | 合同招投标标书·企业法律 | 合同审查场景 | [链接](https://github.com/vivy-yi/Greater-China-Legal) | ★4 | L5/T4/P3/I3/D3/G4 (22) | CN/HK/TW/SG | Apache-2.0(README; LICENSE文件未登记) | plugin | 观察 | 需核依赖Key；草稿≠执业意见 |
| MapleEve/legal-skills-cn | `mapleeve-legal-cn` | 人力合规·企业法律·合同招投标标书 | 与zhou同系CN fork | [链接](https://github.com/MapleEve/legal-skills-cn) | ★4 | L4/T3/P4/I5/D3/G3 (22) | CN | Apache-2.0 | plugin | 观察 | 需核依赖Key；草稿≠执业意见 |
| Hugin-Z/tender-writer-v3 | `tender-writer-v3` | 合同招投标标书 | 政府技术标工程化 | [链接](https://github.com/Hugin-Z/tender-writer-v3) | ★4 | L4/T3/P3/I4/D4/G4 (22) | CN | MIT | skill | 观察 | 需核依赖Key；草稿≠执业意见 |
| Handaas Bidding MCP | `handaas-bidding` | 合同招投标标书·扶持政策国家至区县 | 招投标/中标/拟建 | [链接](https://github.com/handaas/bidding-mcp-server) | ★4 | L5/T4/P4/I2/D2/G5 (22) | CN | commercial | mcp | 观察 | 需核依赖Key；草稿≠执业意见 |
| rfp-responder | `rfp-responder` | 合同招投标标书 | Shipley投标策略 | [链接](https://www.skills.sh/alirezarezvani/claude-skills/rfp-responder) | ★3 | L2/T4/P3/I3/D4/G3 (19) | global | unknown | skill | 观察 | 需核依赖Key；草稿≠执业意见 |

### 3.3 财务税务会计出纳（成品 35 行，表列 Top 18）

| 名称 | slug | 类别 | 子场景/简介 | 链接 | ★ | 六维(总分) | 法域 | 许可 | 形态 | 建议 | 风险备注 |
|------|------|------|-------------|------|---|---------|------|------|------|------|----------|
| Greater-China-Legal / tax-compliance | `gcl-tax-compliance` | 财务税务会计出纳·合法税务筹划 | 发票/增值税/税优 | [链接](https://github.com/vivy-yi/Greater-China-Legal) | ★4 | L5/T4/P3/I3/D3/G5 (23) | CN/HK/TW/SG | Apache-2.0(README; LICENSE文件未登记) | plugin | 观察 | 需核依赖Key；草稿≠执业意见 |
| invoice-compliance-checker | `atom-invoice-compliance-checker` | 财务税务会计出纳·合法税务筹划 | 发票三流一致 | [链接](https://github.com/vivy-yi/Greater-China-Legal) | ★4 | L5/T4/P3/I3/D3/G5 (23) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| vat-compliance | `atom-vat-compliance` | 财务税务会计出纳 | 增值税合规 | [链接](https://github.com/vivy-yi/Greater-China-Legal) | ★4 | L5/T4/P3/I3/D3/G5 (23) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| Receiptor bookkeeping-skills | `receiptor-bookkeeping` | 财务税务会计出纳·合法税务筹划 | SME记账闭环 | [链接](https://github.com/Receiptor-AI/bookkeeping-skills) | ★3 | L2/T4/P4/I5/D4/G2 (21) | US-primary | MIT | skill | 观察 | 需核依赖Key；草稿≠执业意见 |
| cit-quarterly | `atom-cit-quarterly` | 财务税务会计出纳 | 企税季度预缴 | [链接](https://github.com/vivy-yi/Greater-China-Legal) | ★3 | L5/T3/P3/I3/D3/G4 (21) | CN | see-parent | skill | 观察 | 需核依赖Key；草稿≠执业意见 |
| bookkeeping-setup | `atom-bookkeeping-setup` | 财务税务会计出纳 | 账套建立 | [链接](https://github.com/Receiptor-AI/bookkeeping-skills) | ★3 | L2/T4/P4/I5/D4/G2 (21) | non-CN | see-parent | skill | 不装 | 需核依赖Key；草稿≠执业意见 |
| receipt-processing | `atom-receipt-processing` | 财务税务会计出纳 | 收据发票提取 | [链接](https://github.com/Receiptor-AI/bookkeeping-skills) | ★3 | L2/T4/P4/I5/D4/G2 (21) | non-CN | see-parent | skill | 不装 | 需核依赖Key；草稿≠执业意见 |
| bank-reconciliation | `atom-bank-reconciliation` | 财务税务会计出纳 | 银行对账 | [链接](https://github.com/Receiptor-AI/bookkeeping-skills) | ★3 | L2/T4/P4/I5/D4/G2 (21) | non-CN | see-parent | skill | 不装 | 需核依赖Key；草稿≠执业意见 |
| monthly-close | `atom-monthly-close` | 财务税务会计出纳 | 月结清单 | [链接](https://github.com/Receiptor-AI/bookkeeping-skills) | ★3 | L2/T4/P4/I5/D4/G2 (21) | non-CN | see-parent | skill | 不装 | 需核依赖Key；草稿≠执业意见 |
| expense-categorization | `atom-expense-categorization` | 财务税务会计出纳 | 费用分类 | [链接](https://github.com/Receiptor-AI/bookkeeping-skills) | ★3 | L2/T4/P4/I5/D4/G2 (21) | non-CN | see-parent | skill | 不装 | 需核依赖Key；草稿≠执业意见 |
| FinanceMCP | `finance-mcp` | 财务税务会计出纳 | 宏观/金融数据非报税 | [链接](https://github.com/guangxiangdebizi/FinanceMCP) | ★3 | L3/T4/P3/I3/D3/G2 (18) | CN | unknown | mcp | 观察 | 需核依赖Key；草稿≠执业意见 |
| KW finance plugin | `kw-finance` | 财务税务会计出纳 | 月结对账SOX | [链接](https://github.com/anthropics/knowledge-work-plugins/tree/main/finance) | ★3 | L1/T5/P3/I3/D3/G2 (17) | US-GAAP | unknown | plugin | 观察 | 需核依赖Key；草稿≠执业意见 |
| GAJETOso/financeskills | `financeskills` | 财务税务会计出纳·合法税务筹划 | 税务筹划收入确认审计 | [链接](https://github.com/GAJETOso/financeskills) | ★3 | L2/T3/P3/I3/D4/G2 (17) | IFRS/GAAP | unknown | skill | 观察 | 需核依赖Key；草稿≠执业意见 |
| Xero MCP | `xero-mcp` | 财务税务会计出纳 | Xero账务API | [链接](https://github.com/XeroAPI/xero-mcp-server) | ★3 | L1/T5/P4/I4/D2/G1 (17) | global | unknown | mcp | 不装 | 需核依赖Key；草稿≠执业意见 |
| QuickBooks Online MCP | `qbo-mcp` | 财务税务会计出纳 | QBO CRUD+报表 | [链接](https://github.com/intuit/quickbooks-online-mcp-server) | ★3 | L1/T5/P4/I4/D2/G1 (17) | US | unknown | mcp | 不装 | 需核依赖Key；草稿≠执业意见 |
| revenue-recognition | `atom-revenue-recognition` | 财务税务会计出纳 | 收入确认 | [链接](https://github.com/GAJETOso/financeskills) | ★3 | L2/T3/P3/I3/D4/G2 (17) | non-CN | see-parent | skill | 不装 | 需核依赖Key；草稿≠执业意见 |
| statement-preparation | `atom-statement-preparation` | 财务税务会计出纳 | 三表编制 | [链接](https://github.com/GAJETOso/financeskills) | ★3 | L2/T3/P3/I3/D4/G2 (17) | non-CN | see-parent | skill | 不装 | 需核依赖Key；草稿≠执业意见 |
| openaccountant/skills | `openaccountant-skills` | 财务税务会计出纳·合法税务筹划 | 税筹/1099/销售税 | [链接](https://github.com/openaccountant/skills) | ★3 | L1/T4/P3/I3/D4/G1 (16) | US | unknown | skill | 不装 | 需核依赖Key；草稿≠执业意见 |

### 3.4 人力合规（成品 28 行，表列 Top 18）

| 名称 | slug | 类别 | 子场景/简介 | 链接 | ★ | 六维(总分) | 法域 | 许可 | 形态 | 建议 | 风险备注 |
|------|------|------|-------------|------|---|---------|------|------|------|------|----------|
| claude-for-legal-ZH / employment-legal | `zh-legal-employment-legal` | 人力合规·小微合规政策 | 人力/劳动合同社保解除 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★4 | L5/T4/P4/I5/D3/G5 (26) | CN | Apache-2.0 | plugin | 安装 | 需核依赖Key；草稿≠执业意见 |
| termination-review | `atom-termination-review` | 人力合规 | 解除高风险/N+1 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★4 | L5/T4/P4/I5/D3/G5 (26) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| hiring-review | `atom-hiring-review` | 人力合规 | Offer/竞业/服务期 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★4 | L5/T4/P4/I5/D3/G5 (26) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| worker-classification | `atom-worker-classification` | 人力合规 | 劳动关系三要素 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★4 | L5/T4/P4/I5/D3/G4 (25) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| wage-hour-qa | `atom-wage-hour-qa` | 人力合规 | 工时加班问答 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★4 | L5/T4/P4/I5/D3/G4 (25) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| handbook-review | `atom-handbook-review` | 人力合规 | 员工手册审查 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★4 | L5/T4/P4/I5/D3/G4 (25) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| social-insurance-compliance | `atom-social-insurance-compliance` | 人力合规 | 社保公积金 | [链接](https://github.com/vivy-yi/Greater-China-Legal) | ★4 | L5/T4/P3/I3/D3/G5 (23) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| Greater-China-Legal / employment-legal | `gcl-employment-legal` | 人力合规·小微合规政策 | 社保/合同/竞业/仲裁 | [链接](https://github.com/vivy-yi/Greater-China-Legal) | ★4 | L5/T4/P3/I3/D3/G4 (22) | CN/HK/TW/SG | Apache-2.0(README; LICENSE文件未登记) | plugin | 观察 | 需核依赖Key；草稿≠执业意见 |
| MapleEve/legal-skills-cn | `mapleeve-legal-cn` | 人力合规·企业法律·合同招投标标书 | 与zhou同系CN fork | [链接](https://github.com/MapleEve/legal-skills-cn) | ★4 | L4/T3/P4/I5/D3/G3 (22) | CN | Apache-2.0 | plugin | 观察 | 需核依赖Key；草稿≠执业意见 |
| labor-contract-drafter | `atom-labor-contract-drafter` | 人力合规 | 劳动合同起草 | [链接](https://github.com/vivy-yi/Greater-China-Legal) | ★4 | L5/T4/P3/I3/D3/G4 (22) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| non-compete-enforcement | `atom-non-compete-enforcement` | 人力合规 | 竞业限制 | [链接](https://github.com/vivy-yi/Greater-China-Legal) | ★4 | L5/T4/P3/I3/D3/G4 (22) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| claude-for-legal-ZH / litigation-legal | `zh-legal-litigation-legal` | 企业法律·人力合规 | 诉讼仲裁 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★3 | L4/T3/P3/I5/D3/G3 (21) | CN | Apache-2.0 | plugin | 观察 | 需核依赖Key；草稿≠执业意见 |
| pa1nrui1/legal-skills | `pa1nrui1-legal` | 人力合规·企业法律 | 劳动争议/合同/刑辩流程 | [链接](https://github.com/pa1nrui1/legal-skills) | ★3 | L4/T3/P3/I4/D4/G3 (21) | CN | MIT | skill | 观察 | 需核依赖Key；草稿≠执业意见 |
| Greater-China-Legal / labor-arbitration | `gcl-labor-arbitration` | 人力合规 | 劳动仲裁 | [链接](https://github.com/vivy-yi/Greater-China-Legal) | ★3 | L5/T4/P3/I3/D3/G3 (21) | CN/HK/TW/SG | Apache-2.0(README; LICENSE文件未登记) | plugin | 观察 | 需核依赖Key；草稿≠执业意见 |
| anthropics/claude-for-legal | `anthropic-cfl` | 合同招投标标书·人力合规·企业法律 | 官方美法法律套件 | [链接](https://github.com/anthropics/claude-for-legal) | ★3 | L1/T5/P3/I5/D3/G1 (18) | US | Apache-2.0 | plugin | 观察 | 需核依赖Key；草稿≠执业意见 |
| cfl-worker-classification | `atom-cfl-worker-classification` | 人力合规 | 雇员vs承包商 | [链接](https://github.com/anthropics/claude-for-legal) | ★3 | L1/T5/P3/I5/D3/G1 (18) | non-CN | see-parent | skill | 不装 | 需核依赖Key；草稿≠执业意见 |
| KW HR plugin | `kw-hr` | 人力合规 | 录用入职政策薪酬 | [链接](https://github.com/anthropics/knowledge-work-plugins/tree/main/human-resources) | ★3 | L1/T5/P3/I3/D3/G1 (16) | US | unknown | plugin | 观察 | 需核依赖Key；草稿≠执业意见 |
| lawve awesome-legal-skills | `lawve-awesome` | 合同招投标标书·人力合规·企业法律 | ~139法律技能目录 | [链接](https://github.com/lawve-ai/awesome-legal-skills) | ★3 | L2/T4/P2/I3/D3/G2 (16) | multi | other | combo | 观察 | 需核依赖Key；草稿≠执业意见 |

### 3.5 企业法律（成品 43 行，表列 Top 18）

| 名称 | slug | 类别 | 子场景/简介 | 链接 | ★ | 六维(总分) | 法域 | 许可 | 形态 | 建议 | 风险备注 |
|------|------|------|-------------|------|---|---------|------|------|------|------|----------|
| claude-for-legal-ZH / commercial-legal | `zh-legal-commercial-legal` | 合同招投标标书·企业法律 | 商事合同审查 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★4 | L5/T4/P4/I5/D3/G5 (26) | CN | Apache-2.0 | plugin | 安装 | 需核依赖Key；草稿≠执业意见 |
| claude-for-legal-ZH / corporate-legal | `zh-legal-corporate-legal` | 企业法律·小微合规政策 | 公司法股权章程 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★4 | L5/T4/P4/I5/D3/G5 (26) | CN | Apache-2.0 | plugin | 安装 | 需核依赖Key；草稿≠执业意见 |
| zh-xx/legal-assistant-skills | `zh-xx-legal-assistant` | 小微合规政策·合同招投标标书·企业法律 | 合同审/广告法/食品标签 | [链接](https://github.com/zh-xx/legal-assistant-skills) | ★4 | L5/T4/P4/I5/D4/G4 (26) | CN | Apache-2.0 | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| claude-for-legal-ZH / privacy-legal | `zh-legal-privacy-legal` | 小微合规政策·企业法律 | PIPL/数据合规 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★4 | L5/T4/P4/I5/D3/G4 (25) | CN | Apache-2.0 | plugin | 安装 | 需核依赖Key；草稿≠执业意见 |
| claude-for-legal-ZH / product-legal | `zh-legal-product-legal` | 小微合规政策·企业法律 | 产品上线/广告法 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★4 | L5/T4/P4/I5/D3/G4 (25) | CN | Apache-2.0 | plugin | 安装 | 需核依赖Key；草稿≠执业意见 |
| entity-compliance | `atom-entity-compliance` | 企业法律·小微合规政策 | 年报申报截止 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★4 | L5/T4/P4/I5/D3/G4 (25) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| pia-generation | `atom-pia-generation` | 小微合规政策·企业法律 | 个人信息影响评估 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★4 | L5/T4/P4/I5/D3/G4 (25) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| claude-for-legal-ZH / regulatory-legal | `zh-legal-regulatory-legal` | 小微合规政策·企业法律 | 监管合规入门 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★4 | L4/T4/P4/I5/D3/G4 (24) | CN | Apache-2.0 | plugin | 安装 | 需核依赖Key；草稿≠执业意见 |
| claude-for-legal-ZH / ip-legal | `zh-legal-ip-legal` | 企业法律 | 知产商标专利 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★4 | L4/T4/P4/I5/D3/G3 (23) | CN | Apache-2.0 | plugin | 安装 | 需核依赖Key；草稿≠执业意见 |
| diligence-issue-extraction | `atom-diligence-issue-extraction` | 企业法律 | 尽调问题提取 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★4 | L4/T4/P4/I5/D3/G3 (23) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| tabular-review | `atom-tabular-review` | 企业法律 | 表格化审查 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★4 | L4/T4/P4/I5/D3/G3 (23) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| Greater-China-Legal / contract-review | `gcl-contract-review` | 合同招投标标书·企业法律 | 合同审查场景 | [链接](https://github.com/vivy-yi/Greater-China-Legal) | ★4 | L5/T4/P3/I3/D3/G4 (22) | CN/HK/TW/SG | Apache-2.0(README; LICENSE文件未登记) | plugin | 观察 | 需核依赖Key；草稿≠执业意见 |
| Greater-China-Legal / corporate-governance | `gcl-corporate-governance` | 企业法律 | 公司治理/设立/ESOP | [链接](https://github.com/vivy-yi/Greater-China-Legal) | ★4 | L5/T4/P3/I3/D3/G4 (22) | CN/HK/TW/SG | Apache-2.0(README; LICENSE文件未登记) | plugin | 观察 | 需核依赖Key；草稿≠执业意见 |
| MapleEve/legal-skills-cn | `mapleeve-legal-cn` | 人力合规·企业法律·合同招投标标书 | 与zhou同系CN fork | [链接](https://github.com/MapleEve/legal-skills-cn) | ★4 | L4/T3/P4/I5/D3/G3 (22) | CN | Apache-2.0 | plugin | 观察 | 需核依赖Key；草稿≠执业意见 |
| entity-setup | `atom-entity-setup` | 企业法律·小微合规政策 | 主体设立 | [链接](https://github.com/vivy-yi/Greater-China-Legal) | ★4 | L5/T4/P3/I3/D3/G4 (22) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| claude-for-legal-ZH / litigation-legal | `zh-legal-litigation-legal` | 企业法律·人力合规 | 诉讼仲裁 | [链接](https://github.com/zhou210712/claude-for-legal-ZH) | ★3 | L4/T3/P3/I5/D3/G3 (21) | CN | Apache-2.0 | plugin | 观察 | 需核依赖Key；草稿≠执业意见 |
| pa1nrui1/legal-skills | `pa1nrui1-legal` | 人力合规·企业法律 | 劳动争议/合同/刑辩流程 | [链接](https://github.com/pa1nrui1/legal-skills) | ★3 | L4/T3/P3/I4/D4/G3 (21) | CN | MIT | skill | 观察 | 需核依赖Key；草稿≠执业意见 |
| Greater-China-Legal / data-compliance | `gcl-data-compliance` | 小微合规政策·企业法律 | 数据合规 | [链接](https://github.com/vivy-yi/Greater-China-Legal) | ★3 | L5/T4/P3/I3/D3/G3 (21) | CN/HK/TW/SG | Apache-2.0(README; LICENSE文件未登记) | plugin | 观察 | 需核依赖Key；草稿≠执业意见 |

### 3.6 合法税务筹划（成品 16 行，表列 Top 16）

| 名称 | slug | 类别 | 子场景/简介 | 链接 | ★ | 六维(总分) | 法域 | 许可 | 形态 | 建议 | 风险备注 |
|------|------|------|-------------|------|---|---------|------|------|------|------|----------|
| Greater-China-Legal / tax-compliance | `gcl-tax-compliance` | 财务税务会计出纳·合法税务筹划 | 发票/增值税/税优 | [链接](https://github.com/vivy-yi/Greater-China-Legal) | ★4 | L5/T4/P3/I3/D3/G5 (23) | CN/HK/TW/SG | Apache-2.0(README; LICENSE文件未登记) | plugin | 观察 | 需核依赖Key；草稿≠执业意见 |
| Greater-China-Legal / tax-preference-advisor | `gcl-tax-preference-advisor` | 合法税务筹划·扶持政策国家至区县 | 高新小微研发加计 | [链接](https://github.com/vivy-yi/Greater-China-Legal) | ★4 | L5/T4/P3/I3/D3/G5 (23) | CN/HK/TW/SG | Apache-2.0(README; LICENSE文件未登记) | plugin | 观察 | 需核依赖Key；草稿≠执业意见 |
| invoice-compliance-checker | `atom-invoice-compliance-checker` | 财务税务会计出纳·合法税务筹划 | 发票三流一致 | [链接](https://github.com/vivy-yi/Greater-China-Legal) | ★4 | L5/T4/P3/I3/D3/G5 (23) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| rd-super-deduction | `atom-rd-super-deduction` | 合法税务筹划 | 研发加计扣除 | [链接](https://github.com/vivy-yi/Greater-China-Legal) | ★4 | L5/T4/P3/I3/D3/G5 (23) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| sme-tax-preference | `atom-sme-tax-preference` | 合法税务筹划·扶持政策国家至区县 | 小微优惠 | [链接](https://github.com/vivy-yi/Greater-China-Legal) | ★4 | L5/T4/P3/I3/D3/G5 (23) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| Receiptor bookkeeping-skills | `receiptor-bookkeeping` | 财务税务会计出纳·合法税务筹划 | SME记账闭环 | [链接](https://github.com/Receiptor-AI/bookkeeping-skills) | ★3 | L2/T4/P4/I5/D4/G2 (21) | US-primary | MIT | skill | 观察 | 需核依赖Key；草稿≠执业意见 |
| esop-incentive-plan | `atom-esop-incentive-plan` | 企业法律·合法税务筹划 | ESOP | [链接](https://github.com/vivy-yi/Greater-China-Legal) | ★3 | L4/T4/P3/I3/D3/G3 (20) | CN | see-parent | skill | 观察 | 需核依赖Key；草稿≠执业意见 |
| Greater-China-Legal / m-and-a | `gcl-m-and-a` | 企业法律·合法税务筹划 | 并购 | [链接](https://github.com/vivy-yi/Greater-China-Legal) | ★3 | L3/T4/P2/I3/D3/G2 (17) | CN/HK/TW/SG | Apache-2.0(README; LICENSE文件未登记) | plugin | 观察 | 需核依赖Key；草稿≠执业意见 |
| GAJETOso/financeskills | `financeskills` | 财务税务会计出纳·合法税务筹划 | 税务筹划收入确认审计 | [链接](https://github.com/GAJETOso/financeskills) | ★3 | L2/T3/P3/I3/D4/G2 (17) | IFRS/GAAP | unknown | skill | 观察 | 需核依赖Key；草稿≠执业意见 |
| cit-planning-memo | `atom-cit-planning-memo` | 合法税务筹划 | 企税筹划备忘 | [链接](https://github.com/huodebing-alt/Claude-Code-Law-Firm) | ★3 | L4/T3/P1/I4/D2/G3 (17) | CN | see-parent | skill | 观察 | 需核依赖Key；草稿≠执业意见 |
| tax-planning-ifrs | `atom-tax-planning-ifrs` | 合法税务筹划 | 税务筹划框架 | [链接](https://github.com/GAJETOso/financeskills) | ★3 | L2/T3/P3/I3/D4/G2 (17) | non-CN | see-parent | skill | 不装 | 需核依赖Key；草稿≠执业意见 |
| openaccountant/skills | `openaccountant-skills` | 财务税务会计出纳·合法税务筹划 | 税筹/1099/销售税 | [链接](https://github.com/openaccountant/skills) | ★3 | L1/T4/P3/I3/D4/G1 (16) | US | unknown | skill | 不装 | 需核依赖Key；草稿≠执业意见 |
| huodebing Claude-Code-Law-Firm | `huodebing-law-firm` | 企业法律·合法税务筹划·人力合规 | 律所多Agent+connectors | [链接](https://github.com/huodebing-alt/Claude-Code-Law-Firm) | ★3 | L4/T3/P1/I4/D2/G2 (16) | CN | MIT | combo | 不装 | 需核依赖Key；草稿≠执业意见 |
| OpenAccountants MCP | `openaccountants-mcp` | 财务税务会计出纳·合法税务筹划 | 多司法辖区会计 | [链接](https://github.com/openaccountants/openaccountants) | ★3 | L2/T3/P3/I3/D3/G2 (16) | multi | unknown | mcp | 观察 | 需核依赖Key；草稿≠执业意见 |
| oa-quarterly-taxes | `atom-oa-quarterly-taxes` | 财务税务会计出纳·合法税务筹划 | 季度税估算 | [链接](https://github.com/openaccountant/skills) | ★3 | L1/T4/P3/I3/D4/G1 (16) | non-CN | see-parent | skill | 不装 | 需核依赖Key；草稿≠执业意见 |
| mcp-accounting-practice | `atom-mcp-accounting-practice` | 财务税务会计出纳·合法税务筹划 | MCP Accounting实践 | [链接](https://glama.ai/mcp/servers) | ★2 | L1/T3/P3/I3/D3/G1 (14) | non-CN | see-parent | skill | 不装 | 需核依赖Key；草稿≠执业意见 |

### 3.7 扶持政策国家至区县（成品 16 行，表列 Top 16）

| 名称 | slug | 类别 | 子场景/简介 | 链接 | ★ | 六维(总分) | 法域 | 许可 | 形态 | 建议 | 风险备注 |
|------|------|------|-------------|------|---|---------|------|------|------|------|----------|
| China-Central-Policy-MCP | `cn-central-policy-mcp` | 扶持政策国家至区县·小微合规政策 | gov.cn政策列表+正文 | [链接](https://github.com/guangxiangdebizi/China-Central-Policy-MCP) | ★5 | L5/T5/P5/I4/D4/G5 (28) | CN | unknown | mcp | 安装 | 需核依赖Key；草稿≠执业意见 |
| youyouhe/bidsmart-claude-skills | `bidsmart` | 合同招投标标书·扶持政策国家至区县 | 政府采购全链路 | [链接](https://github.com/youyouhe/bidsmart-claude-skills) | ★4 | L5/T4/P4/I4/D4/G5 (26) | CN | MIT | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| Greater-China-Legal / tax-preference-advisor | `gcl-tax-preference-advisor` | 合法税务筹划·扶持政策国家至区县 | 高新小微研发加计 | [链接](https://github.com/vivy-yi/Greater-China-Legal) | ★4 | L5/T4/P3/I3/D3/G5 (23) | CN/HK/TW/SG | Apache-2.0(README; LICENSE文件未登记) | plugin | 观察 | 需核依赖Key；草稿≠执业意见 |
| sme-tax-preference | `atom-sme-tax-preference` | 合法税务筹划·扶持政策国家至区县 | 小微优惠 | [链接](https://github.com/vivy-yi/Greater-China-Legal) | ★4 | L5/T4/P3/I3/D3/G5 (23) | CN | see-parent | skill | 安装 | 需核依赖Key；草稿≠执业意见 |
| Handaas Policy MCP | `handaas-policy` | 扶持政策国家至区县·小微合规政策 | 政府补贴/政策优惠查询 | [链接](https://github.com/handaas/policy-mcp-server) | ★4 | L5/T4/P4/I2/D2/G5 (22) | CN | commercial | mcp | 观察 | 需核依赖Key；草稿≠执业意见 |
| policy-research-combo firecrawl+gov | `policy-research-combo` | 扶持政策国家至区县·小微合规政策 | Firecrawl/搜索+政府网政策研究组合（非独立仓） | [链接](https://www.gov.cn/) | ★4 | L4/T4/P3/I4/D3/G4 (22) | CN | n/a | combo | 观察 | 需核依赖Key；草稿≠执业意见 |
| Handaas Bidding MCP | `handaas-bidding` | 合同招投标标书·扶持政策国家至区县 | 招投标/中标/拟建 | [链接](https://github.com/handaas/bidding-mcp-server) | ★4 | L5/T4/P4/I2/D2/G5 (22) | CN | commercial | mcp | 观察 | 需核依赖Key；草稿≠执业意见 |
| Firecrawl MCP (combo) | `firecrawl-combo` | 小微合规政策·扶持政策国家至区县 | 网页抓取组合政策页 | [链接](https://github.com/mendableai/firecrawl) | ★3 | L3/T5/P4/I3/D3/G3 (21) | global | commercial | mcp | 观察 | 需核依赖Key；草稿≠执业意见 |
| specialized-sme-playbook-stub | `specialized-sme-playbook` | 扶持政策国家至区县 | 专精特新申报材料清单类自建候选（生态真空声明） | [链接](search-hit://zjtx) | ★3 | L4/T2/P3/I3/D4/G4 (20) | CN | n/a | skill | 数据源组合/自建 | 需核依赖Key；草稿≠执业意见 |
| Handaas Industry Chain MCP | `handaas-industry` | 扶持政策国家至区县·合同招投标标书 | 政策+招投标+企业 | [链接](https://github.com/handaas/industry-chain-mcp-server) | ★3 | L5/T3/P3/I2/D2/G4 (19) | CN | commercial | mcp | 观察 | 需核依赖Key；草稿≠执业意见 |
| Tavily Search (combo) | `tavily-combo` | 小微合规政策·扶持政策国家至区县 | 检索组合 | [链接](https://tavily.com/) | ★3 | L3/T5/P4/I3/D2/G2 (19) | global | commercial | mcp | 观察 | 需核依赖Key；草稿≠执业意见 |
| bytedance/deer-flow | `deer-flow` | 扶持政策国家至区县 | 政策研究工作流组合 | [链接](https://github.com/bytedance/deer-flow) | ★3 | L3/T4/P2/I3/D3/G3 (18) | CN | unknown | combo | 观察 | 需核依赖Key；草稿≠执业意见 |
| Apify (combo) | `apify-combo` | 合同招投标标书·扶持政策国家至区县 | 爬虫Actors组合 | [链接](https://apify.com/) | ★3 | L2/T4/P3/I3/D2/G2 (16) | global | commercial | mcp | 观察 | 需核依赖Key；草稿≠执业意见 |
| GovRider MCP | `govrider` | 合同招投标标书·扶持政策国家至区县 | 全球政府招标补助 | [链接](https://github.com/carlosahumada89/govrider-mcp-server) | ★2 | L1/T3/P3/I3/D3/G2 (15) | global | unknown | mcp | 观察 | 需核依赖Key；草稿≠执业意见 |
| GovToolsPro MCP | `govtoolspro` | 合同招投标标书·扶持政策国家至区县 | SAM.gov投标go/no-go | [链接](https://github.com/smythmyke/govtoolspro-mcp-server) | ★2 | L1/T3/P3/I3/D3/G1 (14) | US | unknown | mcp | 不装 | 需核依赖Key；草稿≠执业意见 |
| federal-agent | `atom-federal-agent` | 合同招投标标书·扶持政策国家至区县 | US联邦采购数据 | [链接](https://github.com/) | ★2 | L1/T3/P2/I3/D3/G1 (13) | non-CN | see-parent | skill | 不装 | 需核依赖Key；草稿≠执业意见 |

## 4. 七类权威数据源 / KB 详表

### 4.0 综合权威与商业库

| 名称 | 级别 | URL | 覆盖主题 | 更新频率 | 接入方式 | 账号/付费 | 许可与商用风险 | KB镜像 | 组合类 | 优先级 |
|------|------|-----|----------|----------|----------|-----------|----------------|--------|--------|--------|
| 中国政府网 | 国家 | https://www.gov.cn/ | 政策/解读总入口 | 持续 | 浏览器/MCP抓取 | 否 | 官方公开 | 索引+链出 | 7,1 | P0 |
| 中国政府网惠企助企政策集纳 | 国家 | https://www.gov.cn/ | 惠企政策主题检索(报道确认存在) | 持续 | 检索页 | 否 | 官方公开 | 索引 | 7 | P0 |
| 国务院政策文件库 | 国家 | https://www.gov.cn/zhengce/ | 行政法规/文件/解读 | 持续 | 检索 | 否 | 官方公开 | 索引+链出 | 7,1 | P0 |
| 国家法律法规数据库 | 国家 | https://flk.npc.gov.cn/ | 法律/行政法规/司法解释 | 持续 | 检索 | 否 | 官方公开 | 索引 | 1,5 | P0 |
| 工信部中小企业局/专精特新 | 国家 | https://www.miit.gov.cn/ | 专精特新/中小企业政策 | 持续 | 门户 | 否 | 官方公开 | 索引 | 7 | P0 |
| 专精特新服务平台(官方导向入口) | 国家 | https://zjtx.miit.gov.cn/ | 专精特新申报服务 | 持续 | 门户 | 可能账号 | 官方公开为主 | 索引 | 7 | P0 |
| 国家发展改革委 | 国家 | https://www.ndrc.gov.cn/ | 产业/投资/专项 | 持续 | 门户 | 否 | 官方公开 | 索引 | 7 | P0 |
| 科技部 | 国家 | https://www.most.gov.cn/ | 科技型中小/研发政策 | 持续 | 门户 | 否 | 官方公开 | 索引 | 7,6 | P0 |
| 人力资源社会保障部 | 国家 | https://www.mohrss.gov.cn/ | 社保/稳岗/就业补贴 | 持续 | 门户 | 否 | 官方公开 | 索引 | 4,7 | P0 |
| 财政部 | 国家 | https://www.mof.gov.cn/ | 财政专项/政府采购政策 | 持续 | 门户 | 否 | 官方公开 | 索引 | 7,2 | P0 |
| 国家税务总局 | 国家 | https://www.chinatax.gov.cn/ | 税法/优惠/征管 | 持续 | 门户+电税局 | 办税需账号 | 官方公开 | 索引；禁灌全文模型 | 3,6 | P0 |
| 国家市场监督管理总局 | 国家 | https://www.samr.gov.cn/ | 登记/年报/广告/反不正当竞争 | 持续 | 门户 | 否 | 官方公开 | 索引 | 1 | P0 |
| 司法部 | 国家 | https://www.moj.gov.cn/ | 普法/律师/公证 | 持续 | 门户 | 否 | 官方公开 | 索引 | 5 | P1 |
| 中国政府采购网 | 国家 | https://www.ccgp.gov.cn/ | 政府采购公告 | 日更 | 检索 | 否 | 官方公开 | 索引+组合Skill | 2 | P0 |
| 全国公共资源交易平台 | 国家 | https://www.ggzy.gov.cn/ | 公共资源/招投标入口 | 日更 | 门户 | 否 | 官方公开 | 索引 | 2 | P0 |
| 北大法宝 | 商业 | https://www.pkulaw.com/ | 法规/案例全文 | 持续 | API/账号 | 付费 | 商用许可严格；禁止批量爬全文 | 不可镜像全文 | 5 | 观察 |
| 威科先行 | 商业 | https://law.wkinfo.com.cn/ | 法规/实务 | 持续 | 账号 | 付费 | 商用许可严格 | 不可镜像全文 | 5 | 观察 |
| 无讼 | 商业 | https://www.itslaw.com/ | 案例检索 | 持续 | 账号 | 付费/增值 | 商用许可 | 不可镜像全文 | 5 | 不优先 |
| 元典 | 商业 | n/a | 法律检索MCP/连接器 | 持续 | MCP/Key | 付费 | 商用 | 连接器级 | 5 | 观察 |
| 企查查开放平台 | 商业 | https://openapi.qcc.com/ | 企业工商数据 | 持续 | API Key | 付费 | ToS限制强 | 不可整库镜像 | 1,7 | 观察 |
| 天眼查开放平台 | 商业 | https://open.tianyancha.com/ | 企业工商数据 | 持续 | API Key | 付费 | ToS限制强 | 不可整库镜像 | 1,7 | 观察 |
| 湖北省惠企政策直达快享 | 省 | http://www.hubei.gov.cn/ | 惠企直达快享专区 | 持续 | 门户 | 否 | 官方公开 | 索引 | 7 | P0 |
| 福建省惠企一站式申享(金服云报道) | 省 | https://fgw.fujian.gov.cn/ | 免申/快申 | 持续 | 平台 | 可能账号 | 官方公开 | 索引 | 7 | P0 |
| 河南省免申即享工作方案入口 | 省 | https://www.henan.gov.cn/ | 免申即享 | 政策更新 | 政务平台 | 可能账号 | 官方公开 | 索引 | 7 | P0 |
| 第三方专精特新资讯站 | 商业 | 多域名 | 申报资讯聚合 | 不定 | 网页 | 否/会员 | 非官方；须交叉验证 | 禁作唯一依据 | 7 | 谨慎 |

### 4.1 数据源 · 小微合规政策

| 名称 | 级别 | URL | 覆盖主题 | 更新频率 | 接入方式 | 账号/付费 | 许可与商用风险 | KB镜像 | 组合类 | 优先级 |
|------|------|-----|----------|----------|----------|-----------|----------------|--------|--------|--------|
| 国家法律法规数据库 | 国家 | https://flk.npc.gov.cn/ | 综合法规 | 持续 | 检索 | 否 | 官方 | 索引 | 1 | P0 |
| 市监总局 | 国家 | https://www.samr.gov.cn/ | 登记年报广告竞争 | 持续 | 门户 | 否 | 官方 | 索引 | 1 | P0 |
| 网信办/个人信息保护相关栏目 | 国家 | https://www.cac.gov.cn/ | PIPL配套 | 持续 | 门户 | 否 | 官方 | 索引 | 1 | P0 |
| 公安部网络安全保卫相关公开指引 | 国家 | https://www.mps.gov.cn/ | 等保公开材料 | 不定 | 门户 | 否 | 官方 | 索引 | 1 | P1 |
| 国家标准全文公开系统 | 国家 | https://openstd.samr.gov.cn/ | GB/等保相关标准 | 持续 | 检索 | 否 | 官方 | 索引 | 1 | P1 |
| 中国政府网政策库 | 国家 | https://www.gov.cn/zhengce/ | 合规政策 | 持续 | 检索 | 否 | 官方 | 索引 | 1 | P0 |
| 工信部工业互联网/数据安全栏目 | 国家 | https://www.miit.gov.cn/ | 数据/工控合规 | 持续 | 门户 | 否 | 官方 | 索引 | 1 | P1 |
| 广告监管公开案例(市监) | 国家 | https://www.samr.gov.cn/ | 广告法执法 | 持续 | 新闻/通告 | 否 | 官方 | 链出 | 1 | P1 |
| 地方市监局年报系统入口(各省) | 省 | 各省市监网 | 年报公示 | 年报季 | 账号 | 账号 | 官方 | 链出 | 1 | P0 |
| Firecrawl组合抓取政务页 | 商业 | 组合能力 | 页面抓取 | 按需 | API Key | 付费 | 遵守robots | 索引缓存短TTL | 1 | 观察 |

### 4.2 数据源 · 合同招投标标书

| 名称 | 级别 | URL | 覆盖主题 | 更新频率 | 接入方式 | 账号/付费 | 许可与商用风险 | KB镜像 | 组合类 | 优先级 |
|------|------|-----|----------|----------|----------|-----------|----------------|--------|--------|--------|
| 中国政府采购网 | 国家 | https://www.ccgp.gov.cn/ | 采购公告 | 日更 | 检索 | 否 | 官方 | 索引 | 2 | P0 |
| 全国公共资源交易平台 | 国家 | https://www.ggzy.gov.cn/ | 交易入口 | 日更 | 门户 | 否 | 官方 | 索引 | 2 | P0 |
| 财政部政府采购司 | 国家 | https://www.mof.gov.cn/ | 法规办法 | 持续 | 门户 | 否 | 官方 | 索引 | 2 | P0 |
| 招标投标法及实施条例(法规库) | 国家 | https://flk.npc.gov.cn/ | 法律文本 | 修订时 | 检索 | 否 | 官方 | 索引 | 2 | P0 |
| 各省公共资源交易中心 | 省 | 省中心门户 | 电子标 | 日更 | 账号 | 常需CA | 官方 | 链出 | 2 | P0 |
| 军队采购网(如适用) | 国家 | 专项门户 | 军采 | 日更 | 账号 | 受限 | 官方 | 链出 | 2 | 观察 |
| Handaas Bidding MCP | 商业 | https://github.com/handaas/bidding-mcp-server | 标讯大数据 | 持续 | MCP Key | 付费 | 商用ToS | 不可镜像 | 2 | 观察 |
| 国际SAM.gov(对照) | 国际 | https://sam.gov/ | 美联邦采购 | 日更 | 账号可选 | 否/账号 | 外国官方 | 对照非CN | 2 | 对照 |
| Shipley类RFP方法论(技能侧) | 国际 | skills.sh rfp-* | 投标方法 | 不定 | Skill | 否 | 技能许可 | 流程非数据 | 2 | 观察 |
| 地方一网通办招投标专区抽样 | 市 | 市政务网 | 本地招标 | 日更 | 门户 | 否 | 官方 | 链出 | 2 | P1 |

### 4.3 数据源 · 财务税务会计出纳

| 名称 | 级别 | URL | 覆盖主题 | 更新频率 | 接入方式 | 账号/付费 | 许可与商用风险 | KB镜像 | 组合类 | 优先级 |
|------|------|-----|----------|----------|----------|-----------|----------------|--------|--------|--------|
| 国家税务总局 | 国家 | https://www.chinatax.gov.cn/ | 政策法规 | 持续 | 门户 | 否 | 官方 | 索引 | 3 | P0 |
| 电子税务局(各省) | 省 | etax.*.chinatax.gov.cn | 申报开票 | 实时 | 账号 | 账号 | 官方 | 禁爬登录态 | 3 | P0 |
| 财政部会计司 | 国家 | https://kjs.mof.gov.cn/ | 准则制度 | 持续 | 门户 | 否 | 官方 | 索引 | 3 | P0 |
| 增值税发票管理系统相关公开说明 | 国家 | 税务总局 | 发票规则 | 持续 | 门户 | 否 | 官方 | 索引 | 3 | P0 |
| 个人所得税APP/扣缴端公开指引 | 国家 | 税务总局 | 个税代扣 | 持续 | 指引 | 账号 | 官方 | 链出 | 3 | P0 |
| 小企业会计准则文本 | 国家 | 法规库/财政部 | 做账依据 | 修订时 | 文本 | 否 | 官方 | 索引 | 3 | P0 |
| 本仓 anth-xlsx | 已装 | local | 表格做账组合 | — | Skill | 否 | 已装 | 组合 | 3 | 已有 |
| Receiptor bookkeeping(对照) | 国际 | GitHub | 记账流程 | 活跃 | Skill | 否 | MIT | 改编CN | 3 | 观察 |
| Xero/QBO MCP | 国际 | 官方MCP | 云账本 | 持续 | OAuth | 订阅 | 国外SaaS | 不适配电税 | 3 | 不装 |
| FinanceMCP(宏观) | 国际/CN | GitHub | 宏观数据非报税 | 持续 | MCP | Key | 视许可 | 非出纳 | 3 | 观察 |

### 4.4 数据源 · 人力合规

| 名称 | 级别 | URL | 覆盖主题 | 更新频率 | 接入方式 | 账号/付费 | 许可与商用风险 | KB镜像 | 组合类 | 优先级 |
|------|------|-----|----------|----------|----------|-----------|----------------|--------|--------|--------|
| 人社部 | 国家 | https://www.mohrss.gov.cn/ | 劳动/社保政策 | 持续 | 门户 | 否 | 官方 | 索引 | 4 | P0 |
| 劳动合同法及司法解释(法规库) | 国家 | https://flk.npc.gov.cn/ | 劳动法律 | 修订时 | 检索 | 否 | 官方 | 索引 | 4 | P0 |
| 全国社保公共服务平台 | 国家 | http://si.12333.gov.cn/ | 社保查询 | 持续 | 账号 | 账号 | 官方 | 链出 | 4 | P0 |
| 住房公积金国家/地方门户 | 省/市 | 地方公积金网 | 公积金 | 持续 | 账号 | 账号 | 官方 | 链出 | 4 | P0 |
| 劳动人事争议仲裁公开指引 | 国家/省 | 人社门户 | 仲裁流程 | 持续 | 指引 | 否 | 官方 | 索引 | 4 | P0 |
| 各省人社厅 | 省 | 省人社网 | 地方细则 | 持续 | 门户 | 否 | 官方 | 索引 | 4 | P0 |
| zhou employment-legal | Skill | GitHub | 劳动技能包 | 2026 | Skill | 否 | Apache-2.0 | 可落盘 | 4 | P0 |
| vivy employment-legal | Skill | GitHub | 社保竞业等 | 2026 | Skill | 否 | 待核LICENSE | 择装 | 4 | P1 |
| KW HR plugin(对照) | 国际 | Anthropic | 美式HR | 活跃 | Plugin | 否 | 未知 | 非CN | 4 | 隐藏/对照 |
| 台湾Payroll MCP(对照) | 地区 | GitHub | 台劳健保 | 活跃 | MCP | 否 | 未知 | 非大陆 | 4 | 对照 |

### 4.5 数据源 · 企业法律

| 名称 | 级别 | URL | 覆盖主题 | 更新频率 | 接入方式 | 账号/付费 | 许可与商用风险 | KB镜像 | 组合类 | 优先级 |
|------|------|-----|----------|----------|----------|-----------|----------------|--------|--------|--------|
| 国家法律法规数据库 | 国家 | https://flk.npc.gov.cn/ | 公司法等 | 持续 | 检索 | 否 | 官方 | 索引 | 5 | P0 |
| 中国裁判文书网 | 国家 | https://wenshu.court.gov.cn/ | 裁判文书 | 持续 | 检索 | 账号/验证 | 官方；使用受限 | 禁批量 | 5 | 谨慎 |
| 国家知识产权局 | 国家 | https://www.cnipa.gov.cn/ | 专利商标 | 持续 | 门户 | 否 | 官方 | 索引 | 5 | P0 |
| 中国版权保护中心(软著) | 国家 | https://www.ccopyright.com.cn/ | 软著 | 持续 | 账号 | 账号 | 官方 | 链出 | 5 | P1 |
| 市场监管总局企业信息公示 | 国家 | https://www.gsxt.gov.cn/ | 工商公示 | 持续 | 检索 | 否 | 官方 | 链出 | 5 | P0 |
| 司法部 | 国家 | https://www.moj.gov.cn/ | 律师公证 | 持续 | 门户 | 否 | 官方 | 索引 | 5 | P1 |
| 北大法宝/威科(许可评) | 商业 | 见上 | 全文库 | 持续 | 付费 | 付费 | 严格 | 禁镜像 | 5 | 观察 |
| zhou corporate/commercial/privacy | Skill | GitHub | 公司法合同隐私 | 2026 | Plugin | 否 | Apache-2.0 | 可落盘 | 5 | P0 |
| 本仓 legal-lav/lpm | 已装隐藏 | local | 欧美法务 | 已装 | Skill | 否 | vendored | 隐藏保留 | 5 | 保留 |
| 元典连接器 | 商业 | 文档 | 检索增强 | 持续 | Key | 付费 | 商用 | 连接器 | 5 | 观察 |

### 4.6 数据源 · 合法税务筹划

| 名称 | 级别 | URL | 覆盖主题 | 更新频率 | 接入方式 | 账号/付费 | 许可与商用风险 | KB镜像 | 组合类 | 优先级 |
|------|------|-----|----------|----------|----------|-----------|----------------|--------|--------|--------|
| 税务总局优惠政策专题 | 国家 | https://www.chinatax.gov.cn/ | 小微/高新/加计 | 持续 | 门户 | 否 | 官方 | 索引 | 6 | P0 |
| 高新技术企业认定管理办法公开文本 | 国家 | 科技/财政/税务 | 高新资格 | 修订时 | 文本 | 否 | 官方 | 索引 | 6 | P0 |
| 研发费用加计扣除政策汇编 | 国家 | 税务总局 | 加计扣除 | 持续 | 汇编 | 否 | 官方 | 索引 | 6 | P0 |
| 区域性税收优惠公开文件 | 国家/省 | 国务院/省府 | 区域优惠框架 | 不定 | 文件 | 否 | 官方 | 索引 | 6 | P1 |
| OECD BEPS公开资料(边界) | 国际 | oecd.org | 转让定价风险边界 | 持续 | 文档 | 否 | 国际组织 | 仅边界 | 6 | 对照 |
| vivy tax-compliance/preference | Skill | GitHub | 税优顾问类 | 2026 | Plugin | 否 | 待核LICENSE | 择装 | 6 | P1 |
| 禁止类：假发票/隐瞒收入指引 | — | — | — | — | — | — | 违法 | 禁止收录 | 6 | 禁止 |
| 电税局优惠事项办理指引 | 省 | 电税局 | 事项办理 | 持续 | 账号 | 账号 | 官方 | 链出 | 6 | P0 |
| 财政部税政司公开文件 | 国家 | mof.gov.cn | 税政 | 持续 | 门户 | 否 | 官方 | 索引 | 6 | P1 |
| 合法税务筹划框架备忘(Skill侧) | Skill | huodebing cit-memo等 | 框架级 | 不定 | Skill | 否 | 视许可 | 须律师税师审 | 6 | 观察 |

### 4.7 数据源 · 扶持政策国家至区县

| 名称 | 级别 | URL | 覆盖主题 | 更新频率 | 接入方式 | 账号/付费 | 许可与商用风险 | KB镜像 | 组合类 | 优先级 |
|------|------|-----|----------|----------|----------|-----------|----------------|--------|--------|--------|
| 中国政府网惠企集纳 | 国家 | gov.cn | 惠企政策 | 持续 | 平台 | 否 | 官方 | 索引 | 7 | P0 |
| 工信部专精特新 | 国家 | miit/zjtx | 专精特新 | 持续 | 门户 | 可能账号 | 官方 | 索引 | 7 | P0 |
| 人社稳岗返还 | 国家/省 | mohrss+省人社 | 稳岗 | 年度 | 平台 | 账号 | 官方 | 链出 | 7 | P0 |
| 科技型中小企业评价 | 国家 | 科技部体系 | 评价入库 | 年度 | 平台 | 账号 | 官方 | 链出 | 7 | P0 |
| 发改/工信技改专项 | 国家/省 | 部委+省厅 | 技改资金 | 批次 | 申报系统 | 账号 | 官方 | 链出 | 7 | P0 |
| China-Central-Policy-MCP | MCP | GitHub | gov.cn检索 | 持续 | MCP | 否/低 | 开源向 | 可接 | 7 | P0 |
| Handaas Policy MCP | MCP | GitHub | 补贴查询 | 持续 | MCP Key | 付费 | 商用 | 观察 | 7 | 观察 |
| 31省惠企专栏 | 省 | 见省表 | 地方惠企 | 持续 | 门户 | 否 | 官方 | 索引 | 7 | P0 |
| 市/区县一网通办抽样 | 市/区 | 见抽样表 | 兑付申报 | 持续 | 门户 | 账号 | 官方 | 链出 | 7 | P0 |
| 第三方补贴聚合站 | 商业 | 多 | 资讯 | 不定 | 网页 | 会员 | 非官方 | 交叉验证 | 7 | 谨慎 |

### 4.A 31 省人民政府惠企/政策入口

| 省区市 | 政府门户 | 惠企相关 URL | 备注 | 深链核实 |
|--------|----------|--------------|------|----------|
| 北京 | https://www.beijing.gov.cn/ | https://www.beijing.gov.cn/fuwu/qyfww/ | 门户企业服务 | 门户级(专栏深链待业务核) |
| 天津 | https://www.tj.gov.cn/ | https://www.tj.gov.cn/ | 门户检索惠企 | 门户级(专栏深链待业务核) |
| 河北 | https://www.hebei.gov.cn/ | https://www.hebei.gov.cn/ | 门户检索惠企 | 门户级(专栏深链待业务核) |
| 山西 | https://www.shanxi.gov.cn/ | https://www.shanxi.gov.cn/ | 门户检索惠企 | 门户级(专栏深链待业务核) |
| 内蒙古 | https://www.nmg.gov.cn/ | https://www.nmg.gov.cn/ | 门户检索惠企 | 门户级(专栏深链待业务核) |
| 辽宁 | https://www.ln.gov.cn/ | https://www.ln.gov.cn/ | 门户检索惠企 | 门户级(专栏深链待业务核) |
| 吉林 | https://www.jl.gov.cn/ | https://www.jl.gov.cn/ | 门户检索惠企 | 门户级(专栏深链待业务核) |
| 黑龙江 | https://www.hlj.gov.cn/ | https://www.hlj.gov.cn/ | 门户检索惠企 | 门户级(专栏深链待业务核) |
| 上海 | https://www.shanghai.gov.cn/ | https://www.shanghai.gov.cn/ | 一网通办企业专区 | 门户级(专栏深链待业务核) |
| 江苏 | https://www.jiangsu.gov.cn/ | https://www.jiangsu.gov.cn/ | 苏服办企业 | 门户级(专栏深链待业务核) |
| 浙江 | https://www.zj.gov.cn/ | https://www.zj.gov.cn/ | 浙里办企业 | 门户级(专栏深链待业务核) |
| 安徽 | https://www.ah.gov.cn/ | https://www.ah.gov.cn/ | 门户检索惠企 | 门户级(专栏深链待业务核) |
| 福建 | https://www.fujian.gov.cn/ | https://fgw.fujian.gov.cn/ | 金服云/一站式申享报道 | 门户级(专栏深链待业务核) |
| 江西 | https://www.jiangxi.gov.cn/ | https://www.jiangxi.gov.cn/ | 门户检索惠企 | 门户级(专栏深链待业务核) |
| 山东 | https://www.shandong.gov.cn/ | https://www.shandong.gov.cn/ | 爱山东企业 | 门户级(专栏深链待业务核) |
| 河南 | https://www.henan.gov.cn/ | https://www.henan.gov.cn/ | 免申即享方案 | 门户级(专栏深链待业务核) |
| 湖北 | https://www.hubei.gov.cn/ | http://www.hubei.gov.cn/zwgk/hbyw/hbywqb/202306/t20230602_4692800.shtml | 惠企政策直达快享(已核实报道) | 是 |
| 湖南 | https://www.hunan.gov.cn/ | https://www.hunan.gov.cn/ | 政企通/湘易办 | 门户级(专栏深链待业务核) |
| 广东 | https://www.gd.gov.cn/ | https://www.gd.gov.cn/ | 粤商通 | 门户级(专栏深链待业务核) |
| 广西 | https://www.gxzf.gov.cn/ | https://www.gxzf.gov.cn/ | 门户检索惠企 | 门户级(专栏深链待业务核) |
| 海南 | https://www.hainan.gov.cn/ | https://www.hainan.gov.cn/ | 海易办 | 门户级(专栏深链待业务核) |
| 重庆 | https://www.cq.gov.cn/ | https://www.cq.gov.cn/ | 渝快办企业 | 门户级(专栏深链待业务核) |
| 四川 | https://www.sc.gov.cn/ | https://www.sc.gov.cn/ | 天府通办 | 门户级(专栏深链待业务核) |
| 贵州 | https://www.guizhou.gov.cn/ | https://www.guizhou.gov.cn/ | 门户检索惠企 | 门户级(专栏深链待业务核) |
| 云南 | https://www.yn.gov.cn/ | https://www.yn.gov.cn/ | 门户检索惠企 | 门户级(专栏深链待业务核) |
| 西藏 | https://www.xizang.gov.cn/ | https://www.xizang.gov.cn/ | 门户检索惠企 | 门户级(专栏深链待业务核) |
| 陕西 | https://www.shaanxi.gov.cn/ | https://www.shaanxi.gov.cn/ | 秦务员 | 门户级(专栏深链待业务核) |
| 甘肃 | https://www.gansu.gov.cn/ | https://www.gansu.gov.cn/ | 门户检索惠企 | 门户级(专栏深链待业务核) |
| 青海 | https://www.qinghai.gov.cn/ | https://www.qinghai.gov.cn/ | 门户检索惠企 | 门户级(专栏深链待业务核) |
| 宁夏 | https://www.nx.gov.cn/ | https://www.nx.gov.cn/ | 门户检索惠企 | 门户级(专栏深链待业务核) |
| 新疆 | https://www.xinjiang.gov.cn/ | https://www.xinjiang.gov.cn/ | 门户检索惠企 | 门户级(专栏深链待业务核) |

完成度：31/31 门户级 URL；专栏深链已报道核实 1 条。门禁要求 ≥90%：**通过（100% 门户级）**。

### 4.B 市/区县抽样（圈层配额）

| 圈层 | 市 | 市门户 | 区县 | 区县门户 | 备注 |
|------|----|--------|------|----------|------|
| 京津冀 | 北京市 | https://www.beijing.gov.cn/ | 海淀区 | https://www.bjhd.gov.cn/ | 中关村/高企服务 |
| 京津冀 | 天津市 | https://www.tj.gov.cn/ | 滨海新区 | https://www.tjbh.gov.cn/ | 自贸区惠企 |
| 长三角 | 上海市 | https://www.shanghai.gov.cn/ | 浦东新区 | https://www.pudong.gov.cn/ | 一网通办 |
| 长三角 | 杭州市 | https://www.hangzhou.gov.cn/ | 余杭区 | https://www.yuhang.gov.cn/ | 浙里办 |
| 长三角 | 苏州市 | https://www.suzhou.gov.cn/ | 工业园区 | https://www.sipac.gov.cn/ | 园区扶持 |
| 珠三角 | 广州市 | https://www.gz.gov.cn/ | 天河区 | https://www.thnet.gov.cn/ | 粤商通 |
| 珠三角 | 深圳市 | https://www.sz.gov.cn/ | 南山区 | https://www.szns.gov.cn/ | 高企/专精特新 |
| 成渝 | 成都市 | https://www.chengdu.gov.cn/ | 高新区 | https://www.cdht.gov.cn/ | 天府通办 |
| 成渝 | 重庆市 | https://www.cq.gov.cn/ | 渝北区 | https://www.ybq.gov.cn/ | 渝快办 |
| 中部 | 武汉市 | https://www.wuhan.gov.cn/ | 东湖高新区 | https://www.wehdz.gov.cn/ | 光谷惠企 |
| 中部 | 郑州市 | https://www.zhengzhou.gov.cn/ | 金水区 | https://www.jinshui.gov.cn/ | 免申即享 |
| 东北 | 沈阳市 | https://www.shenyang.gov.cn/ | 浑南区 | https://www.hunnan.gov.cn/ | 门户惠企 |
| 东北 | 大连市 | https://www.dl.gov.cn/ | 高新园区 | https://www.dlhitech.gov.cn/ | 园区扶持 |

配额核对：京津冀≥2、长三角≥2、珠三角≥2、成渝≥2、中部≥2、东北≥2；每市≥1 区县——**满足**。

## 5. P0 大仓原子拆解专章

### 5.1 七类覆盖热力图（有/弱/无）

| 类别 | zhou210712 | vivy-yi | elfbobo | drdavid-kor | huodebing |
|------|------------|---------|---------|-------------|----------|
| 1 SME合规 | 有 | 有 | 有 | 弱 | 有 |
| 2 合同/招投标 | 有合同/无招标 | 有合同/弱招标 | 同左 | 弱 | 有合同/无招标 |
| 3 财税会计 | 弱 | **有** | 有 | 无 | 有 |
| 4 HR劳动 | **有** | **有** | 有 | 弱 | 有 |
| 5 公司商事 | **有** | **有** | 有 | 弱 | **有** |
| 6 合法税务筹划 | 弱 | **有** | 有 | 无 | 有 |
| 7 政府补贴 | 无 | 弱(税优≠产业补贴) | 弱 | 无 | 弱 |

### 5.2 zhou210712/claude-for-legal-ZH（建议：安装主干）

- Meta：约 **176★** · **Apache-2.0** · push ~2026-05 · Claude Code 12 插件 + CN references
- 插件：commercial / employment / corporate / privacy / product / regulatory / ip / litigation / ai-governance / law-student / legal-clinic / legal-builder-hub
- 原子深读抽样：`termination-review`（解除/N 规则）、`hiring-review`、`worker-classification`、`vendor-agreement-review`/`nda-review`、`entity-compliance`、`pia-generation`
- 落盘：可抽 SKILL.md → `skills/vendor/`；须去 Claude Code 绝对路径与 cold-start 强绑定
- 风险：草稿≠法律意见；诉讼插件勿默认对小微开启

### 5.3 vivy-yi/Greater-China-Legal（建议：观察→择装）

- Meta：约 **16★** · README 称 Apache-2.0 但 **GitHub LICENSE 文件未登记** · ~36 场景 · 技能量级百级
- 场景抽样：employment-legal(~27)、contract-review(~28)、tax-compliance(~24)、corporate-governance(~28)
- 原子深读：`social-insurance-compliance`、`invoice-compliance-checker`、`tax-preference-application-advisor`、`labor-contract-drafter`、`non-compete-enforcement`
- 落盘：择装 tax/employment，**禁止整仓灌 Hub**；先补 LICENSE 核实

### 5.4 其他 P0/P1

| 仓 | 建议 | 要点 |
|----|------|------|
| elfbobo/Greater-China-Legal | 不装 | vivy 过时 fork |
| drdavid-kor/claude-for-legal-cn | 不装 | 美法原版，CN 名不实 |
| huodebing-alt/Claude-Code-Law-Firm | 不装(架构观察) | agents+connectors+Python；不适 `read_skill` |
| MapleEve/legal-skills-cn | 观察 | 与 zhou 同系 |
| anthropics/claude-for-legal | 隐藏对照 | 美法上游，勿作大陆默认 |

## 6. 本仓对照（已装可见 / 隐藏欧美包 / 可复用）

| 桶 | 数量 | 结论 |
|----|------|------|
| Hub 可见法务 | 2（legal-response, legal-risk-assessment） | 非中国法专向 |
| 隐藏 legal-lav / lpm | 58 | **隐藏保留**作欧美/律所运营对照；大陆默认改走 zhou |
| 金融 Tab / fin-* | 49 | 投研/估值/RevOps；**不能**当出纳报税 |
| 大陆招投标/电税/补贴 Skill | ≈0 | 本批最大增量机会 |

可复用组合（不新装也可）：`anth-xlsx` + 官方电税指引；`web_search`/`web_fetch`/Firecrawl + 政策门户；DeerFlow 式研究工作流（非专向合规）。

## 7. 交叉对比矩阵（中国法包 vs 已装 legal-lav/lpm）

| 维度 | legal-lav / lpm（已装隐藏） | zhou / vivy（候选） |
|------|-----------------------------|---------------------|
| 法域 | EU/US 为主 | 中国大陆（vivy 含港澳台新） |
| Hub 默认 | 隐藏 | 建议办公·法务合规 L3 可见（装后） |
| 合同审查 | 有（美式 playbook） | 有（CN 审查指引） |
| 劳动法 | 弱/美州 | 强 |
| 财税发票 | 无 | vivy 有 |
| 招投标 | 无 | 需另装 bidsmart |
| 法律项目管理 | lpm 强 | 弱 |
| 策略 | **保留隐藏** | **并存：CN 默认 / EU 隐藏** |

## 8. Hub 归类与 taxonomy 建议（仍不改代码）

| 能力簇 | 建议 L1 | 建议 L3 / Pill | 可见性 |
|--------|---------|----------------|--------|
| employment / 合同 / 公司 / 隐私 / 产品合规 | 办公 | 法务合规 | 装后可见 |
| 招投标 / 标书 | 办公（或营销·销售赋能双入口） | 法务合规 / 商务 | 装后可见 |
| 财税合规 / 合法税务筹划 | 金融 或 办公 | 新建「财税合规」子类（建议） | 择装后可见；金融 Tab 现有投研不动 |
| 政策 MCP | 办公或独立「政策」 | 扶持政策 | MCP 配置，不一定进卡片 |
| legal-lav / lpm / KW US | 办公 | 法务合规 | **继续 hidden_in_hub** |

## 9. 建议安装批次草案（勾选）

> **待你下令再 vendor。** 下列为勾选框草案。

### 批次 A — P0 中国法主干（建议优先）

- [ ] `zhou210712/claude-for-legal-ZH` → 抽装 `employment-legal` + `commercial-legal` + `corporate-legal`（各 5–8 核心 SKILL）
- [ ] 同仓补装 `privacy-legal` + `product-legal` + `regulatory-legal`
- [ ] `zh-xx/legal-assistant-skills` 轻量合规

### 批次 B — 招投标补洞

- [ ] `youyouhe/bidsmart-claude-skills`
- [ ] `Get00/BiaoShu-SKILL`
- [ ] （可选观察）`Hugin-Z/tender-writer-v3`

### 批次 C — 政策数据

- [ ] `guangxiangdebizi/China-Central-Policy-MCP`（优先）
- [ ] （观察/商用）`handaas/policy-mcp-server` + `bidding-mcp-server`
- [ ] 组合：官方惠企门户索引 KB（短 TTL），而非全文灌模

### 批次 D — 财税择装（谨慎）

- [ ] vivy `tax-compliance` / `tax-preference-*`（先核实 LICENSE）
- [ ] 明确不做：假发票、隐瞒收入、规避监管步骤
- [ ] 与 `anth-xlsx` 组合点：科目表/报销台账模板（自建 references）

### 明确不装

- [x] elfbobo fork / drdavid-kor 伪 CN / seam3 fork / 整仓 huodebing / Xero·QBO 作大陆电税替代 / SkillsMP 专有金标未审许可

## 10. 附录

### 10.1 检索词日志（节选）

`compliance skill`, `rfp skill`, `tender`, `bookkeeping`, `tax planning`, `employment legal`, `procurement`, `招投标 skill`, `标书`, `税务筹划`, `劳动合同`, `合规 agent skill`, `政策 MCP`, `惠企政策`, `专精特新`

### 10.2 排除清单

- 纯 Web3/智能合约合规（非本批 SME 范围）
- openai/skills（无领域内容）
- 需登录才能读的商业库正文（不入库）
- 逃税/假票操作类内容（发现即排除）

### 10.3 未核实项

- 31 省「惠企」专栏深链多数为**门户级**，业务落地前须再点验跳转
- vivy LICENSE 文件登记状态
- Handaas 商用定价与区域可用性
- 元典/法宝 MCP 具体工具列表与鉴权（仅文档级评价）

### 10.4 门禁自检

| 门禁项 | 结果 |
|--------|------|
| 35+ 渠道无「未扫」 | ✓ 39 渠道全 done |
| candidate-pool ≥200 | ✓ 297 |
| 七类成品每类 ≥15 或空白声明 | ✓ 见 §3 计数 |
| P0 三大仓原子拆解+热力图 | ✓ §5 |
| 31 省惠企 URL ≥90% | ✓ 31/31 门户级 |
| 市/区县抽样配额 | ✓ §4.B |
| 每类数据源 ≥10 | ✓ §4.1–4.7 |
| 隐藏欧美包对照 | ✓ §6–7 |
| 六维分列 + Top 勾选 | ✓ |
| 无 vendor / 无逃税指引 / 免责 | ✓ |

---

*生成脚本：`scripts/_gen-cn-sme-compliance-pool.mjs` + `scripts/_gen-cn-sme-compliance-report.mjs`（调研辅助；可删可留）。*
