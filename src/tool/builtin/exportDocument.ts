import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { PermissionResult } from "../../permission/index.js";
import type { ExportOcrRuntimeConfig, ResolvedDocumentExportConfig } from "../../saas/document-export/types.js";
import { routeExportDocument } from "../../saas/document-export/router.js";
import { configurePlaywrightPool } from "../../saas/document-export/playwrightPool.js";
import { PilotDeckToolRuntimeError } from "../protocol/errors.js";
import type {
  PilotDeckToolDefinition,
  PilotDeckToolRuntimeContext,
} from "../protocol/types.js";
import { resolvePilotDeckWorkspacePath } from "./filesystem/pathSafety.js";
import { matchPathToSequentialGate } from "../../saas/taskState/sequentialDeliverableGate.js";
import { isSequentialDeliverablesEnabled } from "../../saas/resilience/stabilityFlags.js";
import { isParallelOfficeExportAllowed } from "../../saas/taskState/parallelWritePolicy.js";
import { recordToolTimingEvent } from "../../telemetry/stabilityEvents.js";

/** PD-SAAS-FORK: export_document builtin — MD/HTML → PDF/DOCX/PPTX/XLSX */
export type CreateExportDocumentToolOptions = {
  documentExport?: ResolvedDocumentExportConfig;
  documentOcr?: ExportOcrRuntimeConfig;
};

export type ExportDocumentInput = {
  source_path: string;
  output_format: "pdf" | "docx" | "pptx" | "xlsx";
  output_path?: string;
  options?: {
    quality?: "fast" | "balanced" | "fidelity";
    page_size?: string;
    include_editable_text?: boolean;
    cloud_preference?: "cloud_first" | "local_only";
    design_profile?: string;
  };
};

export type ExportDocumentOutput = {
  format: ExportDocumentInput["output_format"];
  outputPath: string;
  relativePath: string;
  providerId: string;
};

const SOURCE_EXT = new Set([
  ".md", ".markdown", ".html", ".htm", ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp",
  ".ppt", ".pptx", ".csv", ".tsv", ".xlsx", ".xls",
]);

