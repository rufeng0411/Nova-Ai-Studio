import type { TelemetryClient, TelemetryConfig } from "./types.js";

type CreateTelemetryCollectorInput = {
  env?: Record<string, string | undefined>;
  pilotHome?: string;
  fetchImpl?: typeof fetch;
  /** Explicit override for the enabled flag; takes precedence over env. */
  enabled?: boolean;
};

// PD-SAAS-FORK: Nova fork — remote analytics permanently disabled (no tele.pilotdeck.cn).
const DISABLED_REMOTE_TELEMETRY_CONFIG: TelemetryConfig = {
  enabled: false,
  baseUrl: "",
  flushIntervalMs: 5000,
  batchSize: 20,
  timeoutMs: 4000,
  maxRetries: 0,
  maxQueueSize: 0,
  queueFilePath: "",
};

const DISABLED_REMOTE_TELEMETRY_METRICS = {
  queued: 0,
  sent: 0,
  sendFailures: 0,
  retries: 0,
  dropped: 0,
  queueDepth: 0,
} as const;

const PATH_LIKE_KEY = /path|cwd|root|dir|file/i;
const ABSOLUTE_PATH_VALUE = /^([A-Za-z]:)?[/\\]/;

export function createTelemetryCollector(
  _input: CreateTelemetryCollectorInput = {},
): TelemetryClient {
  const config = { ...DISABLED_REMOTE_TELEMETRY_CONFIG };
  return {
    track() {},
    trackFeatureUsed() {},
    trackFeatureLoopStage() {},
    trackError() {},
    setEnabled() {},
    flush: async () => {},
    shutdown: async () => {},
    snapshot: () => ({ ...DISABLED_REMOTE_TELEMETRY_METRICS }),
    getConfig: () => ({ ...config }),
  };
}

export function sanitizeProperties(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (PATH_LIKE_KEY.test(key)) {
      continue;
    }
    const sanitized = sanitizePropertyValue(entry);
    if (sanitized !== undefined) {
      out[key] = sanitized;
    }
  }
  return out;
}

function sanitizePropertyValue(value: unknown): unknown {
  if (value == null) {
    return value;
  }
  if (typeof value === "string") {
    return looksLikeAbsolutePath(value) ? undefined : value;
  }
  if (Array.isArray(value)) {
    const items = value
      .map((item) => sanitizePropertyValue(item))
      .filter((item) => item !== undefined);
    return items.length > 0 ? items : undefined;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const nested = sanitizeProperties(record);
    return Object.keys(nested).length > 0 ? nested : undefined;
  }
  return value;
}

function looksLikeAbsolutePath(value: string): boolean {
  return ABSOLUTE_PATH_VALUE.test(value.trim());
}
