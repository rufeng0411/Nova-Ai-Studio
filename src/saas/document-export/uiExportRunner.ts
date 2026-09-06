// PD-SAAS-FORK: UI server export job runner (wraps export_document / compose / OCR)
import { spawn } from '../../util/childProcess.js';
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { withHiddenConsole } from "../../util/withHiddenConsole.js";
import { routeExportDocument } from "./router.js";
import { closePlaywrightPool, configurePlaywrightPool } from "./playwrightPool.js";
import { runPythonExportScript } from "./runScript.js";
import type { ExportOcrRuntimeConfig, OutputFormat, ResolvedDocumentExportConfig } from "./types.js";
import type { ModelConfig } from "../../model/protocol/canonical.js";
import {
  resolveDocumentComposeFromTools,
  resolveDocumentExportConfig,
  resolveDocumentOcrFromTools,
  resolveEditablePptxConfig,
} from "../../pilot/config/resolveDocumentToolConfig.js";
import type {
  PilotDocumentComposeConfig,
  PilotDocumentExportConfig,
  PilotDocumentOcrConfig,
  PilotDocumentToolsConfig,
} from "../../pilot/config/types.js";
import { resolveMonorepoRoot } from "./monorepoRoot.js";

type PilotToolsConfigLike = {
  document?: PilotDocumentToolsConfig;
  documentCompose?: PilotDocumentComposeConfig;
  documentOcr?: PilotDocumentOcrConfig;
  documentExport?: PilotDocumentExportConfig;
};

function toolsFromYaml(yamlConfig: unknown): PilotToolsConfigLike | undefined {
  if (!yamlConfig || typeof yamlConfig !== "object") return undefined;
  const root = yamlConfig as { tools?: PilotToolsConfigLike };
  return root.tools;
}

/** Accept ModelConfig or full PilotDeck disk config (`{ model: { providers } }`). */
function normalizeModelConfig(input: ModelConfig | { model?: ModelConfig } | undefined): ModelConfig | undefined {
  if (!input || typeof input !== "object") return undefined;
  if ("providers" in input && input.providers && typeof input.providers === "object") {
    return input as ModelConfig;
  }
  const nested = (input as { model?: ModelConfig }).model;
  if (nested?.providers && typeof nested.providers === "object") {
    return nested;
  }
  return undefined;
}

export type UiExportEngine = "export_document" | "compose_images" | "ocr_editable_pptx";

export type UiExportJobInput = {
  workspaceRoot: string;
  sourcePath: string;
  sourceAbsolutePath: string;
  outputAbsolutePath: string;
  format: OutputFormat;
  engine: UiExportEngine;
  imagePaths?: string[];
  aspectRatio?: string;
  env?: NodeJS.ProcessEnv;
  yamlConfig?: unknown;
  modelConfig?: ModelConfig | { model?: ModelConfig };
  onProgress?: (percent: number, stage?: string, page?: number, pageTotal?: number) => void | Promise<void>;
};

export type UiExportJobResult = {
  relativePath: string;
  outputAbsolutePath: string;
  providerId?: string;
  pageCount?: number;
};

function isHtmlSourcePath(filePath: string): boolean {
  return /\.html?$/i.test(filePath);
}

async function captureHtmlSlideImages(
  monorepoRoot: string,
  htmlAbsolutePath: string,
  screenshotsDir: string,
  aspectRatio: string,
  env: NodeJS.ProcessEnv,
): Promise<string[]> {
  const scriptPath = path.join(monorepoRoot, "scripts", "export-document", "html-to-pptx.mjs");
  await runNode(monorepoRoot, scriptPath, [
    "--input",
    htmlAbsolutePath,
    "--screenshots-dir",
    screenshotsDir,
    "--aspect-ratio",
    aspectRatio,
  ], env);
  const names = await readdir(screenshotsDir);
  return names
    .filter((name) => /^slide-\d+\.png$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => path.join(screenshotsDir, name));
}

export function buildExportContext(
  env: NodeJS.ProcessEnv,
  workspaceRoot: string,
  yamlConfig?: unknown,
  modelConfig?: ModelConfig | { model?: ModelConfig },
) {
  const tools = toolsFromYaml(yamlConfig);
  const documentExport = resolveDocumentExportConfig(tools, env);
  configurePlaywrightPool(documentExport.playwrightPoolSize);
  const documentOcr = resolveDocumentOcrFromTools(tools, normalizeModelConfig(modelConfig), env);
  return {
    cwd: workspaceRoot,
    env,
    documentExport,
    documentOcr: documentOcr as ExportOcrRuntimeConfig | undefined,
  };
}

