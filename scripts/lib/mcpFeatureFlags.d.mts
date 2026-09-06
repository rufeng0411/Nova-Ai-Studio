/** PD-SAAS-FORK: typings for mcpFeatureFlags.mjs (Gateway re-export). */
export type McpFeatureMode = 'off' | 'shadow' | 'enforce';

export type McpFeatureEntry = {
  flagKey: string;
  serverIds: string[];
  hubSlugs: string[];
  envKeys: string[];
  defaultMode: McpFeatureMode;
  batch1?: boolean;
};

export const MCP_PLATFORM_FEATURES_PATH: string;
export const MCP_FEATURE_REGISTRY: ReadonlyArray<McpFeatureEntry>;
export const BATCH1_MCP_FLAG_KEYS: readonly string[];

export function normalizeMcpFeatureMode(
  raw: unknown,
  defaultMode?: McpFeatureMode,
): McpFeatureMode;
export function isMcpFeatureEnabled(mode: McpFeatureMode): boolean;
export function emptyBatch1McpFeatures(): Record<string, McpFeatureMode>;
export function normalizeMcpFeaturesDoc(raw: unknown): {
  features: Record<string, McpFeatureMode>;
  warning?: string;
};
export function resolveMcpFeatureMode(flagKey: string): McpFeatureMode;
export function resolveAllBatch1McpFeaturesEffective(): Record<string, McpFeatureMode>;
export function readBatch1McpEnvOverrides(): Record<
  string,
  { key: string; mode: McpFeatureMode } | null
>;
export function isHubSlugMcpFeatureAllowed(slug: string): boolean;
export function filterMcpServersByFeatures(servers: Record<string, unknown> | undefined): {
  servers: Record<string, unknown>;
  dropped: string[];
  unregistered: string[];
};
export function getMcpFeatureEntryByServerId(serverId: string): McpFeatureEntry | null;
export function getMcpFeatureEntryBySlug(slug: string): McpFeatureEntry | null;
export function mcpFeatureRegistryPathHint(): string;
export function emitMcpFeatureGateEvent(payload: Record<string, unknown>): void;
