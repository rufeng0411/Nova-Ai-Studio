import { resolveApiKey, type CredentialEnv } from "../../model/config/resolveCredentials.js";
import { isRecord } from "../../model/config/schema.js";
import type {
  PilotBaiduAiConfig,
  PilotConfigDiagnostic,
  PilotDocumentComposeConfig,
  PilotDocumentImportCloudPreference,
  PilotDocumentImportConfig,
  PilotDocumentOcrConfig,
  PilotDocumentOcrExtractorMethod,
  PilotDocumentOcrInpaintMethod,
  PilotDocumentOcrMode,
  PilotDocumentOcrProvider,
  PilotMediaProvider,
  PilotMediaToolConfig,
  PilotToolsConfig,
  PilotWebSearchConfig,
  PilotWebSearchCustomAuth,
  PilotWebSearchCustomMethod,
  PilotWebSearchProvider,
  PilotYixiaoerToolConfig,
  PilotGeoToolConfig,
} from "./types.js";

/**
 * Parse the optional `tools` section of `pilotdeck.yaml`.
 *
 *   tools:
 *     webSearch:
 *       provider: glm                    # glm | tavily | bocha | custom
 *       apiKey: "..."
 *       endpoint: https://api.z.ai/api/paas/v4/web_search
 *
 * Unknown fields produce non-fatal warnings so future additions don't break
 * older deployments.  Returns `undefined` when the section is missing or
 * empty so callers can keep the field off the snapshot entirely.
 */
export function parseToolsConfig(
  rawTools: unknown,
  diagnostics: PilotConfigDiagnostic[],
  env: CredentialEnv = process.env,
): PilotToolsConfig | undefined {
  if (rawTools === undefined) {
    return undefined;
  }
  if (!isRecord(rawTools)) {
    diagnostics.push({
      code: "TOOLS_CONFIG_INVALID",
      severity: "fatal",
      message: "tools config must be an object.",
      path: "tools",
      recoverable: false,
    });
    return undefined;
  }

  const webSearch = parseWebSearch(rawTools.webSearch, diagnostics);
  const search = parseWebSearch(rawTools.search, diagnostics, "tools.search");
  const image = parseMediaToolConfig(rawTools.image, diagnostics, "tools.image", env);
  const video = parseMediaToolConfig(rawTools.video, diagnostics, "tools.video", env);
  const tts = parseMediaToolConfig(rawTools.tts, diagnostics, "tools.tts", env);
  const speech = parseMediaToolConfig(rawTools.speech, diagnostics, "tools.speech", env);
  const yixiaoer = parseYixiaoerToolConfig(rawTools.yixiaoer, diagnostics, env);
  const documentCompose = parseDocumentComposeConfig(rawTools.documentCompose, diagnostics);
  const documentOcr = parseDocumentOcrConfig(rawTools.documentOcr, diagnostics, env);
  const documentImport = parseDocumentImportConfig(rawTools.documentImport, diagnostics);
  const baiduAi = parseBaiduAiConfig(rawTools.baiduAi, diagnostics, env);
  const geo = parseGeoToolConfig(rawTools.geo, diagnostics, env);

  for (const key of Object.keys(rawTools)) {
    if (
      key !== "webSearch"
      && key !== "search"
      && key !== "image"
      && key !== "video"
      && key !== "tts"
      && key !== "speech"
      && key !== "yixiaoer"
      && key !== "documentCompose"
      && key !== "documentOcr"
      && key !== "documentImport"
      && key !== "baiduAi"
      && key !== "geo"
    ) {
      diagnostics.push({
        code: "TOOLS_UNKNOWN_FIELD",
        severity: "warning",
        message: `Unknown tools config field ${key}.`,
        path: `tools.${key}`,
        recoverable: true,
      });
    }
  }

  if (!webSearch && !search && !image && !video && !tts && !speech && !yixiaoer && !documentCompose && !documentOcr && !documentImport && !baiduAi && !geo) {
    return undefined;
  }
  return {
    ...(webSearch ? { webSearch } : {}),
    ...(search ? { search } : {}),
    ...(image ? { image } : {}),
    ...(video ? { video } : {}),
    ...(tts ? { tts } : {}),
    ...(speech ? { speech } : {}),
    ...(yixiaoer ? { yixiaoer } : {}),
    ...(documentCompose ? { documentCompose } : {}),
    ...(documentOcr ? { documentOcr } : {}),
    ...(documentImport ? { documentImport } : {}),
    ...(baiduAi ? { baiduAi } : {}),
    ...(geo ? { geo } : {}),
  };
}

