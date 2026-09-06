/** PD-SAAS-FORK: 平台功能开关（后台管理） */
import { authenticatedFetch } from '../utils/api';
import { isAbortOrNetworkError } from './networkFetchRegistry';
import type { PreflightStudioMode } from './preflightStudioGate';

export type McpFeatureMode = 'off' | 'shadow' | 'enforce';

export type Batch1McpFlagKey =
  | 'cnErp'
  | 'kingdee'
  | 'yonyouFin'
  | 'taxInvoice'
  | 'notionCollab'
  | 'postgresReadonly';

export type McpFeaturesMap = Record<Batch1McpFlagKey, McpFeatureMode>;

export const BATCH1_MCP_FLAG_KEYS: Batch1McpFlagKey[] = [
  'cnErp',
  'kingdee',
  'yonyouFin',
  'taxInvoice',
  'notionCollab',
  'postgresReadonly',
];

export const DEFAULT_MCP_FEATURES: McpFeaturesMap = {
  cnErp: 'off',
  kingdee: 'off',
  yonyouFin: 'off',
  taxInvoice: 'off',
  notionCollab: 'off',
  postgresReadonly: 'off',
};

export type PlatformFeaturesDoc = {
  version: number;
  updatedAt: string | null;
  preflightStudio: PreflightStudioMode;
  bentoDeckEditor: boolean;
  mdBrowserTool: boolean;
  /** PD-SAAS-FORK: N2 Bot workbench chip + HUD. Default off. */
  n2Bot: boolean;
  mcpFeatures: McpFeaturesMap;
  mcpFeaturesWarning?: string | null;
  reloadWarning?: string | null;
  envPreflightStudio?: PreflightStudioMode | null;
  effectivePreflightStudio?: PreflightStudioMode;
  envBentoDeckEditor?: { key: string; value: boolean } | null;
  effectiveBentoDeckEditor?: boolean;
  envMdBrowserTool?: { key: string; value: boolean } | null;
  effectiveMdBrowserTool?: boolean;
  envN2Bot?: { key: string; mode: 'off' | 'shadow' | 'enforce' } | null;
  effectiveN2Bot?: boolean;
  envMcpFeatures?: Record<string, { key: string; mode: McpFeatureMode } | null>;
  effectiveMcpFeatures?: McpFeaturesMap;
};

export const DEFAULT_PLATFORM_FEATURES: PlatformFeaturesDoc = {
  version: 1,
  updatedAt: null,
  preflightStudio: 'off',
  bentoDeckEditor: false,
  mdBrowserTool: true,
  n2Bot: false,
  mcpFeatures: { ...DEFAULT_MCP_FEATURES },
};

function normalizeMcpMode(raw: unknown): McpFeatureMode {
  const v = String(raw ?? 'off').trim().toLowerCase();
  if (v === 'shadow') return 'shadow';
  if (v === 'enforce' || v === '1' || v === 'true' || v === 'on') return 'enforce';
  return 'off';
}

export function normalizeMcpFeaturesMap(raw: unknown): McpFeaturesMap {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out = { ...DEFAULT_MCP_FEATURES };
  for (const key of BATCH1_MCP_FLAG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      out[key] = normalizeMcpMode(input[key]);
    }
  }
  if (
    (out.cnErp === 'shadow' || out.cnErp === 'enforce')
    && (out.kingdee === 'shadow' || out.kingdee === 'enforce')
  ) {
    out.kingdee = 'off';
  }
  return out;
}

export function normalizePlatformFeaturesDoc(raw: unknown): PlatformFeaturesDoc {
  const doc = {
    ...DEFAULT_PLATFORM_FEATURES,
    ...(raw && typeof raw === 'object' ? raw as PlatformFeaturesDoc : {}),
  };
  const mode = String(doc.preflightStudio ?? 'off').trim().toLowerCase();
  doc.preflightStudio = mode === 'shadow' || mode === 'enforce' ? mode : 'off';
  doc.bentoDeckEditor = doc.bentoDeckEditor === true;
  doc.mdBrowserTool = doc.mdBrowserTool !== false;
  doc.n2Bot = doc.n2Bot === true;
  doc.mcpFeatures = normalizeMcpFeaturesMap(doc.mcpFeatures);
  if (doc.effectiveMcpFeatures) {
    doc.effectiveMcpFeatures = normalizeMcpFeaturesMap(doc.effectiveMcpFeatures);
  }
  return doc;
}

export function describePlatformFeaturesRequestError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  if (raw === 'platform_features_read_failed') return '读取插件配置失败。';
  if (raw === 'platform_features_save_failed') return '保存插件配置失败。';
  if (
    isAbortOrNetworkError(error)
    || raw === 'fetch-timeout'
    || raw.toLowerCase().includes('fetch-timeout')
  ) {
    return '请求超时。请确认开发服务已启动后重试；若刚点保存，可点「重新加载」核对是否已写入。';
  }
  return raw || '插件配置请求失败。';
}

export async function fetchPlatformFeaturesAdmin(): Promise<PlatformFeaturesDoc> {
  const response = await authenticatedFetch('/api/capabilities/admin/platform-features');
  if (!response.ok) {
    throw new Error('platform_features_read_failed');
  }
  return normalizePlatformFeaturesDoc(await response.json());
}

export async function savePlatformFeaturesAdmin(
  doc: Pick<PlatformFeaturesDoc, 'preflightStudio' | 'bentoDeckEditor' | 'mdBrowserTool' | 'n2Bot' | 'mcpFeatures'>,
): Promise<PlatformFeaturesDoc> {
  const response = await authenticatedFetch('/api/capabilities/admin/platform-features', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      preflightStudio: doc.preflightStudio,
      bentoDeckEditor: doc.bentoDeckEditor,
      mdBrowserTool: doc.mdBrowserTool,
      n2Bot: doc.n2Bot,
      mcpFeatures: doc.mcpFeatures,
    }),
  });
  if (!response.ok) {
    throw new Error('platform_features_save_failed');
  }
  return normalizePlatformFeaturesDoc(await response.json());
}

export const MCP_FEATURE_ADMIN_META: Record<
  Batch1McpFlagKey,
  { label: string; hint: string; docAnchor: string }
> = {
  cnErp: {
    label: '企业 ERP 查询（金蝶/用友统一）',
    hint: '查订单、库存、应收应付与经营看板；默认只读。详见能力说明文档。',
    docAnchor: 'mcp-cn-erp',
  },
  kingdee: {
    label: '金蝶云星空（专用）',
    hint: '按单据类型查询/导出；与「企业 ERP 查询」互斥；默认只读模式。',
    docAnchor: 'mcp-kingdee-k3',
  },
  yonyouFin: {
    label: '用友做账',
    hint: '凭证、科目、账簿查询；写凭证默认需确认。',
    docAnchor: 'mcp-yonyou-fin',
  },
  taxInvoice: {
    label: '数电发票（第三方）',
    hint: '发票查询与查验；开票/红冲默认关闭。商用 Token。',
    docAnchor: 'mcp-tax-invoice',
  },
  notionCollab: {
    label: 'Notion 协作',
    hint: '读写 Notion 页面与数据库；不替代本系统任务成果目录。',
    docAnchor: 'mcp-notion-collab',
  },
  postgresReadonly: {
    label: 'Postgres 只读（业务库）',
    hint: '只读查询客户业务库；禁止连接控制面数据库。',
    docAnchor: 'mcp-postgres-readonly',
  },
};
