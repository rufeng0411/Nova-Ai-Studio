/**
 * PD-SAAS-FORK: 后台「插件系统」卡片文案与内部功能明细（与 enterprise-mcp-batch1-capabilities 同源）
 */
import type { Batch1McpFlagKey } from './platformFeatures';

export type PluginToolRow = {
  /** 一行标题（功能名） */
  name: string;
  /** 工具/能力标识（可选展示） */
  toolId?: string;
  /** 读 / 写 */
  access: '读' | '写' | '系统';
  /** Nova 默认：开 / 关 */
  defaultOn: boolean;
  /** 下拉明细 */
  detail: string;
};

export type PluginCardDetail = {
  id: string;
  label: string;
  /** 一句话简介（始终可见） */
  summary: string;
  /** 详细介绍（卡内展开区顶部） */
  description: string;
  canDo: string[];
  cannotDo: string[];
  tools: PluginToolRow[];
  notes?: string[];
};

export const UI_PLUGIN_CARDS: PluginCardDetail[] = [
  // N2-COMMUNITY-OVERLAY: N2 Bot admin card removed
  {
    id: 'preflightStudio',
    label: '预览模板选型（Preflight Studio）',
    summary: '用户发起网页/PPT 设计需求时，在超级预览区展示模板卡片供选择。',
    description:
      '创作前置选型插件：在超级预览分栏展示设计系统/PPT 模板缩略图与说明，确认后预填或自动发送。默认关闭；灰度=可预览选型，强制=未选型不可直接开做。',
    canDo: [
      '展示 Open Design / PPT 等模板卡片与预览图',
      '用户选定后把风格与 brief 写入对话上下文',
      '支持「不需要模板，自己输入风格」降级回输入框',
    ],
    cannotDo: [
      '不替代最终交付写盘',
      '不代替能力中心「试一下」整卡流程（可并存）',
      '环境变量覆盖时后台下拉不可改生效值',
    ],
    tools: [
      {
        name: '模板选型面板',
        access: '读',
        defaultOn: false,
        detail: '在超级预览区展示多卡网格与滤镜；用户点选一套设计系统或 PPT 风格。',
      },
      {
        name: '确认后预填/发送',
        access: '系统',
        defaultOn: false,
        detail: 'Composer 路径确认后可自动预填并发送；Hub 路径通常预填后由用户发送。',
      },
      {
        name: '自定义风格出口',
        access: '读',
        defaultOn: false,
        detail: '「不需要模板」时恢复原文到输入框并聚焦，不自动发送，避免再弹选型。',
      },
    ],
  },
  {
    id: 'bentoDeckEditor',
    label: 'Bento 演示稿编辑器',
    summary: 'Nova 可编辑演示稿（*.bento.html）在超级预览中进入所见即所得编辑。',
    description:
      '关闭时仅网页预览；开启后用户点「编辑」才加载 Bento 编辑内核，保留生成稿版式与图片。需平台开关与有效 bento 稿。',
    canDo: [
      '查看态网页预览 Bento 演示稿',
      '编辑态所见即所得改版式/内容（开关开启时）',
      '写回任务目录内合法路径',
    ],
    cannotDo: [
      '无效/缺内核时不全屏阻断，降级提示重新生成',
      '不把普通 HTML 幻灯误当 Bento',
      '查看弹层不挂载重编辑器',
    ],
    tools: [
      {
        name: '网页预览（view）',
        access: '读',
        defaultOn: true,
        detail: '默认以嵌入网页预览打开 *.bento.html，不加载完整编辑器以节省内存。',
      },
      {
        name: '所见即所得编辑（edit）',
        access: '写',
        defaultOn: false,
        detail: '仅右栏编辑模式挂载 Bento 内核；须带走生成稿样式与图片，禁止打开后版式丢失。',
      },
    ],
  },
  {
    id: 'mdBrowserTool',
    label: 'Markdown 浏览器',
    summary: '能力「我的收藏」旁插件入口；新窗口打开本地 Markdown。',
    description:
      '基于 Cherry Core 的轻量 Markdown 浏览器：从 Hub 插件入口或拖入 .md 打开，带 Nova 标识，适合快速阅读收藏文档。',
    canDo: [
      '新窗口打开并渲染 Markdown',
      '支持拖拽/上传 .md 直接解析',
      '全 UI 范围拖入均可打开（非仅编辑器内）',
    ],
    cannotDo: [
      '不替代任务成果目录与 SuperPreview 主链路',
      '不做多人协作编辑',
    ],
    tools: [
      {
        name: 'Hub 插件入口',
        access: '读',
        defaultOn: true,
        detail: '能力弹层「我的收藏」右侧插件图标，点击新窗口打开浏览器。',
      },
      {
        name: '拖拽打开 .md',
        access: '读',
        defaultOn: true,
        detail: '将 Markdown 文件拖入界面即可解析预览，无需先落盘到对话。',
      },
    ],
  },
];

