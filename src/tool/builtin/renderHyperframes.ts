// PD-SAAS-FORK: Gateway render_hyperframes — HyperFrames composition → MP4
import { spawn } from "../../util/childProcess.js";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { withHiddenConsole } from "../../util/withHiddenConsole.js";
import type { PermissionResult } from "../../permission/index.js";
import { PilotDeckToolRuntimeError } from "../protocol/errors.js";
import type {
  PilotDeckToolDefinition,
  PilotDeckToolRuntimeContext,
} from "../protocol/types.js";
import {
  isPathWithinRoot,
  resolvePilotDeckWorkspacePath,
} from "./filesystem/pathSafety.js";
import { tryAcquireHyperframesRenderSlot } from "../../saas/media/hyperframesRenderGate.js";
import { acquirePromoRenderLock } from "../../saas/media/hfPromoLock.js";

export type RenderHyperframesInput = {
  project_dir: string;
  output_path?: string;
  quality?: "draft" | "high";
  width?: number;
  height?: number;
};

export type RenderHyperframesOutput = {
  outputPath: string;
  relativePath: string;
  quality: "draft" | "high";
  bytes: number;
};

function normalizePosix(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+$/, "");
}

function resolveWithinTaskScope(
  inputPath: string,
  context: PilotDeckToolRuntimeContext,
  options: { forWrite?: boolean; mustExist?: boolean },
): { ok: true; absolutePath: string; relativePath: string } | { ok: false; error: PilotDeckToolRuntimeError } {
  const resolved = resolvePilotDeckWorkspacePath(inputPath, context, options);
  if (!resolved.ok) {
    return {
      ok: false,
      error: new PilotDeckToolRuntimeError(resolved.error.code, resolved.error.message, resolved.error.details),
    };
  }

  const taskRootRelative = normalizePosix(String(context.taskArtifactDir ?? "").trim());
  if (taskRootRelative) {
    const taskAbs = path.resolve(path.join(context.cwd, taskRootRelative));
    if (!isPathWithinRoot(resolved.absolutePath, taskAbs)) {
      return {
        ok: false,
        error: new PilotDeckToolRuntimeError(
          "path_not_allowed",
          `HyperFrames project/output must stay inside ${taskRootRelative}.`,
          { inputPath, taskRootRelative },
        ),
      };
    }
    return { ok: true, absolutePath: resolved.absolutePath, relativePath: resolved.relativePath };
  }

  const rel = normalizePosix(resolved.relativePath);
  if (!rel.startsWith("artifacts/") && rel !== "artifacts") {
    return {
      ok: false,
      error: new PilotDeckToolRuntimeError(
        "path_not_allowed",
        "HyperFrames paths must be under artifacts/ when no task directory is assigned.",
        { inputPath: rel },
      ),
    };
  }
  return { ok: true, absolutePath: resolved.absolutePath, relativePath: resolved.relativePath };
}

export function createRenderHyperframesTool(): PilotDeckToolDefinition<
  RenderHyperframesInput,
  RenderHyperframesOutput
