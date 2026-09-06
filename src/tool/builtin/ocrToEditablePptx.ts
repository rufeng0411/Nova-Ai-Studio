import { spawn } from '../../util/childProcess.js';
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { withHiddenConsole } from "../../util/withHiddenConsole.js";
import type { PermissionResult } from "../../permission/index.js";
import { PilotDeckToolRuntimeError } from "../protocol/errors.js";
import type {
  PilotDeckToolDefinition,
  PilotDeckToolRuntimeContext,
} from "../protocol/types.js";
import { resolvePilotDeckWorkspacePath } from "./filesystem/pathSafety.js";
import { enrichComposeImagePathsFromManifest } from "../../saas/document-export/enrichIrFromVisualManifest.js";

/** PD-SAAS-FORK: ocr_to_editable_pptx builtin (MinerU / Qwen-VL). */
export type CreateOcrToEditablePptxToolOptions = {
  provider?: "mineru" | "qwen-vl";
  mode?: "cloud" | "local";
  apiUrl?: string;
  apiKey?: string;
  model?: string;
  fallbackProvider?: "mineru" | "qwen-vl";
  dashscopeApiKey?: string;
};

export type OcrToEditablePptxInput = {
  input_paths: string[];
  output_path?: string;
  provider?: "mineru" | "qwen-vl";
};

export type OcrToEditablePptxOutput = {
  provider: "mineru" | "qwen-vl";
  outputPath: string;
  relativePath: string;
  sourceCount: number;
};

const INPUT_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".pdf",
  ".ppt",
  ".pptx",
]);

