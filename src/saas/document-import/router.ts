// PD-SAAS-FORK: document import routing entry
import { stat } from "node:fs/promises";
import path from "node:path";
import { checkDocumentImportRateLimit } from "./documentImportRateLimit.js";
import { detectImportKind, isOfficeImportKind, maxBytesForKind } from "./detectImportKind.js";
import { getImportWorkerPool } from "./importWorkerPool.js";
import { getDocumentImportRegistry } from "./providerRegistry.js";
import { registerBuiltinDocumentImportProviders } from "./providers/registerBuiltinProviders.js";
import type { DocumentImportContext, ImportResult } from "./types.js";

export type RouteImportDocumentParams = {
  sourceAbsolutePath: string;
  sourcePath: string;
  workspaceRoot: string;
  ctx: DocumentImportContext;
};

export async function routeImportDocument(params: RouteImportDocumentParams): Promise<ImportResult> {
  if (!params.ctx.documentImport.enabled) {
    return {
      status: "skipped",
      charCount: 0,
      durationMs: 0,
      reason: "Document import is disabled in settings.",
    };
  }

  registerBuiltinDocumentImportProviders();

  const kind = detectImportKind(params.sourceAbsolutePath);
  if (kind === "unknown") {
    return {
      status: "skipped",
      charCount: 0,
      durationMs: 0,
      reason: `Unsupported attachment type for import: ${path.extname(params.sourceAbsolutePath)}`,
    };
  }

  let fileStat;
  try {
    fileStat = await stat(params.sourceAbsolutePath);
  } catch (error) {
    return {
      status: "skipped",
      charCount: 0,
      durationMs: 0,
      reason: `Attachment not found: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const limit = maxBytesForKind(kind, params.ctx.documentImport.maxFileBytes);
  if (fileStat.size > limit) {
    return {
      status: "skipped",
      charCount: 0,
      durationMs: 0,
      reason: `Attachment exceeds import size limit (${fileStat.size} > ${limit} bytes).`,
    };
  }

  const input = {
    sourceAbsolutePath: params.sourceAbsolutePath,
    sourcePath: params.sourcePath,
    kind,
    fileSizeBytes: fileStat.size,
  };

  const pool = getImportWorkerPool(
    params.ctx.documentImport.workerConcurrency,
    params.ctx.documentImport.timeoutMs,
  );

  const rate = checkDocumentImportRateLimit(params.ctx.tenantId);
  if (!rate.allowed) {
    return {
      status: "skipped",
      charCount: 0,
      durationMs: 0,
      reason: "import_rate_limited",
    };
  }

  const started = Date.now();
  try {
    const registry = getDocumentImportRegistry();
    const result = await pool.run(() => registry.parseWithFallback(params.ctx, input));
    console.error(
      `[document-import] provider=${result.providerId ?? "none"} kind=${kind} bytes=${fileStat.size} durationMs=${Date.now() - started} tenant=${params.ctx.tenantId ?? "local"}`,
    );
    return { ...result, durationMs: Date.now() - started };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("timed out")) {
      return {
        status: "skipped",
        charCount: 0,
        durationMs: Date.now() - started,
        reason: "import_timeout",
      };
    }
    return {
      status: "skipped",
      charCount: 0,
      durationMs: Date.now() - started,
      reason: message,
    };
  }
}

export function shouldAutoImportPath(filePath: string): boolean {
  const kind = detectImportKind(filePath);
  return kind === "pdf" || isOfficeImportKind(kind);
}
