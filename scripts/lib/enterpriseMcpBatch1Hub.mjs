/**
 * PD-SAAS-FORK: 企业 MCP 首批 Hub 虚拟卡 + try-prompt（与 mcpFeatureFlags 六键对齐）
 * 默认 flag=off 时 Hub 过滤后不可见；capabilities:gen 仍写入 catalog。
 */

const SETUP_ADMIN =
  '后台 → 平台设置 → 功能开关 →「企业 MCP」将该项设为 shadow/enforce，并在 MCP 配置写入凭据（见 products/_example/config/mcp.json.example 与 docs/enterprise-mcp-batch1-admin-setup.zh-CN.md）。';

function tryPrompt(title, doing, fills, prepare, get, deliver) {
  return [
    title,
    '',
    `【你在做什么】${doing}`,
    '',
    '【请填写】（不知道就写「不清楚」，不要空着）',
    ...fills,
    '',
    `【请准备】${prepare}`,
    '',
    `【你会得到】${get}`,
    '',
    `须交付：${deliver}。`,
    '写入系统分配任务目录。',
    '若该 MCP 未在后台启用或未配置凭据，请明确说明「未启用/未配置」，禁止假装已查到账套数据。',
  ].join('\n');
}

export const ENTERPRISE_MCP_BATCH1_TRY_PROMPTS = {
  'mcp-cn-erp': tryPrompt(
    '用「企业 ERP 查询」帮我查经营数据（订单/库存/应收应付）。',
    '在已启用且已配置的 ERP（金蝶或用友）中做只读查询，整理成可读摘要。',
    [
      '- 要查什么：【如：上月应收、低库存、待审销售订单】',
      '- 时间范围：【如：本月 / 上月】',
      '- ERP 类型（若已知）：【金蝶 / 用友 / 不清楚】',
    ],
    '需管理员已启用「企业 ERP 查询」并配置账套凭据；本对话默认只读，不要审批单据。',
    '一份查询摘要（含关键单据号/金额/状态），标明数据来自 ERP 查询而非猜测。',
    'ERP查询摘要.md',
  ),
  'mcp-kingdee-k3': tryPrompt(
    '用「金蝶云星空」帮我按单据类型查询或导出单据。',
    '在只读模式下查询金蝶单据（如销售订单），必要时导出到任务目录。',
    [
      '- 单据类型/form_id：【如：SAL_SaleOrder / 不清楚】',
      '- 筛选条件：【如：本月、客户名】',
      '- 只要摘要还是要导出文件：【摘要 / 导出】',
    ],
    '需管理员启用「金蝶云星空」且 MCP 为 readonly；禁止保存/审核/下推。',
    '查询结果摘要或任务目录内导出文件路径。',
    '金蝶单据查询摘要.md',
  ),
  'mcp-yonyou-fin': tryPrompt(
    '用「用友做账」帮我查凭证、科目或余额表。',
    '只读查询用友财务账套数据，整理成可读摘要。',
    [
      '- 要查什么：【凭证列表 / 科目树 / 余额表 / 明细账】',
      '- 期间：【如：2026-07】',
      '- 科目或凭证号（可选）：【】',
    ],
    '需管理员启用「用友做账」并配置凭据；禁止删除凭证或擅自改科目。',
    '财务查询摘要（含关键科目/金额）。',
    '用友财务查询摘要.md',
  ),
  'mcp-tax-invoice': tryPrompt(
    '用「数电发票」帮我查询或查验发票（不开票）。',
    '经已配置的第三方数电发票服务做查询/查验，不代开票、不红冲。',
    [
      '- 操作：【查询状态 / 查验真伪】',
      '- 发票号码或税号等要素：【】',
      '- 开票方名称（可选）：【】',
    ],
    '需管理员启用「数电发票」并配置商用 Token；开票/红冲默认关闭。',
    '查验或查询结果说明（标明第三方服务）。',
    '发票查验摘要.md',
  ),
  'mcp-notion-collab': tryPrompt(
    '用「Notion 协作」把内容写入或读出我的 Notion。',
    '在已授权的 Notion 工作区读写页面或数据库行。',
    [
      '- 动作：【读取 / 新建页 / 更新数据库行】',
      '- 页面或数据库名称：【】',
      '- 要写入的要点：【】',
    ],
    '需管理员启用 Notion 协作并配置 Integration Token；不替代本系统任务成果目录。',
    '操作结果说明；若需留存可写摘要 md。',
    'Notion协作摘要.md',
  ),
  'mcp-postgres-readonly': tryPrompt(
    '用「Postgres 只读」帮我查业务库表结构或只读 SQL。',
    '对客户指定的业务 PostgreSQL 做 schema 探查或 SELECT，禁止写库。',
    [
      '- 目标：【看表结构 / 跑只读查询】',
      '- 表名或问题：【如：最近 7 天订单数】',
      '- 库别名（若有）：【】',
    ],
    '需管理员启用并配置业务库只读连接串；禁止连接控制面数据库。',
    '查询结果摘要（勿贴密钥）。',
    '业务库查询摘要.md',
  ),
};

