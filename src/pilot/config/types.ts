import type { AlwaysOnConfig } from "../../always-on/config/parseAlwaysOnConfig.js";
import type { CronConfig } from "../../cron/config/parseCronConfig.js";
import type { ModelConfig } from "../../model/protocol/canonical.js";
import type { RouterConfig } from "../../router/config/schema.js";

export type PilotConfigSourceKind = "default" | "project" | "env";
export type PilotConfigSourcePhase = "bootstrap" | "merge";
export type PilotConfigDiagnosticSeverity = "info" | "warning" | "error" | "fatal";
export type PilotConfigChangeClass =
  | "runtime-live"
  | "next-request"
  | "next-runtime"
  | "restart-required"
  | "invalid";

export type PilotConfigSource = {
  kind: PilotConfigSourceKind;
  priority: number;
  loadedAt: Date;
  path?: string;
  contentHash?: string;
  phase?: PilotConfigSourcePhase;
};

export type PilotConfigDiagnostic = {
  code: string;
  severity: PilotConfigDiagnosticSeverity;
  message: string;
  path?: string;
  source?: Pick<PilotConfigSource, "kind" | "path" | "phase">;
  hint?: string;
  redactedValue?: string;
  recoverable?: boolean;
};

export type PilotRawConfig = {
  schemaVersion?: unknown;
  agent?: unknown;
  model?: unknown;
  extension?: unknown;
  memory?: unknown;
  gateway?: unknown;
  adapters?: unknown;
  router?: unknown;
  alwaysOn?: unknown;
  cron?: unknown;
  tools?: unknown;
  telemetry?: unknown;
  proxy?: unknown;
  webui?: unknown;
};

export type PilotExtensionConfig = {
  builtinPluginsEnabled: Record<string, boolean>;
  includeHookEvents: boolean;
};

export type PilotAgentModelSelection = {
  id: string;
  provider: string;
  model: string;
};

export type PilotAgentConfig = {
  model: PilotAgentModelSelection;
  /**
   * Override the model catalog's context window size (tokens). When set,
   * auto-compaction thresholds (80% warn / 95% block) are computed against
   * this value instead of the catalog default. Useful for proxy providers
   * or when you want compaction to kick in earlier.
   */
  maxContextTokens?: number;
  subagents?: {
    timeoutMs?: number;
  };
};

/**
 * Re-export of the router's structured config so callers that already depend
 * on `PilotConfig` keep a single import path. The actual definition lives in
 * `src/router/config/schema.ts`.
 */
export type PilotRouterConfig = RouterConfig;

export type PilotMemoryApiType = "openai-responses" | "responses" | "openai-completions";
export type PilotMemoryReasoningMode = "answer_first" | "accuracy_first";

export type PilotMemoryScheduleConfig = {
  reasoningMode?: PilotMemoryReasoningMode;
  autoIndexIntervalMinutes?: number;
  autoDreamIntervalMinutes?: number;
};

/** PD-SAAS-FORK: per-project turn summary + flush after each user turn. */
export type PilotMemoryProjectContinuityConfig = {
  /** Default true when omitted — user can disable in settings. */
  enabled?: boolean;
};

export type PilotMemoryConfig = {
  enabled: boolean;
  provider: "edgeclaw";
  rootDir?: string;
  captureStrategy: "last_turn" | "full_session";
  includeAssistant: boolean;
  maxMessageChars?: number;
  retrievalTimeoutMs?: number;
  /** "provider/model" string referencing model.providers, e.g. "openai/gpt-4.1-mini" */
  model?: string;
  apiType?: PilotMemoryApiType;
  schedule?: PilotMemoryScheduleConfig;
  heartbeatBatchSize?: number;
  projectContinuity?: PilotMemoryProjectContinuityConfig;
};

export type PilotGatewayConfig = {
  port: number;
  bindAddress: "127.0.0.1";
  idleSessionTimeoutMinutes: number;
  staticAssetsPath?: string;
  /**
   * Maximum number of concurrent per-session MCP instances (e.g. browser-use
   * browser processes).  When the limit is reached, new sessions fall back
   * to the shared project-level MCP runtime.  Default 5.
   */
  maxPerSessionMcpInstances?: number;
};