> {
  return {
    name: "render_hyperframes",
    aliases: ["RenderHyperframes"],
    description:
      "Render a HyperFrames HTML composition project into MP4 via doctor→lint→validate→render. "
      + "project_dir must live inside the session task directory (recommended hf-project/).",
    kind: "shell",
    inputSchema: {
      type: "object",
      required: ["project_dir"],
      additionalProperties: false,
      properties: {
        project_dir: { type: "string", description: "HyperFrames project directory containing index.html." },
        output_path: { type: "string", description: "Output MP4 path (default promo.mp4 beside project)." },
        quality: { type: "string", enum: ["draft", "high"], description: "Render quality (default draft)." },
        width: { type: "integer", minimum: 320, maximum: 3840 },
        height: { type: "integer", minimum: 180, maximum: 2160 },
      },
    },
    isReadOnly: () => false,
    isConcurrencySafe: () => false,
    checkPermissions: async (): Promise<PermissionResult> => ({
      type: "ask",
      reason: {
        type: "tool",
        toolName: "render_hyperframes",
        message: "Rendering HyperFrames video requires local CLI, ffmpeg, and writing MP4 output.",
      },
      request: {
        toolCallId: "",
        toolName: "render_hyperframes",
        inputSummary: "render hyperframes to mp4",
        reason: {
          type: "tool",
          toolName: "render_hyperframes",
          message: "Rendering HyperFrames video requires local CLI, ffmpeg, and writing MP4 output.",
        },
        options: [
          { id: "allow_once", label: "Allow render" },
          { id: "deny", label: "Deny" },
        ],
      },
    }),
    execute: async (input, context) => {
      const lease = tryAcquireHyperframesRenderSlot();
      if (!lease) {
        throw new PilotDeckToolRuntimeError(
          "tool_execution_failed",
          "HyperFrames render queue is busy; please wait a moment.",
        );
      }

      let fileLock: Awaited<ReturnType<typeof acquirePromoRenderLock>> | undefined;

      try {
        const project = resolveWithinTaskScope(input.project_dir, context, { mustExist: true });
        if (!project.ok) throw project.error;

        const defaultOutput = path.join(path.dirname(project.relativePath), "promo.mp4");
        const outputPathInput = input.output_path?.trim() || defaultOutput;
        const output = resolveWithinTaskScope(outputPathInput, context, { forWrite: true });
        if (!output.ok) throw output.error;

        await mkdir(path.dirname(output.absolutePath), { recursive: true });

        const taskDirAbs = path.dirname(output.absolutePath);
        fileLock = await acquirePromoRenderLock(taskDirAbs, "gateway");
        if (!fileLock.ok) {
          throw new PilotDeckToolRuntimeError(
            "tool_execution_failed",
            "HyperFrames render already in progress for this task.",
            { code: fileLock.error },
          );
        }

        const quality = input.quality === "high" ? "high" : "draft";
        const scriptPath = path.resolve(process.cwd(), "scripts", "render-hyperframes.mjs");
        const args = [
          "--project-dir",
          project.absolutePath,
          "--output",
          output.absolutePath,
          "--quality",
          quality,
        ];
        if (typeof input.width === "number" && Number.isFinite(input.width)) {
          args.push("--width", String(Math.floor(input.width)));
        }
        if (typeof input.height === "number" && Number.isFinite(input.height)) {
          args.push("--height", String(Math.floor(input.height)));
        }

        const payload = await runNodeScriptJson(scriptPath, args, context);
        if (!payload?.ok) {
          const message = String(payload?.message ?? "HyperFrames render failed.");
          throw new PilotDeckToolRuntimeError("tool_execution_failed", message, {
            code: String(payload?.code ?? "render_failed"),
          });
        }

        const relative = output.relativePath.split(path.sep).join("/");
        const data: RenderHyperframesOutput = {
          outputPath: output.absolutePath,
          relativePath: relative,
          quality,
          bytes: Number(payload.bytes ?? 0),
        };
        return {
          content: [
            { type: "text", text: `Rendered HyperFrames MP4 saved to ${relative}.` },
            { type: "file", path: output.absolutePath, mimeType: "video/mp4", description: "HyperFrames rendered MP4" },
          ],
          data,
        };
      } finally {
        if (fileLock?.ok) {
          await fileLock.release();
        }
        lease.release();
      }
    },
  };
}

async function runNodeScriptJson(
  scriptPath: string,
  args: string[],
  context: PilotDeckToolRuntimeContext,
): Promise<{ ok?: boolean; code?: string; message?: string; bytes?: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], withHiddenConsole({
      cwd: process.cwd(),
      env: context.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    }));
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });
    child.once("error", (error) => {
      reject(
        new PilotDeckToolRuntimeError(
          "tool_execution_failed",
          `render_hyperframes failed to start: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    });
    child.once("close", (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(stdout.trim() || "{}"));
          return;
        } catch {
          resolve({ ok: true });
          return;
        }
      }
      try {
        resolve(JSON.parse(stderr.trim() || stdout.trim() || "{}"));
        return;
      } catch {
        reject(
          new PilotDeckToolRuntimeError(
            "tool_execution_failed",
            stderr.trim() || stdout.trim() || "render_hyperframes exited with non-zero status.",
          ),
        );
      }
    });
  });
}
