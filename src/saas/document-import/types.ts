// PD-SAAS-FORK: document import provider contracts
import type { DocumentIr } from "../document-export/types.js";
import type { ResolvedDocumentOcrConfig } from "../../pilot/config/resolveDocumentToolConfig.js";

export type ImportCloudPreference = "local_first" | "cloud_first" | "local_only";

export type ImportKind = "pdf" | "docx" | "xlsx" | "pptx" | "csv" | "unknown";

export type ImportStatus = "ok" | "skipped" | "insufficient_content";

export type ResolvedDocumentImportConfig = {
  enabled: boolean;
  cloudPreference: ImportCloudPreference;
  workerConcurrency: number;
  timeoutMs: number;
  maxFileBytes: { pdf: number; office: number };
  truncate: { maxChars: number; maxTableRows: number };
  fallbackProvider: "mineru" | "qwen-vl";
  enabledProviders: Record<string, boolean | "auto">;
};

export type DocumentImportContext = {
  workspaceRoot: string;
  documentImport: ResolvedDocumentImportConfig;
  ocr?: ResolvedDocumentOcrConfig;
  env?: NodeJS.ProcessEnv;
  tenantId?: string;
};

export type ImportInput = {
  sourceAbsolutePath: string;
  sourcePath: string;
  kind: ImportKind;
  fileSizeBytes: number;
};

export type ImportResult = {
  status: ImportStatus;
  providerId?: string;
  ir?: DocumentIr;
  text?: string;
  charCount: number;
  durationMs: number;
  reason?: string;
  truncated?: boolean;
};

export type ProviderAvailability = "ready" | "needs_config" | "unavailable";

export type IntegrationLevel = "L2" | "cloud";

export interface DocumentImportProvider {
  id: string;
  kinds: ImportKind[];
  integrationLevel: IntegrationLevel;
  priority: number;
  availability(ctx: DocumentImportContext): ProviderAvailability;
  canHandle(input: ImportInput, ctx: DocumentImportContext): boolean;
  parse(ctx: DocumentImportContext, input: ImportInput): Promise<ImportResult>;
}