export type PilotWebSearchProvider = "glm" | "tavily" | "bocha" | "custom";
export type PilotWebSearchCustomAuth = "bearer" | "bodyApiKey" | "queryApiKey" | "none";
export type PilotWebSearchCustomMethod = "GET" | "POST";

export type PilotWebSearchCustomProviderConfig = {
  name?: string;
  auth?: PilotWebSearchCustomAuth;
  method?: PilotWebSearchCustomMethod;
  queryParam?: string;
  apiKeyParam?: string;
  resultsPath?: string;
  titleField?: string;
  urlField?: string;
  snippetField?: string;
  sourceField?: string;
  publishedAtField?: string;
};

/**
 * Per-tool runtime config for `web_search`. Exactly one provider is active at
 * runtime; `apiKey` and `endpoint` apply to the selected provider.
 */
export type PilotWebSearchConfig = {
  provider?: PilotWebSearchProvider;
  apiKey?: string;
  endpoint?: string;
  customProvider?: PilotWebSearchCustomProviderConfig;
  /** PD-SAAS-FORK: up to 2 fallback search providers tried after primary failure. */
  fallbacks?: PilotWebSearchConfig[];
};

export type PilotMediaProvider =
  | "openai-compatible"
  | "google"
  | "qwen"
  | "volcengine"
  | "baidu"
  | "azure"
  | "cloud";

export type PilotMediaToolConfig = {
  provider?: PilotMediaProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  /** PD-SAAS-FORK: up to 2 fallback media configs tried after primary failure. */
  fallbacks?: PilotMediaToolConfig[];
};

export type PilotYixiaoerToolConfig = {
  apiKey?: string;
  /** Overrides default https://www.yixiaoer.cn/api */
  apiUrl?: string;
};

/** PD-SAAS-FORK: AI search visibility (GEO) headless CLI; verify via Bocha or agent web_search */
export type PilotGeoToolConfig = {
  /** Optional Bocha key for geo_api verify fallback (defaults to tools.webSearch / BOCHA_API_KEY). */
  bochaApiKey?: string;
  dataDir?: string;
  /** @deprecated Perplexity is no longer used for GEO verify. Ignored if present. */
  perplexityApiKey?: string;
};

export type PilotDocumentOcrProvider = "mineru" | "qwen-vl";

export type PilotDocumentOcrMode = "cloud" | "local";

export type PilotDocumentComposeConfig = {
  aspectRatio?: string;
};

export type PilotDocumentOcrExtractorMethod = "mineru" | "hybrid";

export type PilotDocumentOcrInpaintMethod = "baidu" | "pil_fallback";

export type PilotBaiduAiConfig = {
  apiKey?: string;
  secretKey?: string;
  enabled?: boolean;
};

export type PilotDocumentOcrConfig = {
  provider?: PilotDocumentOcrProvider;
  mode?: PilotDocumentOcrMode;
  apiUrl?: string;
  apiKey?: string;
  model?: string;
  fallbackProvider?: PilotDocumentOcrProvider;
  extractorMethod?: PilotDocumentOcrExtractorMethod;
  inpaintMethod?: PilotDocumentOcrInpaintMethod;
};

export type PilotDocumentExportQuality = "fast" | "balanced" | "fidelity";

export type PilotDocumentExportCloudPreference = "cloud_first" | "local_only";

export type PilotDocumentExportConfig = {
  cloudPreference?: PilotDocumentExportCloudPreference;
  defaultQuality?: PilotDocumentExportQuality;
  playwright?: { poolSize?: number };
  nutrient?: { apiKey?: string };
  providers?: Record<string, boolean | "auto">;
};

export type PilotDocumentImportCloudPreference = "local_first" | "cloud_first" | "local_only";

export type PilotDocumentImportConfig = {
  enabled?: boolean;
  cloudPreference?: PilotDocumentImportCloudPreference;
  workerConcurrency?: number;
  timeoutMs?: number;
  maxFileBytes?: { pdf?: number; office?: number };
  truncate?: { maxChars?: number; maxTableRows?: number };
  fallbackProvider?: "mineru" | "qwen-vl";
  providers?: Record<string, boolean | "auto">;
};