export function createOcrToEditablePptxTool(
  options: CreateOcrToEditablePptxToolOptions = {},
): PilotDeckToolDefinition<OcrToEditablePptxInput, OcrToEditablePptxOutput> {
  return {
    name: "ocr_to_editable_pptx",
    aliases: ["OcrToEditablePptx"],
    description:
      "Extract text and layout from images or PDFs and produce an editable PPTX (text boxes you can change in PowerPoint). Uses configured MinerU cloud/local service; falls back to Qwen-VL when MinerU is unavailable. For placing images only without OCR, use compose_images_to_document.",
    kind: "network",
    inputSchema: {
      type: "object",
      required: ["input_paths"],
      additionalProperties: false,
      properties: {
        input_paths: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          description: "Workspace paths to images or PDF (first file is processed).",
        },
        output_path: { type: "string", description: "Optional workspace .pptx output path." },
        provider: {
          type: "string",
          enum: ["mineru", "qwen-vl"],
          description: "Override configured OCR provider.",
        },
      },
    },
    isReadOnly: () => false,
    isConcurrencySafe: () => false,
    isOpenWorld: () => true,
    checkPermissions: async (): Promise<PermissionResult> => ({
      type: "ask",
      reason: {
        type: "tool",
        toolName: "ocr_to_editable_pptx",
        message: "OCR to editable PPTX requires network access and file writes.",
      },
      request: {
        toolCallId: "",
        toolName: "ocr_to_editable_pptx",
        inputSummary: "ocr to editable pptx",
        reason: {
          type: "tool",
          toolName: "ocr_to_editable_pptx",
          message: "OCR to editable PPTX requires network access and file writes.",
        },
        options: [
          { id: "allow_once", label: "Allow OCR export" },
          { id: "deny", label: "Deny" },
        ],
      },
    }),
    execute: async (input, context) => {
      const env = context.env ?? process.env;
      const provider =
        input.provider ??
        options.provider ??
        (env.PILOTDECK_DOCUMENT_OCR_PROVIDER as "mineru" | "qwen-vl" | undefined) ??
        "mineru";
      const mode =
        options.mode ??
        (env.PILOTDECK_DOCUMENT_OCR_MODE as "cloud" | "local" | undefined) ??
        "cloud";
      const apiUrl =
        options.apiUrl?.trim() ||
        String(env.PILOTDECK_DOCUMENT_OCR_API_URL ?? "https://mineru.net/api/v4").trim();
      const mineruKey =
        options.apiKey?.trim() ||
        String(env.MINERU_API_TOKEN ?? env.PILOTDECK_DOCUMENT_OCR_API_KEY ?? "").trim();
      const dashscopeKey =
        options.dashscopeApiKey?.trim() ||
        String(env.DASHSCOPE_API_KEY ?? "").trim();
      const model =
        options.model?.trim() ||
        String(env.PILOTDECK_DOCUMENT_OCR_MODEL ?? "qwen-vl-max").trim();
      const fallback =
        options.fallbackProvider ??
        (env.PILOTDECK_DOCUMENT_OCR_FALLBACK as "mineru" | "qwen-vl" | undefined) ??
        "qwen-vl";

      if (provider === "mineru" && !mineruKey && fallback !== "qwen-vl") {
        throw new PilotDeckToolRuntimeError(
          "unsupported_tool",
          "ocr_to_editable_pptx is not configured. Set tools.documentOcr.apiKey or MINERU_API_TOKEN.",
        );
      }
      if (provider === "qwen-vl" && !dashscopeKey) {
        throw new PilotDeckToolRuntimeError(
          "unsupported_tool",
          "ocr_to_editable_pptx is not configured. Configure Qwen/DashScope API key in model pool or tools.documentOcr.",
        );
      }
      if (provider === "mineru" && !mineruKey && !dashscopeKey) {
        throw new PilotDeckToolRuntimeError(
          "unsupported_tool",
          "ocr_to_editable_pptx is not configured. Set MinerU token or DashScope key for fallback.",
        );
      }

      const inputPaths = (
        await enrichComposeImagePathsFromManifest({
          workspaceRoot: context.cwd,
          taskArtifactDir: context.taskArtifactDir,
          sessionId: context.sessionId,
          goalVersion: context.taskGoalVersion,
          imagePaths: input.input_paths.map((p) => p.trim()).filter(Boolean),
        })
      );
      if (inputPaths.length === 0) {
        throw new PilotDeckToolRuntimeError(
          "invalid_tool_input",
          "ocr_to_editable_pptx requires at least one input path.",
        );
      }
      const resolvedInputs: string[] = [];
      for (const rel of inputPaths) {
        const resolved = resolvePilotDeckWorkspacePath(rel, context, { mustExist: true });
        if (!resolved.ok) {
          throw new PilotDeckToolRuntimeError(resolved.error.code, resolved.error.message, resolved.error.details);
        }
        const ext = path.extname(resolved.absolutePath).toLowerCase();
        if (!INPUT_EXT.has(ext)) {
          throw new PilotDeckToolRuntimeError(
            "invalid_tool_input",
            `ocr_to_editable_pptx unsupported file type: ${rel}`,
          );
        }
        resolvedInputs.push(resolved.absolutePath);
      }

      const outputRel = input.output_path?.trim() || `artifacts/documents/ocr-${Date.now()}.pptx`;
      const output = resolvePilotDeckWorkspacePath(outputRel, context, { forWrite: true });
      if (!output.ok) {
        throw new PilotDeckToolRuntimeError(output.error.code, output.error.message, output.error.details);
      }
      await mkdir(path.dirname(output.absolutePath), { recursive: true });

      const scriptPath = path.resolve(process.cwd(), "scripts", "ocr-to-editable-pptx.py");
      const childEnv: Record<string, string | undefined> = {
        ...env,
        PILOTDECK_DOCUMENT_OCR_PROVIDER: provider,
        PILOTDECK_DOCUMENT_OCR_MODE: mode,
        PILOTDECK_DOCUMENT_OCR_API_URL: apiUrl.replace(/\/+$/, ""),
        PILOTDECK_DOCUMENT_OCR_MODEL: model,
        PILOTDECK_DOCUMENT_OCR_FALLBACK: fallback,
      };
      if (mineruKey) {
        childEnv.MINERU_API_TOKEN = mineruKey;
        childEnv.PILOTDECK_DOCUMENT_OCR_API_KEY = mineruKey;
      }
      if (dashscopeKey) childEnv.DASHSCOPE_API_KEY = dashscopeKey;

      await runPythonScript(
        scriptPath,
        ["--inputs", ...resolvedInputs, "--output", output.absolutePath],
        { ...context, env: childEnv as NodeJS.ProcessEnv },
      );

      const relative = output.relativePath.split(path.sep).join("/");
      const effectiveProvider =
        provider === "mineru" && !mineruKey && dashscopeKey ? "qwen-vl" : provider;
      const data: OcrToEditablePptxOutput = {
        provider: effectiveProvider,
        outputPath: output.absolutePath,
        relativePath: relative,
        sourceCount: resolvedInputs.length,
      };
      return {
        content: [
          { type: "text", text: `Editable PPTX saved to ${relative}.` },
          {
            type: "file",
            path: output.absolutePath,
            mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            description: "Editable PPTX from OCR",
          },
        ],
        data,
      };
    },
  };
}

async function runPythonScript(
  scriptPath: string,
  args: string[],
  context: PilotDeckToolRuntimeContext,
): Promise<void> {
  const candidates = ["python", "python3", "py"];
  let lastError: Error | undefined;
  for (const bin of candidates) {
    try {
      await spawnOnce(bin, bin === "py" ? ["-3", scriptPath, ...args] : [scriptPath, ...args], context);
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw new PilotDeckToolRuntimeError(
    "tool_execution_failed",
    lastError?.message ||
      "ocr_to_editable_pptx requires Python 3 with requests, python-pptx, and Pillow installed.",
  );
}

function spawnOnce(
  command: string,
  args: string[],
  context: PilotDeckToolRuntimeContext,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, withHiddenConsole({
      cwd: process.cwd(),
      env: context.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    }));
    let stderr = "";
    let stdout = "";
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const message = (stderr || stdout).trim();
      reject(new Error(sanitizeSecrets(message) || `${command} exited with code ${code}`));
    });
  });
}

function sanitizeSecrets(text: string): string {
  return text.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED_TOKEN]");
}
