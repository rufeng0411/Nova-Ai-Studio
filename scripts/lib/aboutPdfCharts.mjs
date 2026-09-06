/**
 * Per-document visual enrichments for /about PDFs (HTML blocks + mermaid).
 */

const STATS_BAR = `
<div class="stats-bar">
  <div class="stat"><span class="stat-val">400+</span><span class="stat-lbl">即用能力</span></div>
  <div class="stat"><span class="stat-val">6</span><span class="stat-lbl">营销飞轮阶段</span></div>
  <div class="stat"><span class="stat-val">~30</span><span class="stat-lbl">流程模板</span></div>
  <div class="stat"><span class="stat-val">≈70%</span><span class="stat-lbl">Token 节省</span></div>
  <div class="stat"><span class="stat-val">150</span><span class="stat-lbl">设计系统</span></div>
</div>`;

const CHARTS = {
  'README.md': {
    before: STATS_BAR,
  },
  'brand/品牌手册.md': {
    cover: true,
    before: `
<div class="color-palette">
  <div class="swatch" style="background:#1a202c"><span>主文字</span></div>
  <div class="swatch" style="background:#2d3748"><span>石墨主色</span></div>
  <div class="swatch" style="background:#4a5568"><span>层次灰</span></div>
  <div class="swatch" style="background:#edf2f7"><span>浅底分层</span></div>
  <div class="swatch" style="background:#f8fafc;border:1px solid #e2e8f0"><span>页面底</span></div>
</div>`,
  },
  'brand/信息屋-messaging-house.md': {
    before: `
<div class="mermaid">
flowchart TB
  L1["L1 品牌承诺\n用对话完成复杂项目"]
  L2A["营销飞轮闭环"]
  L2B["400+ 能力即用"]
  L2C["企业 SaaS 可部署"]
  L3["证据：路由省 Token · GEO · 云端隔离"]
  L1 --> L2A & L2B & L2C
  L2A & L2B & L2C --> L3
</div>`,
  },
  'product/产品总览-one-pager.md': {
    before: STATS_BAR,
  },
  'product/价值主张与八大亮点.md': {
    before: `
<div class="highlight-grid">
  <div class="hcard"><span class="num">01</span><strong>对话交付项目</strong></div>
  <div class="hcard"><span class="num">02</span><strong>智能路由省 Token</strong></div>
  <div class="hcard"><span class="num">03</span><strong>营销飞轮六阶段</strong></div>
  <div class="hcard"><span class="num">04</span><strong>调研与获客</strong></div>
  <div class="hcard"><span class="num">05</span><strong>400+ 能力</strong></div>
  <div class="hcard"><span class="num">06</span><strong>模型一池统管</strong></div>
  <div class="hcard"><span class="num">07</span><strong>近 30 条模板</strong></div>
  <div class="hcard"><span class="num">08</span><strong>企业级安全</strong></div>
</div>`,
  },
  'product/功能支柱-deep-dive.md': {
    before: `
<div class="mermaid">
flowchart LR
  R[调研] --> S[策划] --> C[创意] --> T[触达] --> P[发布] --> M[监测]
</div>`,
  },
  'product/单机版与SaaS版对照.md': {
    before: `
<div class="dual-track">
  <div class="track"><h4>单机版</h4><p>本地完整编辑 · 开发者自由</p></div>
  <div class="track saas"><h4>SaaS 版</h4><p>多租户云端 · 运营可管</p></div>
</div>`,
  },
  'market/目标市场与细分.md': {
    before: `
<div class="mermaid">
flowchart TB
  TAM["TAM 营销科技 + 生成式 AI 内容"]
  SAM["SAM 项目型 Agent 营销团队"]
  SOM["SOM 10–50 人团队 · 工作室 · 私有化"]
  TAM --> SAM --> SOM
</div>`,
  },
  'market/竞品与差异化矩阵.md': {
    landscape: true,
  },
  'business/上市路线三阶段.md': {
    before: `
<div class="mermaid">
flowchart LR
  P1["阶段1\n私有部署"] --> P2["阶段2\n内测 SaaS"] --> P3["阶段3\n全托管公网"]
</div>`,
  },
  'business/商业模式与套餐.md': {
    before: `
<div class="pricing-tiers">
  <div class="tier"><h4>免费版</h4><p>体验 · 获客</p></div>
  <div class="tier"><h4>个人 Pro</h4><p>¥99–199/月</p></div>
  <div class="tier featured"><h4>团队版</h4><p>按席 · 积分池</p></div>
  <div class="tier"><h4>企业私有</h4><p>年付定制</p></div>
</div>`,
  },
  'sales/四列产品对照表.md': {
    landscape: true,
  },
  'sales/销售指导手册.md': {
    cover: true,
    before: `
<div class="mermaid">
flowchart TB
  subgraph 获客
    CH1[转介绍] --> CH2[活动/内容]
    CH2 --> CH3[Outbound]
  end
  subgraph 转化
    L[线索分级] --> B[破冰]
    B --> D[分层演示]
    D --> P[POC]
    P --> C[签约]
  end
  获客 --> 转化
</div>
<div class="highlight-grid">
  <div class="hcard"><span class="num">L0</span><strong>未觉醒</strong><br/>成果预览</div>
  <div class="hcard"><span class="num">L1</span><strong>工具试用</strong><br/>项目文件夹</div>
  <div class="hcard"><span class="num">L2</span><strong>流程意识</strong><br/>飞轮+模板</div>
  <div class="hcard"><span class="num">L3</span><strong>采购评估</strong><br/>POC+差异化</div>
</div>`,
  },
  'sales/私有化与企业政务销售手册.md': {
    cover: true,
    before: `
<div class="dual-track">
  <div class="track"><h4>私有 SaaS</h4><p>多租户 · 审计 · 内网 Docker</p></div>
  <div class="track saas"><h4>政企定制</h4><p>模板 · 技能 · SSO · 国产池</p></div>
</div>
<div class="mermaid">
flowchart LR
  Q[需求澄清] --> A[IT+业务拜访]
  A --> P[私有 POC]
  P --> B[招标/商务]
  B --> D[实施验收]
</div>`,
  },
  'business/风险与合规摘要.md': {
    before: `
<div class="risk-matrix-legend">
  <span class="risk-high">高</span> 沙箱 · 数据
  <span class="risk-mid">中</span> 成本波动 · 合规
</div>`,
  },
};

/** @param {string} relPath forward-slash relative path from about/ */
export function getChartEnrichment(relPath) {
  const key = relPath.replace(/\\/g, '/');
  return CHARTS[key] ?? {};
}
