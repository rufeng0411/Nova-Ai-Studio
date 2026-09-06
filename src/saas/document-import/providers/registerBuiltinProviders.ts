// PD-SAAS-FORK: register built-in document import providers
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseSpreadsheetToIr } from "../../document-export/parseSpreadsheet.js";
import { getDocumentImportRegistry } from "../providerRegistry.js";
import { mineruJsonToIr } from "../mineruJsonToIr.js";
import { parseDocxToIr } from "../parseDocx.js";
import { extractPdfTextToIr } from "../parsePdfText.js";
import { irToAttachmentText } from "../irToAttachmentText.js";
import { isPythonAvailable, runPythonImportScript } from "../runImportScript.js";
import type {
  DocumentImportContext,
  DocumentImportProvider,
  ImportInput,
  ImportResult,
  ProviderAvailability,
} from "../types.js";

let registered = false;
let pythonAvailable: boolean | undefined;

async function checkPython(): Promise<boolean> {
  if (pythonAvailable === undefined) {
    pythonAvailable = await isPythonAvailable();
  }
  return pythonAvailable;
}

function finishIr(
  providerId: string,
  ir: NonNullable<ImportResult["ir"]>,
  input: ImportInput,
  ctx: DocumentImportContext,
): ImportResult {
  const { text, truncated } = irToAttachmentText(ir, {
    maxChars: ctx.documentImport.truncate.maxChars,
    maxTableRows: ctx.documentImport.truncate.maxTableRows,
    sourcePath: input.sourcePath,
    providerId,
  });
  return {
    status: "ok",
    providerId,
    ir,
    text,
    charCount: text.length,
    durationMs: 0,
    truncated,
  };
}

function localProvider(
  id: string,
  kinds: DocumentImportProvider["kinds"],
  priority: number,
  parseFn: (ctx: DocumentImportContext, input: ImportInput) => Promise<ImportResult>,
): DocumentImportProvider {
  return {
    id,
    kinds,
    integrationLevel: "L2",
    priority,
    availability: () => "ready",
    canHandle: (input) => kinds.includes(input.kind),
    parse: parseFn,
  };
}

function mineruAvailability(ctx: DocumentImportContext): ProviderAvailability {
  const flag = ctx.documentImport.enabledProviders["mineru-cloud"];
  if (flag === false) return "unavailable";
  if (!ctx.ocr?.apiKey && !ctx.ocr?.dashscopeApiKey) return "needs_config";
  return "ready";
}

async function parsePdfLocal(ctx: DocumentImportContext, input: ImportInput): Promise<ImportResult> {
  const buffer = await readFile(input.sourceAbsolutePath);
  const extracted = await extractPdfTextToIr(buffer, input.sourcePath);
  if (extracted.insufficientContent) {
    return {
      status: "insufficient_content",
      providerId: "mupdf-pdf",
      ir: extracted.ir,
      charCount: extracted.charCount,
      durationMs: 0,
      reason: "PDF text layer too short; try cloud OCR fallback.",
    };
  }
  return finishIr("mupdf-pdf", extracted.ir, input, ctx);
}

async function parseDocxLocal(ctx: DocumentImportContext, input: ImportInput): Promise<ImportResult> {
  const ir = await parseDocxToIr(input.sourceAbsolutePath, input.sourcePath);
  if (ir.blocks.length < 1 && input.fileSizeBytes > 50_000) {
    return {
      status: "insufficient_content",
      providerId: "mammoth-docx",
      ir,
      charCount: 0,
      durationMs: 0,
    };
  }
  return finishIr("mammoth-docx", ir, input, ctx);
}

async function parseSpreadsheetLocal(ctx: DocumentImportContext, input: ImportInput): Promise<ImportResult> {
  const ir = await parseSpreadsheetToIr(input.sourceAbsolutePath, ctx.workspaceRoot);
  return finishIr("exceljs-xlsx", ir, input, ctx);
}

async function parsePptxLocal(ctx: DocumentImportContext, input: ImportInput): Promise<ImportResult> {
  const scriptPath = path.resolve(process.cwd(), "scripts", "parse-pptx-text.py");
  const proc = await runPythonImportScript(scriptPath, ["--input", input.sourceAbsolutePath], ctx.env ?? process.env);
  if (proc.exitCode !== 0) {
    throw new Error(proc.stderr.trim() || "python-pptx text extraction failed");
  }
  const payload = JSON.parse(proc.stdout.trim()) as { slides?: Array<{ slide?: string; text?: string }> };
  const blocks = (payload.slides ?? [])
    .filter((s) => s.text?.trim())
    .flatMap((s) => [
      { type: "heading" as const, level: 2, text: `Slide ${s.slide ?? "?"}` },
      { type: "paragraph" as const, text: String(s.text).trim() },
    ]);
  const ir = {
    sourcePath: input.sourcePath,
    sourceKind: "unknown" as const,
    title: input.sourcePath.split("/").pop(),
    blocks,
  };
  if (blocks.length < 2 && input.fileSizeBytes > 50_000) {
    return { status: "insufficient_content", providerId: "python-pptx", ir, charCount: 0, durationMs: 0 };
  }
  return finishIr("python-pptx", ir, input, ctx);
}

async function parseMineruCloud(ctx: DocumentImportContext, input: ImportInput): Promise<ImportResult> {
  const ocr = ctx.ocr;
  if (!ocr?.apiKey) {
    return {
      status: "skipped",
      charCount: 0,
      durationMs: 0,
      reason: "需配置版面识别 Token 才能解析扫描件。",
    };
  }
  const scriptPath = path.resolve(process.cwd(), "scripts", "mineru-import-client.py");
  const env = {
    ...(ctx.env ?? process.env),
    MINERU_API_TOKEN: ocr.apiKey,
    PILOTDECK_DOCUMENT_OCR_API_URL: ocr.apiUrl,
    PILOTDECK_DOCUMENT_OCR_MODE: ocr.mode,
  };
  const proc = await runPythonImportScript(
    scriptPath,
    ["--input", input.sourceAbsolutePath, "--api-url", ocr.apiUrl, "--mode", ocr.mode],
    env,
  );
  if (proc.exitCode !== 0) {
    throw new Error(proc.stderr.trim() || proc.stdout.trim() || "MinerU cloud import failed");
  }
  const payload = JSON.parse(proc.stdout.trim());
  const ir = mineruJsonToIr(payload, input.sourcePath);
  return finishIr("mineru-cloud", ir, input, ctx);
}

export function registerBuiltinDocumentImportProviders(): void {
  if (registered) return;
  registered = true;
  const registry = getDocumentImportRegistry();

  registry.register(localProvider("mupdf-pdf", ["pdf"], 50, parsePdfLocal));
  registry.register(localProvider("mammoth-docx", ["docx"], 50, parseDocxLocal));
  registry.register(localProvider("exceljs-xlsx", ["xlsx", "csv"], 50, parseSpreadsheetLocal));
  registry.register({
    id: "python-pptx",
    kinds: ["pptx"],
    integrationLevel: "L2",
    priority: 40,
    availability: () => (pythonAvailable === false ? "unavailable" : "ready"),
    canHandle: (input) => input.kind === "pptx",
    parse: parsePptxLocal,
  });

  registry.register({
    id: "mineru-cloud",
    kinds: ["pdf", "docx", "pptx", "xlsx"],
    integrationLevel: "cloud",
    priority: 60,
    availability: mineruAvailability,
    canHandle: () => true,
    parse: parseMineruCloud,
  });

  void checkPython().then((ok) => {
    pythonAvailable = ok;
  });
}
