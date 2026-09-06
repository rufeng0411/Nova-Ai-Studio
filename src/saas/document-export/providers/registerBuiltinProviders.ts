// PD-SAAS-FORK: register built-in document export providers
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderHtmlFileToPdf } from "../playwrightPool.js";
import { getDocumentExportRegistry } from "../providerRegistry.js";
import type {
  DocumentExportContext,
  DocumentExportProvider,
  DocumentIr,
  ExportInput,
  ExportResult,
} from "../types.js";
import { runNodeExportScript, runPythonExportScript } from "../runScript.js";
import { detectSourceKind, irToStandaloneHtml, isScanSource } from "../buildIr.js";
import { createSkillExportProviders } from "./skillAdapterProvider.js";
import { createNutrientProvider } from "./nutrientProvider.js";

function relPath(workspaceRoot: string, absolute: string): string {
  return path.relative(workspaceRoot, absolute).split(path.sep).join("/");
}

function baseResult(
  input: ExportInput,
  providerId: string,
): ExportResult {
  return {
    outputAbsolutePath: input.outputAbsolutePath,
    relativePath: relPath(input.workspaceRoot, input.outputAbsolutePath),
    providerId,
    format: input.outputFormat,
  };
}

async function writeIrTemp(ir: DocumentIr, workspaceRoot: string): Promise<string> {
  const dir = path.join(workspaceRoot, "artifacts", ".export-cache");
  await mkdir(dir, { recursive: true });
  const irPath = path.join(dir, `ir-${Date.now()}.json`);
  await writeFile(irPath, JSON.stringify(ir), "utf8");
  return irPath;
}

const playwrightPdfProvider: DocumentExportProvider = {
  id: "playwright-pdf",
  formats: ["pdf"],
  integrationLevel: "L2",
  priority: 50,
  availability: () => "ready",
  canHandle: (input) => input.outputFormat === "pdf" && !isScanSource(input.sourceAbsolutePath),
  render: async (ctx, input, ir) => {
    let htmlPath = input.sourceAbsolutePath;
    const kind = detectSourceKind(input.sourceAbsolutePath);
    if (kind === "markdown" || kind === "unknown" || kind === "spreadsheet") {
      const dir = path.join(input.workspaceRoot, "artifacts", ".export-cache");
      await mkdir(dir, { recursive: true });
      htmlPath = path.join(dir, `export-${Date.now()}.html`);
      await writeFile(htmlPath, irToStandaloneHtml(ir, input.sourceAbsolutePath), "utf8");
    }
    const landscape = input.options.page_size === "16:9";
    try {
      await renderHtmlFileToPdf({
        htmlAbsolutePath: htmlPath,
        pdfAbsolutePath: input.outputAbsolutePath,
        landscape,
      });
    } catch {
      const scriptPath = path.resolve(process.cwd(), "scripts", "export-document", "html-to-pdf.mjs");
      await runNodeExportScript(
        scriptPath,
        ["--input", htmlPath, "--output", input.outputAbsolutePath, "--landscape", landscape ? "1" : "0"],
        ctx.env,
      );
    }
    return baseResult(input, "playwright-pdf");
  },
};

const docxJsProvider: DocumentExportProvider = {
  id: "docx-js",
  formats: ["docx"],
  integrationLevel: "L2",
  priority: 50,
  availability: () => "ready",
  canHandle: (input) => input.outputFormat === "docx" && !isScanSource(input.sourceAbsolutePath),
  render: async (ctx, input, ir) => {
    const irPath = await writeIrTemp(ir, input.workspaceRoot);
    const scriptPath = path.resolve(process.cwd(), "scripts", "export-document", "ir-to-docx.mjs");
    await runNodeExportScript(
      scriptPath,
      ["--ir", irPath, "--output", input.outputAbsolutePath],
      ctx.env,
    );
    return baseResult(input, "docx-js");
  },
};

const playwrightHtmlPptxProvider: DocumentExportProvider = {
  id: "playwright-html-pptx",
  formats: ["pptx"],
  integrationLevel: "L2",
  priority: 55,
  availability: () => "ready",
  canHandle: (input) =>
    input.outputFormat === "pptx"
    && detectSourceKind(input.sourceAbsolutePath) === "html"
    && !isScanSource(input.sourceAbsolutePath)
    && input.options.include_editable_text !== true,
  render: async (ctx, input) => {
    const aspectRatio = input.options.page_size === "4:3" ? "4:3" : "16:9";
    const scriptPath = path.resolve(process.cwd(), "scripts", "export-document", "html-to-pptx.mjs");
    await runNodeExportScript(
      scriptPath,
      [
        "--input", input.sourceAbsolutePath,
        "--output", input.outputAbsolutePath,
        "--aspect-ratio", aspectRatio,
      ],
      ctx.env,
    );
    return baseResult(input, "playwright-html-pptx");
  },
};

