// PD-SAAS-FORK: resolve tools.documentImport from pilotdeck.yaml + env
import type { CredentialEnv } from "../../model/config/resolveCredentials.js";
import type {
  PilotDocumentImportConfig,
  PilotDocumentOcrConfig,
  PilotDocumentToolsConfig,
} from "./types.js";
import type { ImportCloudPreference, ResolvedDocumentImportConfig } from "../../saas/document-import/types.js";
import {
  resolveDocumentOcrConfig,
} from "./resolveDocumentToolConfig.js";
import { modelConfigToProviderSlices } from "./resolveMediaFromModelProviders.js";
import type { ModelConfig } from "../../model/protocol/canonical.js";

export type { ResolvedDocumentImportConfig };

const DEFAULT_IMPORT_PROVIDERS: Record<string, boolean | "auto"> = {
  "mupdf-pdf": true,
  "mammoth-docx": true,
  "exceljs-xlsx": true,
  "python-pptx": true,
  "mineru-cloud": "auto",
};

const DEFAULT_MAX_BYTES = {
  pdf: 20 * 1024 * 1024,
  office: 10 * 1024 * 1024,
};

const DEFAULT_TRUNCATE = {
  maxChars: 120_000,
  maxTableRows: 200,
};

function readImportCloudPreference(
  explicit: PilotDocumentImportConfig | undefined,
  env: CredentialEnv,
): ImportCloudPreference {
  const fromYaml = explicit?.cloudPreference;
  if (fromYaml === "local_first" || fromYaml === "cloud_first" || fromYaml === "local_only") {
    return fromYaml;
  }
  const fromEnv = String(env.PILOTDECK_DOCUMENT_IMPORT_CLOUD ?? "").trim();
  if (fromEnv === "local_first" || fromEnv === "cloud_first" || fromEnv === "local_only") {
    return fromEnv;
  }
  return "local_first";
}

export function resolveDocumentImportConfig(
  tools: {
    document?: PilotDocumentToolsConfig;
    documentImport?: PilotDocumentImportConfig;
    documentOcr?: PilotDocumentOcrConfig;
  } | undefined,
  env: CredentialEnv = process.env,
): ResolvedDocumentImportConfig {
  const explicit = tools?.document?.import ?? tools?.documentImport;
  const enabled =
    explicit?.enabled
    ?? (env.PILOTDECK_DOCUMENT_IMPORT_ENABLED !== "0"
      && env.PILOTDECK_DOCUMENT_IMPORT_ENABLED !== "false");
  const workerRaw = explicit?.workerConcurrency ?? Number(env.PILOTDECK_IMPORT_WORKER_CONCURRENCY ?? 4);
  const timeoutRaw = explicit?.timeoutMs ?? Number(env.PILOTDECK_IMPORT_TIMEOUT_MS ?? 30_000);
  const pdfLimit = explicit?.maxFileBytes?.pdf ?? Number(env.PILOTDECK_DOCUMENT_IMPORT_MAX_PDF_BYTES ?? DEFAULT_MAX_BYTES.pdf);
  const officeLimit =
    explicit?.maxFileBytes?.office ?? Number(env.PILOTDECK_DOCUMENT_IMPORT_MAX_OFFICE_BYTES ?? DEFAULT_MAX_BYTES.office);
  const maxChars = explicit?.truncate?.maxChars ?? DEFAULT_TRUNCATE.maxChars;
  const maxTableRows = explicit?.truncate?.maxTableRows ?? DEFAULT_TRUNCATE.maxTableRows;
  const fallbackProvider =
    explicit?.fallbackProvider
    ?? (env.PILOTDECK_DOCUMENT_IMPORT_FALLBACK === "qwen-vl" ? "qwen-vl" : "mineru");

  return {
    enabled: Boolean(enabled),
    cloudPreference: readImportCloudPreference(explicit, env),
    workerConcurrency: Number.isFinite(workerRaw) && workerRaw > 0 ? workerRaw : 4,
    timeoutMs: Number.isFinite(timeoutRaw) && timeoutRaw >= 1000 ? timeoutRaw : 30_000,
    maxFileBytes: {
      pdf: Number.isFinite(pdfLimit) && pdfLimit > 0 ? pdfLimit : DEFAULT_MAX_BYTES.pdf,
      office: Number.isFinite(officeLimit) && officeLimit > 0 ? officeLimit : DEFAULT_MAX_BYTES.office,
    },
    truncate: {
      maxChars: Number.isFinite(maxChars) && maxChars > 0 ? maxChars : DEFAULT_TRUNCATE.maxChars,
      maxTableRows: Number.isFinite(maxTableRows) && maxTableRows > 0 ? maxTableRows : DEFAULT_TRUNCATE.maxTableRows,
    },
    fallbackProvider,
    enabledProviders: { ...DEFAULT_IMPORT_PROVIDERS, ...(explicit?.providers ?? {}) },
  };
}

export function resolveDocumentImportFromTools(
  tools: {
    document?: PilotDocumentToolsConfig;
    documentImport?: PilotDocumentImportConfig;
    documentOcr?: PilotDocumentOcrConfig;
  } | undefined,
  modelConfig: ModelConfig | undefined,
  env: CredentialEnv = process.env,
): {
  documentImport: ResolvedDocumentImportConfig;
  ocr?: ReturnType<typeof resolveDocumentOcrConfig>;
} {
  const documentImport = resolveDocumentImportConfig(tools, env);
  const ocrExplicit = tools?.document?.ocr ?? tools?.documentOcr;
  const ocr = resolveDocumentOcrConfig(
    ocrExplicit,
    modelConfigToProviderSlices(modelConfig),
    env,
    undefined,
  );
  return { documentImport, ocr };
}

export function applyDocumentImportRuntimeEnv(
  env: NodeJS.ProcessEnv,
  config: ResolvedDocumentImportConfig,
): void {
  env.PILOTDECK_DOCUMENT_IMPORT_ENABLED = config.enabled ? "1" : "0";
  env.PILOTDECK_DOCUMENT_IMPORT_CLOUD = config.cloudPreference;
  env.PILOTDECK_IMPORT_WORKER_CONCURRENCY = String(config.workerConcurrency);
  env.PILOTDECK_IMPORT_TIMEOUT_MS = String(config.timeoutMs);
  env.PILOTDECK_DOCUMENT_IMPORT_MAX_PDF_BYTES = String(config.maxFileBytes.pdf);
  env.PILOTDECK_DOCUMENT_IMPORT_MAX_OFFICE_BYTES = String(config.maxFileBytes.office);
  env.PILOTDECK_DOCUMENT_IMPORT_MAX_CHARS = String(config.truncate.maxChars);
  env.PILOTDECK_DOCUMENT_IMPORT_MAX_TABLE_ROWS = String(config.truncate.maxTableRows);
  env.PILOTDECK_DOCUMENT_IMPORT_FALLBACK = config.fallbackProvider;
}