function parseGeoToolConfig(
  raw: unknown,
  diagnostics: PilotConfigDiagnostic[],
  env: CredentialEnv,
): PilotGeoToolConfig | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    diagnostics.push({
      code: "TOOLS_GEO_INVALID",
      severity: "warning",
      message: "tools.geo must be an object.",
      path: "tools.geo",
      recoverable: true,
    });
    return undefined;
  }
  const dataDir = typeof raw.dataDir === "string" ? raw.dataDir.trim() : undefined;
  const bochaApiKey = (() => {
    for (const candidate of [raw.bochaApiKey, raw.bocha_api_key, "${BOCHA_API_KEY}"]) {
      try {
        if (candidate == null || (typeof candidate === "string" && !candidate.trim())) continue;
        return resolveApiKey(candidate, env);
      } catch {
        // optional GEO key — fall through to next candidate
      }
    }
    return undefined;
  })();
  if (typeof raw.perplexityApiKey === "string" && raw.perplexityApiKey.trim()) {
    diagnostics.push({
      code: "TOOLS_GEO_PERPLEXITY_DEPRECATED",
      severity: "warning",
      message: "tools.geo.perplexityApiKey is deprecated; GEO verify uses web_search then Bocha.",
      path: "tools.geo.perplexityApiKey",
      recoverable: true,
    });
  }
  if (!dataDir && !bochaApiKey) {
    return undefined;
  }
  return {
    ...(bochaApiKey ? { bochaApiKey } : {}),
    ...(dataDir ? { dataDir } : {}),
  };
}