const taxCard = (hub_sort) => ({
  stage: 'office',
  major_category: 'enterprise_compliance',
  category_subtag: 'comp_tax_accounting',
  secondary_categories: ['office'],
  integration_level: 'L3',
  availability: 'needs_config',
  setup_hint: SETUP_ADMIN,
  hub_sort,
  hub_recommend_stars: 5,
});

/** @type {Array<Record<string, unknown>>} */
export const ENTERPRISE_MCP_BATCH1_VIRTUAL_CAPABILITIES = [
  {
    slug: 'mcp-cn-erp',
    display_name: '企业 ERP 查询',
    task_summary: '用自然语言查金蝶/用友里的订单、库存、应收应付与经营看板',
    description:
      '用自然语言查金蝶/用友里的订单、库存、应收应付、经营看板；可选审批。不能替代完整总账；无确认不改单据。默认只读。',
    ...taxCard(20),
    source: 'mcp:erp',
    examples: [ENTERPRISE_MCP_BATCH1_TRY_PROMPTS['mcp-cn-erp']],
  },
  {
    slug: 'mcp-kingdee-k3',
    display_name: '金蝶云星空',
    task_summary: '按单据类型查/导出金蝶单据；写操作默认关闭',
    description:
      '按单据类型查/导出大量单据；可选保存、提交、审核、下推。不能绕过金蝶账号权限。与「企业 ERP 查询」互斥；默认只读。',
    ...taxCard(21),
    source: 'mcp:kingdee',
    examples: [ENTERPRISE_MCP_BATCH1_TRY_PROMPTS['mcp-kingdee-k3']],
  },
  {
    slug: 'mcp-yonyou-fin',
    display_name: '用友做账',
    task_summary: '查凭证、科目、总账/明细账/余额；写凭证默认需确认',
    description:
      '查/管凭证、科目、总账明细账余额、币种与档案。不是进销存全模块；删凭证危险。查询默认开，保存/删除须确认。',
    ...taxCard(22),
    source: 'mcp:yonyou-fin',
    examples: [ENTERPRISE_MCP_BATCH1_TRY_PROMPTS['mcp-yonyou-fin']],
  },
  {
    slug: 'mcp-tax-invoice',
    display_name: '数电发票',
    task_summary: '查发票与查验真伪；开票/红冲默认关闭（第三方商用）',
    description:
      '经第三方商用服务查发票、查验真伪；可选开票/红冲。不是电子税务局申报。默认仅查询/查验。',
    ...taxCard(23),
    source: 'mcp:tax-invoice',
    examples: [ENTERPRISE_MCP_BATCH1_TRY_PROMPTS['mcp-tax-invoice']],
  },
  {
    slug: 'mcp-postgres-readonly',
    display_name: 'Postgres 只读',
    task_summary: '对客户业务库跑只读 SQL、看表结构',
    description:
      '对业务 PostgreSQL 做 schema 探查与只读查询。绝不连控制面库；不做 INSERT/UPDATE/DELETE。',
    stage: 'development',
    major_category: 'development',
    category_subtag: 'dev_backend',
    integration_level: 'L3',
    availability: 'needs_config',
    setup_hint: SETUP_ADMIN,
    hub_sort: 40,
    hub_recommend_stars: 4,
    source: 'mcp:postgres',
    examples: [ENTERPRISE_MCP_BATCH1_TRY_PROMPTS['mcp-postgres-readonly']],
  },
];

/** Notion 文案覆盖（已有 virtual 卡，仅加强说明） */
export const MCP_NOTION_COLLAB_HUB_PATCH = {
  display_name: 'Notion 协作',
  task_summary: '读搜写 Notion 页面与数据库',
  description:
    '把调研结论、会议纪要、任务表写入/读出客户 Notion 工作区。不替代本系统项目记忆与任务成果目录。',
  setup_hint: SETUP_ADMIN,
  examples: [ENTERPRISE_MCP_BATCH1_TRY_PROMPTS['mcp-notion-collab']],
};