export type PilotDocumentToolsConfig = {
  compose?: PilotDocumentComposeConfig;
  ocr?: PilotDocumentOcrConfig;
  export?: PilotDocumentExportConfig;
  import?: PilotDocumentImportConfig;
};

/** PD-SAAS-FORK: document compose + OCR + export tools */
export type PilotToolsConfig = {
  webSearch?: PilotWebSearchConfig;
  search?: PilotWebSearchConfig;
  image?: PilotMediaToolConfig;
  video?: PilotMediaToolConfig;
  tts?: PilotMediaToolConfig;
  speech?: PilotMediaToolConfig;
  yixiaoer?: PilotYixiaoerToolConfig;
  geo?: PilotGeoToolConfig;
  documentCompose?: PilotDocumentComposeConfig;
  documentOcr?: PilotDocumentOcrConfig;
  baiduAi?: PilotBaiduAiConfig;
  document?: PilotDocumentToolsConfig;
  documentExport?: PilotDocumentExportConfig;
  documentImport?: PilotDocumentImportConfig;
};

export type PilotProxyConfig = {
  url: string;
  noProxy?: string;
};

export type PilotPlatformAdapterConfig = {
  enabled: boolean;
  token?: string;
  apiKey?: string;
  webhookUrl?: string;
  extra?: Record<string, unknown>;
};

export type PilotAdaptersConfig = {
  cli?: {
    autoConnectServer: boolean;
  };
  tui?: {
    autoConnectServer: boolean;
  };
  feishu?: {
    enabled: boolean;
    appId?: string;
    appSecret?: string;
    encryptKey?: string;
    verifyToken?: string;
    defaultSessionLabel: string;
    connectionMode?: "stream" | "webhook";
    domainName?: "feishu" | "lark";
  };
  weixin?: { enabled: boolean };
  telegram?: PilotPlatformAdapterConfig;
  discord?: PilotPlatformAdapterConfig;
  slack?: PilotPlatformAdapterConfig;
  matrix?: PilotPlatformAdapterConfig;
  mattermost?: PilotPlatformAdapterConfig;
  signal?: PilotPlatformAdapterConfig;
  whatsapp?: PilotPlatformAdapterConfig;
  bluebubbles?: PilotPlatformAdapterConfig;
  dingtalk?: PilotPlatformAdapterConfig;
  wecom?: PilotPlatformAdapterConfig;
  wecomCallback?: PilotPlatformAdapterConfig;
  email?: PilotPlatformAdapterConfig;
  sms?: PilotPlatformAdapterConfig;
  homeassistant?: PilotPlatformAdapterConfig;
  apiServer?: PilotPlatformAdapterConfig;
  webhook?: PilotPlatformAdapterConfig;
};

export type PilotTelemetryConfig = {
  enabled: boolean;
};

export type PilotConfig = {
  agent: PilotAgentConfig;
  model: ModelConfig;
  extension: PilotExtensionConfig;
  memory?: PilotMemoryConfig;
  gateway?: PilotGatewayConfig;
  adapters?: PilotAdaptersConfig;
  router?: RouterConfig;
  alwaysOn?: AlwaysOnConfig;
  cron?: CronConfig;
  tools?: PilotToolsConfig;
  telemetry?: PilotTelemetryConfig;
  proxy?: PilotProxyConfig;
};

export type PilotConfigSnapshot = {
  version: number;
  schemaVersion: number;
  loadedAt: Date;
  contentHash: string;
  sources: PilotConfigSource[];
  diagnostics: PilotConfigDiagnostic[];
  config: PilotConfig;
};

export type PilotConfigLoadOptions = {
  env?: Record<string, string | undefined>;
  projectRoot?: string;
  version?: number;
};

export type PilotConfigReloadEvent = {
  previousSnapshot: PilotConfigSnapshot;
  nextSnapshot: PilotConfigSnapshot;
  changedPaths: string[];
  changeClasses: PilotConfigChangeClass[];
};

export class PilotConfigError extends Error {
  readonly name = "PilotConfigError";

  constructor(
    readonly code: string,
    message: string,
    readonly diagnostics: PilotConfigDiagnostic[] = [],
  ) {
    super(message);
  }
}
