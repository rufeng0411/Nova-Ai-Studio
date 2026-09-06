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

export type RenderHtmlVideoInput = {
  html_path: string;
  output_path?: string;
  duration_seconds?: number;
  fps?: number;
  width?: number;
  height?: number;
};

export type RenderHtmlVideoOutput = {
  outputPath: string;
  relativePath: string;
  durationSeconds: number;
  fps: number;
};

export function createRenderHtmlVideoTool(): PilotDeckToolDefinition<RenderHtmlVideoInput, RenderHtmlVideoOutput> {
  return {
    name: "render_html_video",
    aliases: ["RenderHtmlVideo"],
    description:
      "Render a local HTML file into an MP4 video using Playwright + ffmpeg. Use only when no video generation API is configured, or the user explicitly wants HTML screen-capture / editable Remotion-style workflow.",
    kind: "shell",
    inputSchema: {
      type: "object",
      required: ["html_path"],
      additionalProperties: false,
      properties: {
        html_path: { type: "string", description: "Path to source HTML file." },
        output_path: { type: "string", description: "Output MP4 path, default artifacts/media/*.mp4." },
        duration_seconds: { type: "integer", minimum: 1, maximum: 60 },
        fps: { type: "integer", minimum: 1, maximum: 60 },
        width: { type: "integer", minimum: 320, maximum: 3840 },
        height: { type: "integer", minimum: 180, maximum: 2160 },
      },
    },
    isReadOnly: () => false,
    isConcurrencySafe: () => true,
    checkPermissions: async (): Promise<PermissionResult> => ({
      type: "ask",
      reason: {
        type: "tool",
        toolName: "render_html_video",
        message: "Rendering HTML video requires running local commands and writing files.",
      },
      request: {
        toolCallId: "",
        toolName: "render_html_video",
        inputSummary: "render html to mp4",
        reason: {
          type: "tool",
          toolName: "render_html_video",
          message: "Rendering HTML video requires running local commands and writing files.",
        },
        options: [
          { id: "allow_once", label: "Allow render" },
          { id: "deny", label: "Deny" },
        ],
      },
    }),
    execute: async (input, context) => {
      const html = resolvePilotDeckWorkspacePath(input.html_path, context, { mustExist: true });
      if (!html.ok) {
        throw new PilotDeckToolRuntimeError(html.error.code, html.error.message, html.error.details);
      }
      const outputPath = input.output_path?.trim() || `artifacts/media/html-video-${Date.now()}.mp4`;
      const output = resolvePilotDeckWorkspacePath(outputPath, context, { forWrite: true });
      if (!output.ok) {
        throw new PilotDeckToolRuntimeError(output.error.code, output.error.message, output.error.details);
      }
      await mkdir(path.dirname(output.absolutePath), { recursive: true });
      const duration = typeof input.duration_seconds === "number" && Number.isFinite(input.duration_seconds)
        ? Math.max(1, Math.min(60, Math.floor(input.duration_seconds)))
        : 6;
      const fps = typeof input.fps === "number" && Number.isFinite(input.fps)
        ? Math.max(1, Math.min(60, Math.floor(input.fps)))
        : 24;
      const width = typeof input.width === "number" && Number.isFinite(input.width)
        ? Math.max(320, Math.min(3840, Math.floor(input.width)))
        : 1280;
      const height = typeof input.height === "number" && Number.isFinite(input.height)
        ? Math.max(180, Math.min(2160, Math.floor(input.height)))
        : 720;

      const scriptPath = path.resolve(process.cwd(), "scripts", "render-html-video.mjs");
      await runNodeScript(scriptPath, [
        "--input",
        html.absolutePath,
        "--output",
        output.absolutePath,
        "--duration",
        String(duration),
        "--fps",
        String(fps),
        "--width",
        String(width),
        "--height",
        String(height),
      ], context);

      const relative = output.relativePath.split(path.sep).join("/");
      const data: RenderHtmlVideoOutput = {
        outputPath: output.absolutePath,
        relativePath: relative,
        durationSeconds: duration,
        fps,
      };
      return {
        content: [
          { type: "text", text: `Rendered MP4 saved to ${relative}.` },
          { type: "file", path: output.absolutePath, mimeType: "video/mp4", description: "Rendered MP4 video" },
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
      stderr += chunk.toString();
    });
    child.once("error", (error) => {
      reject(
        new PilotDeckToolRuntimeError(
          "tool_execution_failed",
          `render_html_video failed to start: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    });
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new PilotDeckToolRuntimeError(
          "tool_execution_failed",
          stderr.trim().length > 0 ? stderr.trim() : "render_html_video exited with non-zero status.",
        ),
      );
    });
  });
}
