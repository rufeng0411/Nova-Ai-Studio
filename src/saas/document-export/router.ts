// PD-SAAS-FORK: export_document routing — build IR and select Provider
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { buildDocumentIr, detectSourceKind, isScanSource } from "./buildIr.js";
import { inferTaskArtifactDirFromSourcePath } from "./enrichIrFromVisualManifest.js";
import { getDocumentExportRegistry } from "./providerRegistry.js";
import { closePlaywrightPool } from "./playwrightPool.js";
import { registerBuiltinDocumentExportProviders } from "./providers/registerBuiltinProviders.js";
import type {
  DocumentExportContext,
  ExportDocumentOptions,
  ExportInput,
  ExportResult,
  OutputFormat,
} from "./types.js";

const OUTPUT_EXT: Record<OutputFormat, string> = {
  pdf: ".pdf",
  docx: ".docx",
  pptx: ".pptx",
  xlsx: ".xlsx",
};

export type RouteExportDocumentParams = {
  sourceAbsolutePath: string;
  sourcePath: string;
  workspaceRoot: string;
  outputFormat: OutputFormat;
  outputAbsolutePath?: string;
  options?: ExportDocumentOptions;
  ctx: DocumentExportContext;
  sessionId?: string;
  goalVersion?: number;
  taskArtifactDir?: string;
};

export async function routeExportDocument(params: RouteExportDocumentParams): Promise<ExportResult> {
  registerBuiltinDocumentExportProviders();

  const kind = detectSourceKind(params.sourceAbsolutePath);
  if (kind === "image" && params.outputFormat !== "pptx") {
    throw new Error(
      "For image-only inputs use compose_images_to_document (multi-image PDF/PPTX) or export_document with output_format=pptx for OCR.",
    );
  }

  const options: ExportDocumentOptions = {
    quality: params.options?.quality ?? params.ctx.documentExport.defaultQuality,
    cloud_preference: params.options?.cloud_preference ?? params.ctx.documentExport.cloudPreference,
    include_editable_text:
      params.options?.include_editable_text ?? (kind === "html" ? false : true),
    page_size: params.options?.page_size,
    design_profile: params.options?.design_profile,
  };

  const outputAbsolutePath =
    params.outputAbsolutePath ??
    (await defaultOutputPath(params.workspaceRoot, params.sourceAbsolutePath, params.outputFormat));
  await mkdir(path.dirname(outputAbsolutePath), { recursive: true });

  const enrichMultimodal = !isScanSource(params.sourceAbsolutePath);
  const taskArtifactDir =
    params.taskArtifactDir
    ?? inferTaskArtifactDirFromSourcePath(params.sourcePath);
  const ir = await buildDocumentIr(params.sourceAbsolutePath, params.workspaceRoot, {
    enrichMultimodal,
    env: params.ctx.env,
    sessionId: params.sessionId,
    goalVersion: params.goalVersion,
    taskArtifactDir,
  });

  const input: ExportInput = {
    sourcePath: params.sourcePath,
    sourceAbsolutePath: params.sourceAbsolutePath,
    outputFormat: params.outputFormat,
    outputAbsolutePath,
    workspaceRoot: params.workspaceRoot,
    options,
  };

  try {
    return await getDocumentExportRegistry().renderWithFallback(params.ctx, input, ir);
  } finally {
    if (params.ctx.env.PILOTDECK_EXPORT_CLOSE_POOL === "1") {
      await closePlaywrightPool();
    }
  }
}

async function defaultOutputPath(
  workspaceRoot: string,
  sourceAbsolutePath: string,
  format: OutputFormat,
): Promise<string> {
  const base = path.basename(sourceAbsolutePath, path.extname(sourceAbsolutePath));
  const fileName = `${base}-export${OUTPUT_EXT[format]}`;
  return path.join(workspaceRoot, "artifacts", "documents", fileName);
}
