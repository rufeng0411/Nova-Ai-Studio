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

/** PD-SAAS-FORK: compose_images_to_document builtin (PDF/PPTX from images). */
export type CreateComposeImagesToDocumentToolOptions = {
  aspectRatio?: string;
};

export type ComposeImagesToDocumentInput = {
  image_paths: string[];
  format: "pdf" | "pptx";
  aspect_ratio?: string;
  output_path?: string;
};

export type ComposeImagesToDocumentOutput = {
  format: "pdf" | "pptx";
  outputPath: string;
  relativePath: string;
  pageCount: number;
};

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]);

export function createComposeImagesToDocumentTool(
  options: CreateComposeImagesToDocumentToolOptions = {},
): PilotDeckToolDefinition<ComposeImagesToDocumentInput, ComposeImagesToDocumentOutput> {
  return {
    name: "compose_images_to_document",
    aliases: ["ComposeImagesToDocument"],
    description:
      "Compose multiple workspace images into a single PDF or PPTX (one image per page/slide). Output slides use full-bleed images; text is not editable. For OCR-to-editable PPT use ocr_to_editable_pptx instead.",
    kind: "shell",
    inputSchema: {
      type: "object",
      required: ["image_paths", "format"],
      additionalProperties: false,
      properties: {
        image_paths: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          description: "Ordered workspace-relative image paths.",
        },
        format: { type: "string", enum: ["pdf", "pptx"], description: "Output format." },
        aspect_ratio: { type: "string", description: "Slide aspect ratio for PPTX, e.g. 16:9." },
        output_path: { type: "string", description: "Optional workspace output path." },
      },
    },
    isReadOnly: () => false,
    isConcurrencySafe: () => true,
    checkPermissions: async (): Promise<PermissionResult> => ({
      type: "ask",
      reason: {
        type: "tool",
        toolName: "compose_images_to_document",
        message: "Composing images into a document requires running local commands and writing files.",
      },
      request: {
        toolCallId: "",
        toolName: "compose_images_to_document",
        inputSummary: "compose images to pdf/pptx",
        reason: {
          type: "tool",
          toolName: "compose_images_to_document",
          message: "Composing images into a document requires running local commands and writing files.",
        },
        options: [
          { id: "allow_once", label: "Allow compose" },
          { id: "deny", label: "Deny" },
        ],
      },
    }),
    execute: async (input, context) => {
      const format = input.format;
      const aspectRatio =
        input.aspect_ratio?.trim() ||
        String(context.env?.PILOTDECK_DOCUMENT_COMPOSE_ASPECT_RATIO ?? options.aspectRatio ?? "16:9").trim() ||
        "16:9";
      const imagePaths = input.image_paths.map((p) => p.trim()).filter(Boolean);
      if (imagePaths.length === 0) {
        throw new PilotDeckToolRuntimeError(
          "invalid_tool_input",
          "compose_images_to_document requires at least one image path.",
        );
      }

      const mergedImagePaths = await enrichComposeImagePathsFromManifest({
        workspaceRoot: context.cwd,
        taskArtifactDir: context.taskArtifactDir,
        sessionId: context.sessionId,
        goalVersion: context.taskGoalVersion,
        imagePaths,
      });

      const resolvedImages: string[] = [];
      for (const rel of mergedImagePaths) {
        const resolved = resolvePilotDeckWorkspacePath(rel, context, { mustExist: true });
        if (!resolved.ok) {
          throw new PilotDeckToolRuntimeError(resolved.error.code, resolved.error.message, resolved.error.details);
        }
        const ext = path.extname(resolved.absolutePath).toLowerCase();
        if (!IMAGE_EXT.has(ext)) {
          throw new PilotDeckToolRuntimeError(
            "invalid_tool_input",
            `compose_images_to_document only supports image files: ${rel}`,
          );
        }
        resolvedImages.push(resolved.absolutePath);
      }

      const defaultExt = format === "pdf" ? "pdf" : "pptx";
      const outputRel =
        input.output_path?.trim() ||
        `artifacts/documents/compose-${Date.now()}.${defaultExt}`;
      const output = resolvePilotDeckWorkspacePath(outputRel, context, { forWrite: true });
      if (!output.ok) {
        throw new PilotDeckToolRuntimeError(output.error.code, output.error.message, output.error.details);
      }
      await mkdir(path.dirname(output.absolutePath), { recursive: true });

      if (format === "pdf") {
        const scriptPath = path.resolve(process.cwd(), "scripts", "compose-images-document.mjs");
        await runNodeScript(
          scriptPath,
          ["--output", output.absolutePath, "--images", ...resolvedImages],
          context,
        );
      } else {
        const scriptPath = path.resolve(process.cwd(), "scripts", "compose-images-pptx.py");
        await runPythonScript(
          scriptPath,
          [
            "--output",
            output.absolutePath,
            "--aspect-ratio",
            aspectRatio,
            "--images",
            ...resolvedImages,
          ],
          context,
        );
      }

      const relative = output.relativePath.split(path.sep).join("/");
      const data: ComposeImagesToDocumentOutput = {
        format,
        outputPath: output.absolutePath,
        relativePath: relative,
        pageCount: resolvedImages.length,
      };
      const mimeType =
        format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      return {
        content: [
          { type: "text", text: `Composed ${resolvedImages.length} image(s) into ${relative}.` },
          { type: "file", path: output.absolutePath, mimeType, description: `Composed ${format.toUpperCase()}` },
        ],
        data,
      };
    },
  };
}

async function runNodeScript(
  scriptPath: string,
  args: string[],
  context: PilotDeckToolRuntimeContext,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], withHiddenConsole({
      cwd: process.cwd(),
      env: context.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    }));
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      reject(
        new PilotDeckToolRuntimeError(
          "tool_execution_failed",
          `compose_images_to_document failed to start: ${error.message}`,
        ),
      );
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new PilotDeckToolRuntimeError(
          "tool_execution_failed",
          stderr.trim() || "compose_images_to_document script exited with non-zero status.",
        ),
      );
    });
  });
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
      "compose_images_to_document requires Python 3 with python-pptx and Pillow installed.",
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
      reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
    });
  });
}