export function createExportDocumentTool(
  options: CreateExportDocumentToolOptions = {},
): PilotDeckToolDefinition<ExportDocumentInput, ExportDocumentOutput> {
  return {
    name: "export_document",
    aliases: ["ExportDocument"],
    description:
      "Export a workspace Markdown or HTML file (or scan PDF/image for editable PPTX) to PDF, Word (.docx), PowerPoint (.pptx), or Excel (.xlsx). Prefer this for one-click deliverables. Do NOT use for multi-image one-per-page albums (use compose_images_to_document). For scan/OCR-only PPTX you may also use ocr_to_editable_pptx. For deep template editing use anth-docx/pptx/xlsx skills.",
    kind: "shell",
    inputSchema: {
      type: "object",
      required: ["source_path", "output_format"],
      additionalProperties: false,
      properties: {
        source_path: {
          type: "string",
          description: "Workspace path to .md, .html, scan PDF, or image.",
        },
        output_format: {
          type: "string",
          enum: ["pdf", "docx", "pptx", "xlsx"],
        },
        output_path: { type: "string", description: "Optional workspace output path." },
        options: {
          type: "object",
          additionalProperties: false,
          properties: {
            quality: { type: "string", enum: ["fast", "balanced", "fidelity"] },
            page_size: { type: "string", description: "A4, Letter, or 16:9 for slides/PDF." },
            include_editable_text: { type: "boolean", description: "PPTX: keep editable text boxes (default true)." },
            cloud_preference: { type: "string", enum: ["cloud_first", "local_only"] },
            design_profile: { type: "string", description: "PDF design profile for minimax-pdf (fidelity)." },
          },
        },
      },
    },
    isReadOnly: () => false,
    isConcurrencySafe: (input) => {
      const outputPath = String(input.output_path ?? "").trim();
      if (!outputPath) return false;
      return isParallelOfficeExportAllowed(outputPath);
    },
    isOpenWorld: () => true,
    checkPermissions: async (input, context): Promise<PermissionResult> => {
      const outputPath = String(input.output_path ?? "").trim();
      if (
        outputPath
        && isSequentialDeliverablesEnabled()
        && context.sessionDeliverableManifest
      ) {
        const gate = matchPathToSequentialGate(
          outputPath,
          context.sessionDeliverableManifest,
          { toolName: "export_document" },
        );
        if (!gate.allowed) {
          return {
            type: "deny",
            reason: {
              type: "tool",
              toolName: "export_document",
              message: gate.reason ?? "Sequential deliverable gate blocked export.",
            },
            message: gate.reason ?? "Sequential deliverable gate blocked export.",
          };
        }
      }
      return {
      type: "ask",
      reason: {
        type: "tool",
        toolName: "export_document",
        message: "Document export runs local renderers and may use cloud OCR.",
      },
      request: {
        toolCallId: "",
        toolName: "export_document",
        inputSummary: "export document",
        reason: {
          type: "tool",
          toolName: "export_document",
          message: "Document export runs local renderers and may use cloud OCR.",
        },
        options: [
          { id: "allow_once", label: "Allow export" },
          { id: "deny", label: "Deny" },
        ],
      },
    };
    },
    execute: async (input, context) => {
      const exportConfig = resolveExportConfig(options, context);
      configurePlaywrightPool(exportConfig.playwrightPoolSize);

      const sourceRel = input.source_path.trim();
      const resolved = resolvePilotDeckWorkspacePath(sourceRel, context, { mustExist: true });
      if (!resolved.ok) {
        throw new PilotDeckToolRuntimeError(resolved.error.code, resolved.error.message, resolved.error.details);
      }
      const ext = path.extname(resolved.absolutePath).toLowerCase();
      if (!SOURCE_EXT.has(ext)) {
        throw new PilotDeckToolRuntimeError(
          "invalid_tool_input",
          `export_document unsupported source type: ${sourceRel}. Use .md, .html, .pdf, or images.`,
        );
      }

      let outputAbsolutePath: string | undefined;
      let outputRelative = "";
      if (input.output_path?.trim()) {
        const out = resolvePilotDeckWorkspacePath(input.output_path.trim(), context, { forWrite: true });
        if (!out.ok) {
          throw new PilotDeckToolRuntimeError(out.error.code, out.error.message, out.error.details);
        }
        outputAbsolutePath = out.absolutePath;
        outputRelative = out.relativePath.split(path.sep).join("/");
        await mkdir(path.dirname(out.absolutePath), { recursive: true });
      }

      const ocr = resolveOcrConfig(options, context);
      const startedMs = Date.now();
      const result = await routeExportDocument({
        sourceAbsolutePath: resolved.absolutePath,
        sourcePath: resolved.relativePath.split(path.sep).join("/"),
        workspaceRoot: context.cwd,
        outputFormat: input.output_format,
        outputAbsolutePath,
        options: input.options,
        sessionId: context.sessionId,
        goalVersion: context.taskGoalVersion,
        taskArtifactDir: context.taskArtifactDir,
        ctx: {
          cwd: context.cwd,
          env: context.env ?? process.env,
          documentExport: exportConfig,
          documentOcr: ocr,
        },
      });

      recordToolTimingEvent({
        sessionId: context.sessionId,
        turnId: context.turnId,
        toolName: "export_document",
        durationMs: Date.now() - startedMs,
        phase: input.output_format,
      });

      const relative = outputRelative || result.relativePath;
      const data: ExportDocumentOutput = {
        format: input.output_format,
        outputPath: result.outputAbsolutePath,
        relativePath: relative,
        providerId: result.providerId,
      };
      const mimeByFormat: Record<ExportDocumentInput["output_format"], string> = {
        pdf: "application/pdf",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
      return {
        content: [
          { type: "text", text: `Exported ${relative} via ${result.providerId}.` },
          {
            type: "file",
            path: result.outputAbsolutePath,
            mimeType: mimeByFormat[input.output_format],
            description: `Exported ${input.output_format.toUpperCase()}`,
          },
        ],
        data,
      };
    },
  };
}

function resolveExportConfig(
  options: CreateExportDocumentToolOptions,
  context: PilotDeckToolRuntimeContext,
): ResolvedDocumentExportConfig {
  if (options.documentExport) return options.documentExport;
  const env = context.env ?? process.env;
  return {
    cloudPreference:
      (env.PILOTDECK_DOCUMENT_EXPORT_CLOUD as "cloud_first" | "local_only" | undefined) ?? "cloud_first",
    defaultQuality:
      (env.PILOTDECK_DOCUMENT_EXPORT_QUALITY as "fast" | "balanced" | "fidelity" | undefined) ?? "balanced",
    playwrightPoolSize: Number(env.PILOTDECK_DOCUMENT_EXPORT_POOL_SIZE ?? 1) || 1,
    nutrientApiKey: env.NUTRIENT_API_KEY ?? env.PILOTDECK_NUTRIENT_API_KEY,
    enabledProviders: {
      "playwright-pdf": true,
      "docx-js": true,
      "python-pptx-ir": true,
      exceljs: true,
      "mineru-ocr-pptx": true,
      nutrient: "auto",
      "minimax-pdf": true,
    },
  };
}

function resolveOcrConfig(
  options: CreateExportDocumentToolOptions,
  context: PilotDeckToolRuntimeContext,
): ExportOcrRuntimeConfig | undefined {
  if (options.documentOcr) return options.documentOcr;
  const env = context.env ?? process.env;
  const apiKey = String(env.MINERU_API_TOKEN ?? env.PILOTDECK_DOCUMENT_OCR_API_KEY ?? "").trim();
  const dashscope = String(env.DASHSCOPE_API_KEY ?? "").trim();
  if (!apiKey && !dashscope) return undefined;
  return {
    provider: (env.PILOTDECK_DOCUMENT_OCR_PROVIDER as "mineru" | "qwen-vl" | undefined) ?? "mineru",
    mode: (env.PILOTDECK_DOCUMENT_OCR_MODE as "cloud" | "local" | undefined) ?? "cloud",
    apiUrl: String(env.PILOTDECK_DOCUMENT_OCR_API_URL ?? "https://mineru.net/api/v4").replace(/\/+$/, ""),
    apiKey: apiKey || undefined,
    model: String(env.PILOTDECK_DOCUMENT_OCR_MODEL ?? "qwen-vl-max"),
    fallbackProvider: (env.PILOTDECK_DOCUMENT_OCR_FALLBACK as "mineru" | "qwen-vl" | undefined) ?? "qwen-vl",
    dashscopeApiKey: dashscope || undefined,
  };
}