export const MCP_PLUGIN_CARDS: Record<Batch1McpFlagKey, PluginCardDetail> = {
  cnErp: {
    id: 'cnErp',
    label: '企业 ERP 查询（金蝶/用友统一）',
    summary: '用自然语言查金蝶/用友里的订单、库存、应收应付、经营看板；可选审批。',
    description:
      '基于 erp-mcp：同一套工具对接金蝶云星空或用友 YonSuite（ERP_TYPE）。默认只读；审批须用户明示。与「金蝶云星空」互斥启用。',
    canDo: [
      '查销售/采购订单、发货、库存、客户、应收应付、生产工单',
      '经营看板与订单进度、待审列表',
      '列出可查表单与字段映射（排障）',
    ],
    cannotDo: [
      '不能替代财务软件做完整总账',
      '无确认不能改单据/批量乱审',
      '无账套凭据时禁止假装已查',
    ],
    notes: ['开启后仍须在「MCP 服务器」配置凭据', '与金蝶专用不可同时开启'],
    tools: [
      { name: '查销售订单', toolId: 'erp_query_sales_orders', access: '读', defaultOn: true, detail: '按条件查询销售订单列表与关键字段。' },
      { name: '查采购订单', toolId: 'erp_query_purchase_orders', access: '读', defaultOn: true, detail: '查询采购订单及状态。' },
      { name: '查发货/出库', toolId: 'erp_query_delivery', access: '读', defaultOn: true, detail: '查询发货或销售出库单据。' },
      { name: '查即时库存', toolId: 'erp_query_inventory', access: '读', defaultOn: true, detail: '查库存数量，可含低库存提示。' },
      { name: '查客户档案', toolId: 'erp_query_customers', access: '读', defaultOn: true, detail: '查询客户主数据。' },
      { name: '查应收', toolId: 'erp_query_receivables', access: '读', defaultOn: true, detail: '查询应收账款相关数据。' },
      { name: '查应付', toolId: 'erp_query_payables', access: '读', defaultOn: true, detail: '查询应付账款相关数据。' },
      { name: '查生产工单', toolId: 'erp_query_production_orders', access: '读', defaultOn: true, detail: '查询生产订单/工单。' },
      { name: '经营看板', toolId: 'erp_business_dashboard', access: '读', defaultOn: true, detail: '聚合发货、应收应付、库存预警、在产等经营指标。' },
      { name: '订单进度', toolId: 'erp_query_*_order_progress', access: '读', defaultOn: true, detail: '采购到货入库 vs 销售开票发货等进度查询。' },
      { name: '待审批列表', toolId: 'erp_query_pending_approvals', access: '读', defaultOn: true, detail: '列出待审批单据，供只读查看。' },
      { name: '审批通过/驳回', toolId: 'erp_approve_document', access: '写', defaultOn: false, detail: '写操作；上游通常要求 confirm=true。Nova 默认隐藏，须用户明示。' },
      { name: '表单列表/字段', toolId: 'erp_list_forms / erp_describe_form', access: '读', defaultOn: true, detail: '列出可查表单并描述字段映射，便于排查。' },
      { name: '自助升级包', toolId: 'erp_self_update', access: '写', defaultOn: false, detail: '升级本机 PyPI 包；生产默认关闭。' },
    ],
  },
  kingdee: {
    id: 'kingdee',
    label: '金蝶云星空（专用）',
    summary: '按单据类型查/导出大量金蝶单据；写链路默认关闭。',
    description:
      '基于 kingdee-k3cloud-mcp：通用 form_id 操作金蝶单据形态，支持大批量导出。本批强制只读模式（MCP_MODE=readonly）。与「企业 ERP 查询」互斥。',
    canDo: [
      '按条件查单据（表格/JSON）、估算行数、自动翻页取全量',
      '流式导出 ndjson/csv、按日周月分片查询',
      '查看单条详情与表单元数据',
    ],
    cannotDo: [
      '不能绕过金蝶账号权限',
      '只读模式不能保存/审核/下推',
      '不可与企业 ERP 查询同时开启',
    ],
    notes: ['配置须带 --mode readonly / MCP_MODE=readonly'],
    tools: [
      { name: '查单据（表格式）', toolId: 'query_bill', access: '读', defaultOn: true, detail: '按条件查询单据并表格化展示。' },
      { name: '查单据（JSON）', toolId: 'query_bill_json', access: '读', defaultOn: true, detail: '返回结构化 JSON，便于再处理。' },
      { name: '估算行数', toolId: 'count_bill', access: '读', defaultOn: true, detail: '大查询前探查大致行数。' },
      { name: '全量翻页查询', toolId: 'query_bill_all', access: '读', defaultOn: true, detail: '自动翻页取全量，有安全上限。' },
      { name: '导出到文件', toolId: 'query_bill_to_file', access: '读', defaultOn: true, detail: '流式导出 ndjson/csv；落盘须在任务目录。' },
      { name: '按时间分片查询', toolId: 'query_bill_range', access: '读', defaultOn: true, detail: '按日/周/月分片查询，降低超时风险。' },
      { name: '单据详情', toolId: 'view_bill', access: '读', defaultOn: true, detail: '单条单据完整详情。' },
      { name: '字段元数据', toolId: 'query_metadata', access: '读', defaultOn: true, detail: '查表单字段元数据。' },
      { name: '保存/新建单据', toolId: 'save_bill', access: '写', defaultOn: false, detail: '写操作；默认隐藏。' },
      { name: '提交审批', toolId: 'submit_bill', access: '写', defaultOn: false, detail: '写操作；默认隐藏。' },
      { name: '审核 / 反审核', toolId: 'audit_bill / unaudit_bill', access: '写', defaultOn: false, detail: '写操作；默认隐藏。' },
      { name: '删除草稿', toolId: 'delete_bill', access: '写', defaultOn: false, detail: '写操作；默认隐藏。' },
      { name: '下推', toolId: 'push_bill', access: '写', defaultOn: false, detail: '如下推订单到出库；默认隐藏。' },
      { name: '自定义操作', toolId: 'execute_operation', access: '写', defaultOn: false, detail: '禁用等自定义操作；默认隐藏。' },
    ],
  },
  yonyouFin: {
    id: 'yonyouFin',
    label: '用友做账',
    summary: '查凭证、科目、总账/明细账/余额；写凭证默认需确认。',
    description:
      '基于用友 YonSuite 财务 MCP：服务财税咨询的真账数据读取。不是进销存全模块；删除凭证危险，默认关闭写工具。',
    canDo: [
      '凭证列表/详情（含分录）',
      '科目列表/详情/树与账簿、余额表',
      '币种汇率与客商/部门/人员/项目等档案查询',
    ],
    cannotDo: [
      '不当成金蝶进销存',
      '未启用时禁止声称已写入用友账套',
      '默认禁止擅自删凭证、建改科目',
    ],
    tools: [
      { name: '凭证列表', toolId: 'query_voucher_list', access: '读', defaultOn: true, detail: '按期间等条件列凭证。' },
      { name: '凭证详情', toolId: 'query_voucher_detail', access: '读', defaultOn: true, detail: '含分录的凭证详情。' },
      { name: '保存凭证', toolId: 'save_voucher', access: '写', defaultOn: false, detail: '创建/更新凭证；须确认后才可放行。' },
      { name: '删除凭证', toolId: 'delete_voucher', access: '写', defaultOn: false, detail: '危险写操作；默认关闭。' },
      { name: '科目查询/树', toolId: 'account_query / account_tree', access: '读', defaultOn: true, detail: '科目列表、详情与树形结构。' },
      { name: '建改科目', toolId: 'account_create / account_update', access: '写', defaultOn: false, detail: '写操作；默认关闭。' },
      { name: '总账/明细账/余额', toolId: 'ledger_*', access: '读', defaultOn: true, detail: '账簿类只读查询。' },
      { name: '币种与汇率', toolId: 'currency_* / exchange_rate_query', access: '读', defaultOn: true, detail: '查询开；create/update 默认关。' },
      { name: '基础档案查询', toolId: 'customer_query 等', access: '读', defaultOn: true, detail: '客商、部门、人员、项目等档案只读。' },
    ],
  },
  taxInvoice: {
    id: 'taxInvoice',
    label: '数电发票（第三方）',
    summary: '查发票与查验真伪；开票/红冲默认关闭。商用 Token。',
    description:
      '经第三方商用 MCP（Streamable HTTP）做数电发票相关操作。不是电子税务局申报；开票法律责任在开票方。',
    canDo: ['按税号/票号等查开票状态与票面', '验真伪 / 票面一致性'],
    cannotDo: [
      '不做电子税务局申报缴款',
      '不替代税务师出具意见',
      '无 Token 禁止假装已开票',
    ],
    notes: ['Token 仅写在 mcp.json，勿入库'],
    tools: [
      { name: '发票查询', access: '读', defaultOn: true, detail: '查询开票状态与票面信息。' },
      { name: '发票查验', access: '读', defaultOn: true, detail: '验真伪与票面一致性。' },
      { name: '蓝字开票', access: '写', defaultOn: false, detail: '默认关闭；须 UserActionRequired 与用户明示。' },
      { name: '红字冲销', access: '写', defaultOn: false, detail: '默认关闭；须 UserActionRequired 与用户明示。' },
    ],
  },
  notionCollab: {
    id: 'notionCollab',
    label: 'Notion 协作',
    summary: '读搜写 Notion 页面与数据库；不替代本系统任务成果目录。',
    description:
      '官方 Notion MCP：把调研结论、会议纪要、任务表写入/读出客户 Notion 工作区。批量删改默认关。',
    canDo: ['按关键词或 ID 读页面、数据库行', '新建页、更新块、写数据库行（单次）'],
    cannotDo: [
      '不替代项目记忆与 artifacts/task-*',
      '不能在未授权 workspace 读写',
      '批量删除默认关闭',
    ],
    tools: [
      { name: '搜索/读取', access: '读', defaultOn: true, detail: '搜索页面或按 ID 读取内容与数据库行。' },
      { name: '创建/更新（单次）', access: '写', defaultOn: true, detail: '新建页、更新块、写数据库行；适合单次协作写入。' },
      { name: '批量删改', access: '写', defaultOn: false, detail: '默认关闭，避免误删工作区内容。' },
      { name: '评论/权限类', access: '写', defaultOn: false, detail: '若上游暴露则仅在正式启用下评估；默认关。' },
    ],
  },
  postgresReadonly: {
    id: 'postgresReadonly',
    label: 'Postgres 只读（业务库）',
    summary: '对客户业务库跑只读 SQL、看表结构；禁止连接控制面库。',
    description:
      '官方 @modelcontextprotocol/server-postgres：仅业务 PostgreSQL 的 schema 探查与只读查询。硬禁与 SAAS_DATABASE_URL 同库。',
    canDo: ['列出 schema/表与列', '执行 SELECT / 说明性只读查询'],
    cannotDo: [
      '绝不连接控制面数据库',
      '不做 INSERT/UPDATE/DELETE/DDL',
      '不用查询结果冒充已迁移租户数据',
    ],
    notes: ['连接串须使用只读角色更佳'],
    tools: [
      { name: '列出 schema/表', access: '读', defaultOn: true, detail: '探查有哪些表与列，便于排障与取数。' },
      { name: '只读 SQL', access: '读', defaultOn: true, detail: 'SELECT 类查询；连接串建议只读用户。' },
      { name: '写 SQL / DDL', access: '写', defaultOn: false, detail: '永不暴露；官方只读包 + 守卫双重拦截。' },
    ],
  },
};
