// PD-SAAS-FORK: 运行时 UI feature flags — Bridge env 覆盖 Vite 构建默认值

import { authenticatedFetch } from '../utils/api';
import {
  normalizePreflightStudioMode,
  type PreflightStudioMode,
} from './preflightStudioGate';
import {
  DEFAULT_MCP_FEATURES,
  normalizeMcpFeaturesMap,
  type McpFeaturesMap,
} from './platformFeatures';

export type RuntimeFeatureFlags = {
  deliverableCertificateUi: boolean;
  deliverableQualityUi: boolean;
  exportSnapshotV2: boolean;
  exportUserAuditModes: boolean;
  deliverableSettledAcceptanceAuthority: boolean;
  deliverableTrustCopyV2: boolean;
  uiStrictCompletionGate: boolean;
  hyperframesHubV2: boolean;
  /** PD-SAAS-FORK: product marketing site owns `/` when true */
  marketingSite: boolean;
  /** PD-SAAS-FORK: Preflight 模板选型（off | shadow | enforce） */
  preflightStudioMode: PreflightStudioMode;
  /** PD-SAAS-FORK: Nova Bento 演示稿所见即所得编辑器 */
  bentoDeckEditor: boolean;
  /** PD-SAAS-FORK: Hub Markdown 浏览器工具（Cherry Core） */
  mdBrowserTool: boolean;
  /** PD-SAAS-FORK: 企业 MCP 功能开关（本批默认 off） */
  mcpFeatures: McpFeaturesMap;
  /** PD-SAAS-FORK: N2 Bot β steward HUD (off | shadow | enforce) */
  n2BotMode: 'off' | 'shadow' | 'enforce';
  /** PD-SAAS-FORK: workbench beta 1.1 shell */
  workbenchBeta11?: boolean;
  workbenchTourMode?: 'off' | 'shadow' | 'enforce';
  turnUsageFooterMode?: 'off' | 'shadow' | 'enforce';
  postDeliverableNextMode?: 'off' | 'shadow' | 'enforce';
};

const ALL_OFF: RuntimeFeatureFlags = {
  deliverableCertificateUi: false,
  deliverableQualityUi: false,
  exportSnapshotV2: false,
  exportUserAuditModes: false,
  deliverableSettledAcceptanceAuthority: true,
  deliverableTrustCopyV2: true,
  uiStrictCompletionGate: true,
  hyperframesHubV2: true,
  marketingSite: false,
  preflightStudioMode: 'off',
  bentoDeckEditor: false,
  /** 默认开：Bridge 拉取失败时仍可用 Hub Markdown 浏览器 */
  mdBrowserTool: true,
  mcpFeatures: { ...DEFAULT_MCP_FEATURES },
  n2BotMode: 'off',
};

let applied: RuntimeFeatureFlags | null = null;
const listeners = new Set<() => void>();

function parseFlags(payload: Record<string, unknown>): RuntimeFeatureFlags {
  return {
    deliverableCertificateUi: payload.PILOTDECK_UI_DELIVERABLE_CERTIFICATE === true,
    deliverableQualityUi: payload.PILOTDECK_UI_DELIVERABLE_QUALITY === true,
    exportSnapshotV2: payload.PILOTDECK_UI_EXPORT_SNAPSHOT_V2 === true,
    exportUserAuditModes: payload.PILOTDECK_UI_EXPORT_USER_AUDIT_MODES === true,
    deliverableSettledAcceptanceAuthority:
      payload.PILOTDECK_UI_DELIVERABLE_SETTLED_ACCEPTANCE_AUTHORITY !== false,
    deliverableTrustCopyV2: payload.PILOTDECK_UI_DELIVERABLE_TRUST_COPY_V2 !== false,
    uiStrictCompletionGate: payload.PILOTDECK_UI_STRICT_COMPLETION_GATE !== false,
    hyperframesHubV2: payload.PILOTDECK_HYPERFRAMES_HUB_V2 !== false,
    marketingSite: payload.PILOTDECK_MARKETING_SITE === true,
    preflightStudioMode: normalizePreflightStudioMode(
      typeof payload.PILOTDECK_PREFLIGHT_STUDIO === 'string'
        ? payload.PILOTDECK_PREFLIGHT_STUDIO
        : undefined,
    ),
    bentoDeckEditor: payload.PILOTDECK_BENTO_DECK_EDITOR === true,
    // 默认开：旧 Bridge 未返回该键时仍启用；显式 false 才关闭
    mdBrowserTool:
      typeof payload.PILOTDECK_MD_BROWSER_TOOL === 'boolean'
        ? payload.PILOTDECK_MD_BROWSER_TOOL
        : true,
    mcpFeatures: normalizeMcpFeaturesMap(payload.mcpFeatures),
    n2BotMode: normalizeGrayMode(payload.PILOTDECK_N2_BOT ?? payload.PILOTDECK_JARVIS_BUTLER) ?? 'off',
    workbenchBeta11: parseOnOffFlag(payload.PILOTDECK_UI_WORKBENCH_BETA_11),
    workbenchTourMode: normalizeGrayMode(payload.PILOTDECK_UI_WORKBENCH_TOUR),
    turnUsageFooterMode: normalizeGrayMode(payload.PILOTDECK_UI_TURN_USAGE_FOOTER),
    postDeliverableNextMode: normalizeGrayMode(payload.PILOTDECK_UI_POST_DELIVERABLE_NEXT),
  };
}

function normalizeGrayMode(raw: unknown): 'off' | 'shadow' | 'enforce' | undefined {
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim().toLowerCase();
  if (v === 'off' || v === 'shadow' || v === 'enforce') return v;
  if (v === '1' || v === 'true' || v === 'on') return 'enforce';
  if (v === '0' || v === 'false') return 'off';
  return undefined;
}

function parseOnOffFlag(raw: unknown): boolean | undefined {
  if (raw === true || raw === 1) return true;
  if (raw === false || raw === 0) return false;
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'on') return true;
  if (v === '0' || v === 'false' || v === 'off') return false;
  return undefined;
}

export function getRuntimeFeatureFlags(): RuntimeFeatureFlags | null {
  return applied;
}

export function subscribeRuntimeFeatureFlags(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

type RuntimeFeatureFlagsInput = Omit<RuntimeFeatureFlags, 'deliverableQualityUi'> & {
  deliverableQualityUi?: boolean;
};

export function applyRuntimeFeatureFlags(flags: RuntimeFeatureFlagsInput): void {
  applied = {
    ...flags,
    deliverableQualityUi: flags.deliverableQualityUi === true,
  };
  listeners.forEach((listener) => listener());
}

export function isDeliverableQualityUiEnabled(): boolean {
  return applied?.deliverableQualityUi === true;
}

export function isN2BotHudEnabled(): boolean {
  const mode = applied?.n2BotMode ?? 'off';
  return mode === 'shadow' || mode === 'enforce';
}

export async function fetchRuntimeFeatureFlags(): Promise<RuntimeFeatureFlags> {
  try {
    const response = await authenticatedFetch('/api/runtime/feature-flags', {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      applyRuntimeFeatureFlags(ALL_OFF);
      return ALL_OFF;
    }
    const data = await response.json() as Record<string, unknown>;
    const flags = parseFlags(data);
    applyRuntimeFeatureFlags(flags);
    return flags;
  } catch {
    applyRuntimeFeatureFlags(ALL_OFF);
    return ALL_OFF;
  }
}

export function resetRuntimeFeatureFlagsForTests(): void {
  applied = null;
  listeners.clear();
}
