// PD-SAAS-FORK: Gateway-side re-export of enterprise MCP feature flags
export {
  BATCH1_MCP_FLAG_KEYS,
  MCP_FEATURE_REGISTRY,
  emitMcpFeatureGateEvent,
  emptyBatch1McpFeatures,
  filterMcpServersByFeatures,
  getMcpFeatureEntryByServerId,
  getMcpFeatureEntryBySlug,
  isHubSlugMcpFeatureAllowed,
  isMcpFeatureEnabled,
  normalizeMcpFeatureMode,
  normalizeMcpFeaturesDoc,
  readBatch1McpEnvOverrides,
  resolveAllBatch1McpFeaturesEffective,
  resolveMcpFeatureMode,
} from '../../../scripts/lib/mcpFeatureFlags.mjs';

export type McpFeatureMode = 'off' | 'shadow' | 'enforce';