const pythonPptxIrProvider: DocumentExportProvider = {
  id: "python-pptx-ir",
  formats: ["pptx"],
  integrationLevel: "L2",
  priority: 40,
  availability: () => "ready",
  canHandle: (input, ir) => {
    const kind = detectSourceKind(input.sourceAbsolutePath);
    if (input.outputFormat !== "pptx" || isScanSource(input.sourceAbsolutePath)) return false;
    if (kind === "html") return input.options.include_editable_text === true;
    return input.options.include_editable_text !== false;
  },
  render: async (ctx, input, ir) => {
    const irPath = await writeIrTemp(ir, input.workspaceRoot);
    const pyScript = path.resolve(process.cwd(), "scripts", "export-document", "ir-to-pptx.py");
    const nodeScript = path.resolve(process.cwd(), "scripts", "export-document", "ir-to-pptx.mjs");
    const scriptArgs = ["--ir", irPath, "--output", input.outputAbsolutePath];
    try {
      await runPythonExportScript(pyScript, scriptArgs, ctx.env);
      return baseResult(input, "python-pptx-ir");
    } catch {
      await runNodeExportScript(nodeScript, scriptArgs, ctx.env);
      return baseResult(input, "pptxgenjs-ir");
    }
  },
};

const exceljsProvider: DocumentExportProvider = {
  id: "exceljs",
  formats: ["xlsx"],
  integrationLevel: "L2",
  priority: 50,
  availability: () => "ready",
  canHandle: (input) => input.outputFormat === "xlsx" && !isScanSource(input.sourceAbsolutePath),
  render: async (ctx, input, ir) => {
    const irPath = await writeIrTemp(ir, input.workspaceRoot);
    const scriptPath = path.resolve(process.cwd(), "scripts", "export-document", "ir-to-xlsx.mjs");
    await runNodeExportScript(
      scriptPath,
      ["--ir", irPath, "--output", input.outputAbsolutePath],
      ctx.env,
    );
    return baseResult(input, "exceljs");
  },
};

const mineruOcrPptxProvider: DocumentExportProvider = {
  id: "mineru-ocr-pptx",
  formats: ["pptx"],
  integrationLevel: "cloud",
  priority: 60,
  availability: (ctx) => (ctx.documentOcr?.apiKey || ctx.documentOcr?.dashscopeApiKey ? "ready" : "needs_config"),
  canHandle: (input) => input.outputFormat === "pptx" && isScanSource(input.sourceAbsolutePath),
  render: async (ctx, input) => {
    const scriptPath = path.resolve(process.cwd(), "scripts", "ocr-to-editable-pptx.py");
    const args = ["--inputs", input.sourceAbsolutePath, "--output", input.outputAbsolutePath];
    const ocr = ctx.documentOcr;
    if (ocr?.apiUrl) args.push("--api-url", ocr.apiUrl);
    if (ocr?.apiKey) args.push("--api-key", ocr.apiKey);
    if (ocr?.provider) args.push("--provider", ocr.provider);
    if (ocr?.dashscopeApiKey) args.push("--dashscope-key", ocr.dashscopeApiKey);
    if (ocr?.model) args.push("--model", ocr.model);
    await runPythonExportScript(scriptPath, args, ctx.env);
    return baseResult(input, "mineru-ocr-pptx");
  },
};

let registered = false;

export function registerBuiltinDocumentExportProviders(): void {
  if (registered) return;
  registered = true;
  const registry = getDocumentExportRegistry();
  registry.register(playwrightPdfProvider);
  registry.register(playwrightHtmlPptxProvider);
  registry.register(docxJsProvider);
  registry.register(pythonPptxIrProvider);
  registry.register(exceljsProvider);
  registry.register(mineruOcrPptxProvider);
  registry.register(createNutrientProvider());
  for (const skillProvider of createSkillExportProviders()) {
    registry.register(skillProvider);
  }
}