function parseYixiaoerToolConfig(
  raw: unknown,
  diagnostics: PilotConfigDiagnostic[],
  env: CredentialEnv,
): PilotYixiaoerToolConfig | undefined {
  const pathPrefix = "tools.yixiaoer";
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    diagnostics.push({
      code: "TOOLS_YIXIAOER_INVALID",
      severity: "fatal",
      message: `${pathPrefix} must be an object.`,
      path: pathPrefix,
      recoverable: false,
    });
    return undefined;
  }

  const result: PilotYixiaoerToolConfig = {};
  const apiKey = parseOptionalStringField(raw.apiKey, `${pathPrefix}.apiKey`, diagnostics);
  if (apiKey !== undefined) {
    try {
      result.apiKey = resolveApiKey(apiKey, env);
    } catch (error) {
      diagnostics.push({
        code: "TOOLS_YIXIAOER_API_KEY_INVALID",
        severity: "warning",
        message:
          error instanceof Error
            ? error.message
            : `${pathPrefix}.apiKey could not be resolved.`,
        path: `${pathPrefix}.apiKey`,
        recoverable: true,
      });
      result.apiKey = apiKey;
    }
  }
  const apiUrl = parseOptionalStringField(raw.apiUrl, `${pathPrefix}.apiUrl`, diagnostics);
  if (apiUrl !== undefined) {
    result.apiUrl = apiUrl;
  }

  for (const key of Object.keys(raw)) {
    if (key !== "apiKey" && key !== "apiUrl") {
      diagnostics.push({
        code: "TOOLS_YIXIAOER_UNKNOWN_FIELD",
        severity: "warning",
        message: `Unknown ${pathPrefix} field ${key}.`,
        path: `${pathPrefix}.${key}`,
        recoverable: true,
      });
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function parseDocumentComposeConfig(
  raw: unknown,
  diagnostics: PilotConfigDiagnostic[],
): PilotDocumentComposeConfig | undefined {
  const pathPrefix = "tools.documentCompose";
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) {
    diagnostics.push({
      code: "TOOLS_DOCUMENT_COMPOSE_INVALID",
      severity: "fatal",
      message: `${pathPrefix} must be an object.`,
      path: pathPrefix,
      recoverable: false,
    });
    return undefined;
  }
  const result: PilotDocumentComposeConfig = {};
  const aspectRatio = parseOptionalStringField(raw.aspectRatio, `${pathPrefix}.aspectRatio`, diagnostics);
  if (aspectRatio !== undefined) result.aspectRatio = aspectRatio;
  for (const key of Object.keys(raw)) {
    if (key !== "aspectRatio") {
      diagnostics.push({
        code: "TOOLS_DOCUMENT_COMPOSE_UNKNOWN_FIELD",
        severity: "warning",
        message: `Unknown ${pathPrefix} field ${key}.`,
        path: `${pathPrefix}.${key}`,
        recoverable: true,
      });
    }
  }
  return Object.keys(result).length > 0 ? result : {};
}

function parseDocumentOcrConfig(
  raw: unknown,
  diagnostics: PilotConfigDiagnostic[],
  env: CredentialEnv,
): PilotDocumentOcrConfig | undefined {
  const pathPrefix = "tools.documentOcr";
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) {
    diagnostics.push({
      code: "TOOLS_DOCUMENT_OCR_INVALID",
      severity: "fatal",
      message: `${pathPrefix} must be an object.`,
      path: pathPrefix,
      recoverable: false,
    });
    return undefined;
  }
  const result: PilotDocumentOcrConfig = {};
  const provider = parseEnumField<PilotDocumentOcrProvider>(
    raw.provider,
    ["mineru", "qwen-vl"],
    `${pathPrefix}.provider`,
    "TOOLS_DOCUMENT_OCR_PROVIDER_INVALID",
    diagnostics,
  );
  if (provider) result.provider = provider;
  const mode = parseEnumField<PilotDocumentOcrMode>(
    raw.mode,
    ["cloud", "local"],
    `${pathPrefix}.mode`,
    "TOOLS_DOCUMENT_OCR_MODE_INVALID",
    diagnostics,
  );
  if (mode) result.mode = mode;
  const fallbackProvider = parseEnumField<PilotDocumentOcrProvider>(
    raw.fallbackProvider,
    ["mineru", "qwen-vl"],
    `${pathPrefix}.fallbackProvider`,
    "TOOLS_DOCUMENT_OCR_FALLBACK_INVALID",
    diagnostics,
  );
  if (fallbackProvider) result.fallbackProvider = fallbackProvider;
  const extractorMethod = parseEnumField<PilotDocumentOcrExtractorMethod>(
    raw.extractorMethod,
    ["mineru", "hybrid"],
    `${pathPrefix}.extractorMethod`,
    "TOOLS_DOCUMENT_OCR_EXTRACTOR_INVALID",
    diagnostics,
  );
  if (extractorMethod) result.extractorMethod = extractorMethod;
  const inpaintMethod = parseEnumField<PilotDocumentOcrInpaintMethod>(
    raw.inpaintMethod,
    ["baidu", "pil_fallback"],
    `${pathPrefix}.inpaintMethod`,
    "TOOLS_DOCUMENT_OCR_INPAINT_INVALID",
    diagnostics,
  );
  if (inpaintMethod) result.inpaintMethod = inpaintMethod;
  const apiUrl = parseOptionalStringField(raw.apiUrl, `${pathPrefix}.apiUrl`, diagnostics);
  if (apiUrl !== undefined) result.apiUrl = apiUrl;
  const model = parseOptionalStringField(raw.model, `${pathPrefix}.model`, diagnostics);
  if (model !== undefined) result.model = model;
  const apiKey = parseOptionalStringField(raw.apiKey, `${pathPrefix}.apiKey`, diagnostics);
  if (apiKey !== undefined) {
    try {
      result.apiKey = resolveApiKey(apiKey, env);
    } catch (error) {
      diagnostics.push({
        code: "TOOLS_DOCUMENT_OCR_API_KEY_INVALID",
        severity: "warning",
        message:
          error instanceof Error
            ? error.message
            : `${pathPrefix}.apiKey could not be resolved.`,
        path: `${pathPrefix}.apiKey`,
        recoverable: true,
      });
      result.apiKey = apiKey;
    }
  }
  for (const key of Object.keys(raw)) {
    if (
      key !== "provider"
      && key !== "mode"
      && key !== "apiUrl"
      && key !== "apiKey"
      && key !== "model"
      && key !== "fallbackProvider"
      && key !== "extractorMethod"
      && key !== "inpaintMethod"
    ) {
      diagnostics.push({
        code: "TOOLS_DOCUMENT_OCR_UNKNOWN_FIELD",
        severity: "warning",
        message: `Unknown ${pathPrefix} field ${key}.`,
        path: `${pathPrefix}.${key}`,
        recoverable: true,
      });
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function parseDocumentImportConfig(
  raw: unknown,
  diagnostics: PilotConfigDiagnostic[],
): PilotDocumentImportConfig | undefined {
  const pathPrefix = "tools.documentImport";
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) {
    diagnostics.push({
      code: "TOOLS_DOCUMENT_IMPORT_INVALID",
      severity: "fatal",
      message: `${pathPrefix} must be an object.`,
      path: pathPrefix,
      recoverable: false,
    });
    return undefined;
  }
  const result: PilotDocumentImportConfig = {};
  if (typeof raw.enabled === "boolean") result.enabled = raw.enabled;
  const cloudPreference = parseEnumField<PilotDocumentImportCloudPreference>(
    raw.cloudPreference,
    ["local_first", "cloud_first", "local_only"],
    `${pathPrefix}.cloudPreference`,
    "TOOLS_DOCUMENT_IMPORT_CLOUD_INVALID",
    diagnostics,
  );
  if (cloudPreference) result.cloudPreference = cloudPreference;
  if (typeof raw.workerConcurrency === "number" && raw.workerConcurrency > 0) {
    result.workerConcurrency = raw.workerConcurrency;
  }
  if (typeof raw.timeoutMs === "number" && raw.timeoutMs >= 1000) {
    result.timeoutMs = raw.timeoutMs;
  }
  if (isRecord(raw.maxFileBytes)) {
    const maxFileBytes: NonNullable<PilotDocumentImportConfig["maxFileBytes"]> = {};
    if (typeof raw.maxFileBytes.pdf === "number" && raw.maxFileBytes.pdf > 0) {
      maxFileBytes.pdf = raw.maxFileBytes.pdf;
    }
    if (typeof raw.maxFileBytes.office === "number" && raw.maxFileBytes.office > 0) {
      maxFileBytes.office = raw.maxFileBytes.office;
    }
    if (Object.keys(maxFileBytes).length > 0) result.maxFileBytes = maxFileBytes;
  }
  if (isRecord(raw.truncate)) {
    const truncate: NonNullable<PilotDocumentImportConfig["truncate"]> = {};
    if (typeof raw.truncate.maxChars === "number" && raw.truncate.maxChars > 0) {
      truncate.maxChars = raw.truncate.maxChars;
    }
    if (typeof raw.truncate.maxTableRows === "number" && raw.truncate.maxTableRows > 0) {
      truncate.maxTableRows = raw.truncate.maxTableRows;
    }
    if (Object.keys(truncate).length > 0) result.truncate = truncate;
  }
  const fallbackProvider = parseEnumField<"mineru" | "qwen-vl">(
    raw.fallbackProvider,
    ["mineru", "qwen-vl"],
    `${pathPrefix}.fallbackProvider`,
    "TOOLS_DOCUMENT_IMPORT_FALLBACK_INVALID",
    diagnostics,
  );
  if (fallbackProvider) result.fallbackProvider = fallbackProvider;
  if (isRecord(raw.providers)) {
    const providers: Record<string, boolean | "auto"> = {};
    for (const [key, value] of Object.entries(raw.providers)) {
      if (value === true || value === false || value === "auto") {
        providers[key] = value;
      }
    }
    if (Object.keys(providers).length > 0) result.providers = providers;
  }
  for (const key of Object.keys(raw)) {
    if (
      key !== "enabled"
      && key !== "cloudPreference"
      && key !== "workerConcurrency"
      && key !== "timeoutMs"
      && key !== "maxFileBytes"
      && key !== "truncate"
      && key !== "fallbackProvider"
      && key !== "providers"
    ) {
      diagnostics.push({
        code: "TOOLS_DOCUMENT_IMPORT_UNKNOWN_FIELD",
        severity: "warning",
        message: `Unknown ${pathPrefix} field ${key}.`,
        path: `${pathPrefix}.${key}`,
        recoverable: true,
      });
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function parseBaiduAiConfig(
  raw: unknown,
  diagnostics: PilotConfigDiagnostic[],
  env: CredentialEnv,
): PilotBaiduAiConfig | undefined {
  const pathPrefix = "tools.baiduAi";
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) {
    diagnostics.push({
      code: "TOOLS_BAIDU_AI_INVALID",
      severity: "fatal",
      message: `${pathPrefix} must be an object.`,
      path: pathPrefix,
      recoverable: false,
    });
    return undefined;
  }
  const result: PilotBaiduAiConfig = {};
  const apiKey = parseOptionalStringField(raw.apiKey, `${pathPrefix}.apiKey`, diagnostics);
  if (apiKey !== undefined) {
    try {
      result.apiKey = resolveApiKey(apiKey, env);
    } catch (error) {
      diagnostics.push({
        code: "TOOLS_BAIDU_AI_API_KEY_INVALID",
        severity: "warning",
        message: error instanceof Error ? error.message : `${pathPrefix}.apiKey could not be resolved.`,
        path: `${pathPrefix}.apiKey`,
        recoverable: true,
      });
      result.apiKey = apiKey;
    }
  }
  const secretKey = parseOptionalStringField(raw.secretKey, `${pathPrefix}.secretKey`, diagnostics);
  if (secretKey !== undefined) {
    try {
      result.secretKey = resolveApiKey(secretKey, env);
    } catch (error) {
      diagnostics.push({
        code: "TOOLS_BAIDU_AI_SECRET_KEY_INVALID",
        severity: "warning",
        message: error instanceof Error ? error.message : `${pathPrefix}.secretKey could not be resolved.`,
        path: `${pathPrefix}.secretKey`,
        recoverable: true,
      });
      result.secretKey = secretKey;
    }
  }
  if (typeof raw.enabled === "boolean") result.enabled = raw.enabled;
  for (const key of Object.keys(raw)) {
    if (key !== "apiKey" && key !== "secretKey" && key !== "enabled") {
      diagnostics.push({
        code: "TOOLS_BAIDU_AI_UNKNOWN_FIELD",
        severity: "warning",
        message: `Unknown ${pathPrefix} field ${key}.`,
        path: `${pathPrefix}.${key}`,
        recoverable: true,
      });
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function parseWebSearch(
  raw: unknown,
  diagnostics: PilotConfigDiagnostic[],
  pathPrefix = "tools.webSearch",
): PilotWebSearchConfig | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    diagnostics.push({
      code: "TOOLS_WEB_SEARCH_INVALID",
      severity: "fatal",
      message: `${pathPrefix} must be an object.`,
      path: pathPrefix,
      recoverable: false,
    });
    return undefined;
  }

  const result: PilotWebSearchConfig = {};

  if (raw.provider !== undefined) {
    if (
      raw.provider !== "glm"
      && raw.provider !== "tavily"
      && raw.provider !== "bocha"
      && raw.provider !== "custom"
    ) {
      diagnostics.push({
        code: "TOOLS_WEB_SEARCH_PROVIDER_INVALID",
        severity: "fatal",
        message: `${pathPrefix}.provider must be "glm", "tavily", "bocha", or "custom".`,
        path: `${pathPrefix}.provider`,
        recoverable: false,
      });
    } else {
      result.provider = raw.provider as PilotWebSearchProvider;
    }
  }

  if (raw.apiKey !== undefined) {
    if (typeof raw.apiKey !== "string" || raw.apiKey.trim().length === 0) {
      diagnostics.push({
        code: "TOOLS_WEB_SEARCH_API_KEY_INVALID",
        severity: "fatal",
        message: `${pathPrefix}.apiKey must be a non-empty string.`,
        path: `${pathPrefix}.apiKey`,
        recoverable: false,
      });
    } else {
      result.apiKey = raw.apiKey.trim();
    }
  }

  if (raw.endpoint !== undefined) {
    if (typeof raw.endpoint !== "string" || raw.endpoint.trim().length === 0) {
      diagnostics.push({
        code: "TOOLS_WEB_SEARCH_ENDPOINT_INVALID",
        severity: "fatal",
        message: `${pathPrefix}.endpoint must be a non-empty URL string.`,
        path: `${pathPrefix}.endpoint`,
        recoverable: false,
      });
    } else {
      result.endpoint = raw.endpoint.trim();
    }
  }

  const customProvider = parseCustomProvider(raw.customProvider, diagnostics, `${pathPrefix}.customProvider`);
  if (customProvider) {
    result.customProvider = customProvider;
  }

  // Soft-deprecate removed legacy fields. Emit warnings + ignore so existing
  // yamls don't break during migration to provider/apiKey/endpoint.
  if (raw.region !== undefined) {
    diagnostics.push({
      code: "TOOLS_WEB_SEARCH_REGION_DEPRECATED",
      severity: "warning",
      message:
        "tools.webSearch.region has been removed. Select tools.webSearch.provider instead.",
      path: `${pathPrefix}.region`,
      recoverable: true,
    });
  }
  if (raw.tavilyApiKey !== undefined) {
    diagnostics.push({
      code: "TOOLS_WEB_SEARCH_TAVILY_KEY_DEPRECATED",
      severity: "warning",
      message:
        "tools.webSearch.tavilyApiKey has been removed. Set tools.webSearch.provider: tavily and use tools.webSearch.apiKey.",
      path: `${pathPrefix}.tavilyApiKey`,
      recoverable: true,
    });
  }

  for (const key of Object.keys(raw)) {
    if (key !== "provider" && key !== "apiKey" && key !== "endpoint" && key !== "customProvider" && key !== "region" && key !== "tavilyApiKey") {
      diagnostics.push({
        code: "TOOLS_WEB_SEARCH_UNKNOWN_FIELD",
        severity: "warning",
        message: `Unknown ${pathPrefix} field ${key}.`,
        path: `${pathPrefix}.${key}`,
        recoverable: true,
      });
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function parseCustomProvider(
  raw: unknown,
  diagnostics: PilotConfigDiagnostic[],
  pathPrefix: string,
): NonNullable<PilotWebSearchConfig["customProvider"]> | undefined {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) {
    diagnostics.push({
      code: "TOOLS_WEB_SEARCH_CUSTOM_PROVIDER_INVALID",
      severity: "fatal",
      message: `${pathPrefix} must be an object.`,
      path: pathPrefix,
      recoverable: false,
    });
    return undefined;
  }

  const result: NonNullable<PilotWebSearchConfig["customProvider"]> = {};
  const auth = parseEnumField<PilotWebSearchCustomAuth>(
    raw.auth,
    ["bearer", "bodyApiKey", "queryApiKey", "none"],
    `${pathPrefix}.auth`,
    "TOOLS_WEB_SEARCH_CUSTOM_AUTH_INVALID",
    diagnostics,
  );
  if (auth) result.auth = auth;

  const method = parseEnumField<PilotWebSearchCustomMethod>(
    raw.method,
    ["GET", "POST"],
    `${pathPrefix}.method`,
    "TOOLS_WEB_SEARCH_CUSTOM_METHOD_INVALID",
    diagnostics,
  );
  if (method) result.method = method;

  for (const field of [
    "name",
    "queryParam",
    "apiKeyParam",
    "resultsPath",
    "titleField",
    "urlField",
    "snippetField",
    "sourceField",
    "publishedAtField",
  ] as const) {
    const parsed = parseOptionalStringField(raw[field], `${pathPrefix}.${field}`, diagnostics);
    if (parsed !== undefined) {
      result[field] = parsed;
    }
  }

  for (const key of Object.keys(raw)) {
    if (
      key !== "auth" &&
      key !== "name" &&
      key !== "method" &&
      key !== "queryParam" &&
      key !== "apiKeyParam" &&
      key !== "resultsPath" &&
      key !== "titleField" &&
      key !== "urlField" &&
      key !== "snippetField" &&
      key !== "sourceField" &&
      key !== "publishedAtField"
    ) {
      diagnostics.push({
        code: "TOOLS_WEB_SEARCH_CUSTOM_PROVIDER_UNKNOWN_FIELD",
        severity: "warning",
        message: `Unknown ${pathPrefix} field ${key}.`,
        path: `${pathPrefix}.${key}`,
        recoverable: true,
      });
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function parseEnumField<T extends string>(
  raw: unknown,
  allowed: readonly T[],
  path: string,
  code: string,
  diagnostics: PilotConfigDiagnostic[],
): T | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== "string" || !allowed.includes(raw as T)) {
    diagnostics.push({
      code,
      severity: "fatal",
      message: `${path} must be one of: ${allowed.join(", ")}.`,
      path,
      recoverable: false,
    });
    return undefined;
  }
  return raw as T;
}

function parseOptionalStringField(
  raw: unknown,
  path: string,
  diagnostics: PilotConfigDiagnostic[],
): string | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    diagnostics.push({
      code: "TOOLS_WEB_SEARCH_CUSTOM_STRING_INVALID",
      severity: "fatal",
      message: `${path} must be a non-empty string.`,
      path,
      recoverable: false,
    });
    return undefined;
  }
  return raw.trim();
}

function parseMediaToolConfig(
  raw: unknown,
  diagnostics: PilotConfigDiagnostic[],
  pathPrefix: "tools.image" | "tools.video" | "tools.tts" | "tools.speech",
  env: CredentialEnv,
): PilotMediaToolConfig | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    diagnostics.push({
      code: "TOOLS_MEDIA_INVALID",
      severity: "fatal",
      message: `${pathPrefix} must be an object.`,
      path: pathPrefix,
      recoverable: false,
    });
    return undefined;
  }

  const result: PilotMediaToolConfig = {};
  const provider = parseEnumField<PilotMediaProvider>(
    raw.provider,
    ["openai-compatible", "google", "qwen", "volcengine", "baidu", "azure", "cloud"],
    `${pathPrefix}.provider`,
    "TOOLS_MEDIA_PROVIDER_INVALID",
    diagnostics,
  );
  if (provider) {
    result.provider = provider;
  }

  const apiKey = parseOptionalStringField(raw.apiKey, `${pathPrefix}.apiKey`, diagnostics);
  if (apiKey !== undefined) {
    try {
      result.apiKey = resolveApiKey(apiKey, env);
    } catch (error) {
      diagnostics.push({
        code: "TOOLS_MEDIA_API_KEY_INVALID",
        severity: "warning",
        message:
          error instanceof Error
            ? error.message
            : `${pathPrefix}.apiKey could not be resolved.`,
        path: `${pathPrefix}.apiKey`,
        recoverable: true,
      });
      result.apiKey = apiKey;
    }
  }
  const baseUrl = parseOptionalStringField(raw.baseUrl, `${pathPrefix}.baseUrl`, diagnostics);
  if (baseUrl !== undefined) {
    result.baseUrl = baseUrl;
  }
  const model = parseOptionalStringField(raw.model, `${pathPrefix}.model`, diagnostics);
  if (model !== undefined) {
    result.model = model;
  }

  for (const key of Object.keys(raw)) {
    if (key !== "provider" && key !== "apiKey" && key !== "baseUrl" && key !== "model") {
      diagnostics.push({
        code: "TOOLS_MEDIA_UNKNOWN_FIELD",
        severity: "warning",
        message: `Unknown ${pathPrefix} field ${key}.`,
        path: `${pathPrefix}.${key}`,
        recoverable: true,
      });
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}