export async function runUiExportJob(input: UiExportJobInput): Promise<UiExportJobResult> {
  const env = input.env ?? process.env;
  const monorepoRoot = resolveMonorepoRoot();
  const previousCwd = process.cwd();
  process.chdir(monorepoRoot);
  try {
    return await runUiExportJobInMonorepo(input, env, monorepoRoot);
  } finally {
    process.chdir(previousCwd);
  }
}

async function runUiExportJobInMonorepo(
  input: UiExportJobInput,
  env: NodeJS.ProcessEnv,
  monorepoRoot: string,
): Promise<UiExportJobResult> {
  await mkdir(path.dirname(input.outputAbsolutePath), { recursive: true });

  if (input.engine === "export_document") {
    const ctx = buildExportContext(env, input.workspaceRoot, input.yamlConfig, input.modelConfig);
    try {
      const result = await routeExportDocument({
        sourceAbsolutePath: input.sourceAbsolutePath,
        sourcePath: input.sourcePath,
        workspaceRoot: input.workspaceRoot,
        outputFormat: input.format,
        outputAbsolutePath: input.outputAbsolutePath,
        ctx,
      });
      return {
        relativePath: result.relativePath,
        outputAbsolutePath: result.outputAbsolutePath,
        providerId: result.providerId,
      };
    } finally {
      if (env.PILOTDECK_EXPORT_CLOSE_POOL === "1") {
        await closePlaywrightPool();
      }
    }
  }

  if (input.engine === "compose_images") {
    const images = input.imagePaths ?? [];
    if (images.length === 0) {
      throw new Error("compose_images export requires image_paths");
    }
    const absoluteImages = images.map((rel) =>
      path.isAbsolute(rel) ? rel : path.join(input.workspaceRoot, rel.replace(/\\/g, "/")),
    );
    const compose = resolveDocumentComposeFromTools(toolsFromYaml(input.yamlConfig), env);
    const aspectRatio = input.aspectRatio ?? compose.aspectRatio ?? "16:9";
    if (input.format === "pdf") {
      const scriptPath = path.join(monorepoRoot, "scripts", "compose-images-document.mjs");
      await runNode(monorepoRoot, scriptPath, ["--output", input.outputAbsolutePath, "--images", ...absoluteImages], env);
    } else if (input.format === "pptx") {
      const scriptArgs = [
        "--output",
        input.outputAbsolutePath,
        "--aspect-ratio",
        aspectRatio,
        "--images",
        ...absoluteImages,
      ];
      const nodeScript = path.join(monorepoRoot, "scripts", "compose-images-pptx.mjs");
      const pyScript = path.join(monorepoRoot, "scripts", "compose-images-pptx.py");
      try {
        await runNode(monorepoRoot, nodeScript, scriptArgs, env);
      } catch {
        await runPythonExportScript(pyScript, scriptArgs, env);
      }
    } else {
      throw new Error(`compose_images does not support format ${input.format}`);
    }
    const relativePath = path.relative(input.workspaceRoot, input.outputAbsolutePath).split(path.sep).join("/");
    return {
      relativePath,
      outputAbsolutePath: input.outputAbsolutePath,
      providerId: "compose_images",
      pageCount: absoluteImages.length,
    };
  }

  if (input.engine === "ocr_editable_pptx") {
    const editable = resolveEditablePptxConfig(
      toolsFromYaml(input.yamlConfig),
      normalizeModelConfig(input.modelConfig),
      env,
    );
    const ocr = editable ?? resolveDocumentOcrFromTools(
      toolsFromYaml(input.yamlConfig),
      normalizeModelConfig(input.modelConfig),
      env,
    );
    if (!ocr) {
      throw new Error("ocr_to_editable_pptx is not configured");
    }
    if (editable && !editable.hybridReady && ocr.provider === "mineru") {
      throw new Error("ocr_to_editable_pptx requires Baidu AI credentials for hybrid text positioning");
    }
    const provider = ocr.provider ?? "mineru";
    const compose = resolveDocumentComposeFromTools(toolsFromYaml(input.yamlConfig), env);
    const aspectRatio = input.aspectRatio ?? compose.aspectRatio ?? "16:9";
    let inputPaths = (input.imagePaths?.length ? input.imagePaths : [input.sourcePath]).map((rel) =>
      path.isAbsolute(rel) ? rel : path.join(input.workspaceRoot, rel.replace(/\\/g, "/")),
    );

    // PD-SAAS-FORK: HTML reports → Playwright section screenshots → MinerU editable PPTX.
    if (isHtmlSourcePath(input.sourceAbsolutePath)) {
      await input.onProgress?.(12, "html_screenshots");
      const screenshotDir = path.join(
        input.workspaceRoot,
        "artifacts",
        ".export-cache",
        `html-slides-${Date.now()}`,
      );
      await mkdir(screenshotDir, { recursive: true });
      const slideImages = await captureHtmlSlideImages(
        monorepoRoot,
        input.sourceAbsolutePath,
        screenshotDir,
        aspectRatio,
        env,
      );
      if (slideImages.length === 0) {
        throw new Error("HTML export produced no slide screenshots for editable PPTX");
      }
      inputPaths = slideImages;
      await input.onProgress?.(25, "html_screenshots_done", 0, slideImages.length);
    }

    const rasterImageRe = /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i;
    const allRasterImages =
      inputPaths.length > 0 && inputPaths.every((absPath) => rasterImageRe.test(absPath));
    const slideBackgrounds = allRasterImages ? [...inputPaths] : [];
    const useLegacy = env.PILOTDECK_EDITABLE_PPTX_ENGINE === "legacy";
    // PD-SAAS-FORK: Kit pipeline processes each slide image; legacy bundles multi-page PDF for MinerU.
    if (useLegacy && inputPaths.length > 1 && !(provider === "qwen-vl" && allRasterImages)) {
      const tempPdf = path.join(
        input.workspaceRoot,
        "artifacts",
        ".export-cache",
        `ocr-bundle-${Date.now()}.pdf`,
      );
      await mkdir(path.dirname(tempPdf), { recursive: true });
      const scriptPath = path.join(monorepoRoot, "scripts", "compose-images-document.mjs");
      await runNode(monorepoRoot, scriptPath, ["--output", tempPdf, "--images", ...inputPaths], env);
      inputPaths = [tempPdf];
    }
    const scriptPath = path.join(
      monorepoRoot,
      "scripts",
      useLegacy ? "ocr-to-editable-pptx.py" : "export-editable-pptx-pd.py",
    );
    const args = [
      "--output",
      input.outputAbsolutePath,
    ];
    if (useLegacy) {
      args.push(
        "--provider",
        provider,
        "--mode",
        ocr.mode ?? "cloud",
        "--api-url",
        ocr.apiUrl,
        "--model",
        ocr.model,
        "--inputs",
        ...inputPaths,
      );
      if (ocr.apiKey) args.push("--api-key", ocr.apiKey);
      if (ocr.dashscopeApiKey) args.push("--dashscope-key", ocr.dashscopeApiKey);
      if (ocr.fallbackProvider) args.push("--fallback", ocr.fallbackProvider);
    } else {
    const absoluteImages = slideBackgrounds.length > 0 ? slideBackgrounds : inputPaths.filter((p) => rasterImageRe.test(p));
    if (absoluteImages.length === 0) {
      throw new Error(
        "No valid slide images for editable PPTX export. Open a slide PNG or export from the slide deck folder.",
      );
    }
    args.push("--images", ...absoluteImages);
      if (ocr.extractorMethod) args.push("--extractor", ocr.extractorMethod);
      if (ocr.inpaintMethod) args.push("--inpaint", ocr.inpaintMethod);
    }
    if (slideBackgrounds.length > 0 && useLegacy) {
      args.push("--backgrounds", ...slideBackgrounds);
    }
    if (useLegacy) {
      args.push("--aspect-ratio", aspectRatio);
    }
    await runPythonExportScript(scriptPath, args, env, input.onProgress);
    const relativePath = path.relative(input.workspaceRoot, input.outputAbsolutePath).split(path.sep).join("/");
    return {
      relativePath,
      outputAbsolutePath: input.outputAbsolutePath,
      providerId: provider,
      pageCount: useLegacy ? inputPaths.length : (slideBackgrounds.length || inputPaths.length),
    };
  }

  const _exhaustive: never = input.engine;
  throw new Error(`Unknown export engine: ${String(_exhaustive)}`);
}

function runNode(monorepoRoot: string, scriptPath: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], withHiddenConsole({
      cwd: monorepoRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    }));
    let stderr = "";
    child.stderr?.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `Node script failed (${code})`));
    });
  });
}

export function isOcrExportReady(
  env: NodeJS.ProcessEnv,
  yamlConfig?: unknown,
  modelConfig?: ModelConfig | { model?: ModelConfig },
): boolean {
  const editable = resolveEditablePptxConfig(
    toolsFromYaml(yamlConfig),
    normalizeModelConfig(modelConfig),
    env,
  );
  if (!editable) return false;
  if (editable.provider === "qwen-vl") {
    return Boolean(editable.dashscopeApiKey?.trim());
  }
  if (editable.mode === "local") {
    return Boolean(editable.apiUrl?.trim());
  }
  const mineruOk = Boolean(editable.apiKey?.trim());
  if (!mineruOk) return false;
  return editable.hybridReady;
}

export type { ResolvedDocumentExportConfig };
