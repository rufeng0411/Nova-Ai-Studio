import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PermissionResult } from "../../permission/index.js";
import { PilotDeckToolRuntimeError } from "../protocol/errors.js";
import type {
  PilotDeckToolDefinition,
  PilotDeckToolRuntimeContext,
} from "../protocol/types.js";
import { resolvePilotDeckWorkspacePath, toWorkspaceRelativePath } from "./filesystem/pathSafety.js";
import {
  isModelNotExistError,
  resolveVideoModelFallbackChain,
} from "../../saas/media/videoModelRegistry.js";
import { clampToolCapabilityFallbacks, executeWithCapabilityFallbacks } from "../../pilot/config/toolCapabilityFallbacks.js";

export type GenerateVideoProvider =
  | "openai-compatible"
  | "google"
  | "qwen"
  | "volcengine"
  | "baidu"
  | "azure"
  | "cloud";

export type CreateGenerateVideoToolOptions = {
  provider?: GenerateVideoProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  /** PD-SAAS-FORK: up to 2 fallback video providers tried after primary failure. */
  fallbacks?: CreateGenerateVideoToolOptions[];
  timeoutMs?: number;
  pollIntervalMs?: number;
  fetchImpl?: typeof fetch;
};

export type GenerateVideoInput = {
  prompt: string;
  duration_seconds?: number;
  aspect_ratio?: string;
  output_path?: string;
};

export type GenerateVideoOutput = {
  provider: GenerateVideoProvider;
  model: string;
  outputPath: string;
  relativePath: string;
  bytes: number;
  mimeType: "video/mp4";
};

const DEFAULT_TIMEOUT_MS = 240_000;
const DEFAULT_POLL_INTERVAL_MS = 3_000;

export function createGenerateVideoTool(
  options: CreateGenerateVideoToolOptions = {},
): PilotDeckToolDefinition<GenerateVideoInput, GenerateVideoOutput> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  return {
    name: "generate_video",
    aliases: ["GenerateVideo"],
    description:
      "Generate an MP4 video from a text prompt and save it into the workspace. Prefer this over render_html_video when video API is configured and user wants a playable mp4.",
    kind: "network",
    inputSchema: {
      type: "object",
      required: ["prompt"],
      additionalProperties: false,
      properties: {
        prompt: { type: "string", description: "Prompt used to generate the video." },
        duration_seconds: { type: "integer", minimum: 1, maximum: 60, description: "Video duration seconds." },
        aspect_ratio: { type: "string", description: "Aspect ratio, e.g. 16:9." },
        output_path: { type: "string", description: "Optional workspace output path (.mp4)." },
      },
    },
    isReadOnly: () => false,
    isConcurrencySafe: () => true,
    isOpenWorld: () => true,
    checkPermissions: async (): Promise<PermissionResult> => ({
      type: "ask",
      reason: {
        type: "tool",
        toolName: "generate_video",
        message: "Video generation requires network access and file writes.",
      },
      request: {
        toolCallId: "",
        toolName: "generate_video",
        inputSummary: "generate video",
        reason: {
          type: "tool",
          toolName: "generate_video",
          message: "Video generation requires network access and file writes.",
        },
        options: [
          { id: "allow_once", label: "Allow video generation" },
          { id: "deny", label: "Deny" },
        ],
      },
    }),
    execute: async (input, context) => {
      const prompt = input.prompt.trim();
      if (!prompt) {
        throw new PilotDeckToolRuntimeError("invalid_tool_input", "generate_video requires a non-empty prompt.");
      }
      const attemptConfigs = [options, ...clampToolCapabilityFallbacks(options.fallbacks)];
      return executeWithCapabilityFallbacks(
        attemptConfigs.map((attemptOptions) => async () =>
          runGenerateVideoAttempt({
            input,
            context,
            options: attemptOptions,
            prompt,
            fetchImpl,
            timeoutMs,
            pollIntervalMs,
          }),
        ),
      );
    },
  };
}

async function runGenerateVideoAttempt(args: {
  input: GenerateVideoInput;
  context: PilotDeckToolRuntimeContext;
  options: CreateGenerateVideoToolOptions;
  prompt: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
  pollIntervalMs: number;
}) {
  const { input, context, options, prompt, fetchImpl, timeoutMs, pollIntervalMs } = args;
      const provider = resolveProvider(options.provider, context);
      const apiKey = resolveApiKey(options.apiKey, provider, context);
      const baseUrl = resolveBaseUrl(options.baseUrl, provider, context);
      const model = resolveModel(options.model, provider, context);
      if (!apiKey) {
        throw new PilotDeckToolRuntimeError(
          "unsupported_tool",
          "generate_video is not configured. Set tools.video.apiKey or related environment variable.",
        );
      }
      if (!baseUrl) {
        throw new PilotDeckToolRuntimeError(
          "unsupported_tool",
          "generate_video is not configured. Set tools.video.baseUrl or provider-specific base URL.",
        );
      }

      const modelChain = resolveVideoModelFallbackChain(model);
      let videoBuffer: Buffer | undefined;
      let usedModel = model;
      const errors: string[] = [];

      for (const candidateModel of modelChain.slice(0, 3)) {
        try {
          videoBuffer = await requestVideo({
            provider,
            apiKey,
            baseUrl,
            model: candidateModel,
            prompt,
            durationSeconds: input.duration_seconds,
            aspectRatio: input.aspect_ratio,
            timeoutMs,
            pollIntervalMs,
            fetchImpl,
            context,
          });
          usedModel = candidateModel;
          break;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(`${candidateModel}: ${message}`);
          if (!isModelNotExistError(message)) {
            throw error;
          }
        }
      }

      if (!videoBuffer) {
        throw new PilotDeckToolRuntimeError(
          "tool_execution_failed",
          `video_api_exhausted: ${errors.join(" | ")}`,
        );
      }

      const outputPath = input.output_path?.trim() || `artifacts/media/video-${Date.now()}.mp4`;
      const resolved = resolvePilotDeckWorkspacePath(outputPath, context, { forWrite: true });
      if (!resolved.ok) {
        throw new PilotDeckToolRuntimeError(resolved.error.code, resolved.error.message, resolved.error.details);
      }
      await mkdir(path.dirname(resolved.absolutePath), { recursive: true });
      await writeFile(resolved.absolutePath, videoBuffer);
      const relative = toWorkspaceRelativePath(resolved.absolutePath, resolved.root).split(path.sep).join("/");
      const data: GenerateVideoOutput = {
        provider,
        model: usedModel,
        outputPath: resolved.absolutePath,
        relativePath: relative,
        bytes: videoBuffer.length,
        mimeType: "video/mp4",
      };
      return {
        content: [
          { type: "text" as const, text: `Generated video saved to ${relative}.` },
          {
            type: "file" as const,
            path: resolved.absolutePath,
            mimeType: "video/mp4",
            description: "Generated video file",
          },
        ],
        data,
      };
}

function resolveProvider(
  input: GenerateVideoProvider | undefined,
  context: PilotDeckToolRuntimeContext,
): GenerateVideoProvider {
  if (input) return input;
  return (readEnv(context, "PILOTDECK_VIDEO_PROVIDER") as GenerateVideoProvider | undefined) ?? "openai-compatible";
}

function resolveApiKey(
  input: string | undefined,
  provider: GenerateVideoProvider,
  context: PilotDeckToolRuntimeContext,
): string | undefined {
  const fromOption = input?.trim();
  if (fromOption) return fromOption;
  if (provider === "google") return readEnv(context, "GOOGLE_API_KEY");
  if (provider === "qwen") return readEnv(context, "DASHSCOPE_API_KEY");
  if (provider === "volcengine") return readEnv(context, "VOLCENGINE_API_KEY");
  if (provider === "baidu") return readEnv(context, "QIANFAN_API_KEY");
  return readEnv(context, "OPENAI_API_KEY") ?? readEnv(context, "PILOTDECK_VIDEO_API_KEY");
}

function resolveBaseUrl(
  input: string | undefined,
  provider: GenerateVideoProvider,
  context: PilotDeckToolRuntimeContext,
): string | undefined {
  const fromOption = input?.trim();
  if (fromOption) return fromOption.replace(/\/+$/, "");
  if (provider === "google") return "https://generativelanguage.googleapis.com/v1beta";
  if (provider === "qwen") return "https://dashscope.aliyuncs.com/compatible-mode/v1";
  if (provider === "volcengine") return "https://ark.cn-beijing.volces.com/api/v3";
  if (provider === "baidu") return "https://qianfan.baidubce.com/v2";
  return readEnv(context, "OPENAI_BASE_URL") ?? readEnv(context, "PILOTDECK_VIDEO_BASE_URL");
}

function resolveModel(
  input: string | undefined,
  provider: GenerateVideoProvider,
  context: PilotDeckToolRuntimeContext,
): string {
  const fromOption = input?.trim();
  if (fromOption) return fromOption;
  if (provider === "google") return "veo-2.0-generate-001";
  if (provider === "qwen") return "wanx2.1-t2v-turbo";
  if (provider === "volcengine") return "doubao-seedance-1-5-pro-251215";
  if (provider === "baidu") return "ernie-videogen";
  return readEnv(context, "PILOTDECK_VIDEO_MODEL") ?? "sora";
}

type RequestVideoArgs = {
  provider: GenerateVideoProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  prompt: string;
  durationSeconds?: number;
  aspectRatio?: string;
  timeoutMs: number;
  pollIntervalMs: number;
  fetchImpl: typeof fetch;
  context: PilotDeckToolRuntimeContext;
};

async function requestVideo(args: RequestVideoArgs): Promise<Buffer> {
  if (args.provider === "qwen" && isDashScopeNativeVideoModel(args.model)) {
    return requestDashScopeWanxVideo(args);
  }
  const createUrl = `${args.baseUrl.replace(/\/+$/, "")}/videos/generations`;
  const createPayload: Record<string, unknown> = {
    model: args.model,
    prompt: args.prompt,
    response_format: "b64_json",
  };
  if (typeof args.durationSeconds === "number" && Number.isFinite(args.durationSeconds)) {
    createPayload.duration = args.durationSeconds;
  }
  if (args.aspectRatio?.trim()) {
    createPayload.aspect_ratio = args.aspectRatio.trim();
  }
  const created = await performJsonRequest(args.fetchImpl, {
    url: createUrl,
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(createPayload),
    timeoutMs: Math.min(args.timeoutMs, 60_000),
    context: args.context,
    label: "generate_video_create",
  });
  const immediate = extractVideoPayload(created);
  if (immediate) {
    return immediate;
  }
  const immediateUrl = extractVideoUrl(created);
  if (immediateUrl) {
    return performBinaryDownload(args.fetchImpl, immediateUrl, args.timeoutMs, args.context, "generate_video_download");
  }

  const jobId = readString(created?.id) ?? readString(created?.data?.id);
  if (!jobId) {
    throw new PilotDeckToolRuntimeError(
      "tool_execution_failed",
      "Video provider returned no downloadable payload and no job id.",
    );
  }

  const deadline = Date.now() + args.timeoutMs;
  while (Date.now() < deadline) {
    await sleep(args.pollIntervalMs, args.context.abortSignal);
    const status = await performJsonRequest(args.fetchImpl, {
      url: `${args.baseUrl.replace(/\/+$/, "")}/videos/generations/${encodeURIComponent(jobId)}`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        Accept: "application/json",
      },
      timeoutMs: Math.min(args.timeoutMs, 30_000),
      context: args.context,
      label: "generate_video_poll",
    });
    const statusText = readString(status?.status)?.toLowerCase();
    if (statusText === "failed" || statusText === "error" || statusText === "cancelled") {
      const reason = readString(status?.error?.message) ?? readString(status?.message) ?? "video generation failed";
      throw new PilotDeckToolRuntimeError("tool_execution_failed", reason);
    }
    const done = statusText === "succeeded" || statusText === "completed" || statusText === "done";
    const payload = extractVideoPayload(status);
    if (payload) {
      return payload;
    }
    const url = extractVideoUrl(status);
    if (url) {
      return performBinaryDownload(args.fetchImpl, url, args.timeoutMs, args.context, "generate_video_download");
    }
    if (done) {
      break;
    }
  }

  throw new PilotDeckToolRuntimeError("tool_timeout", `generate_video timed out after ${args.timeoutMs}ms.`);
}

function isDashScopeNativeVideoModel(model: string): boolean {
  const id = model.toLowerCase();
  return /wanx|happyhorse|wan2\.|t2v|i2v/.test(id);
}

function dashScopeApiV1Root(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.includes("/compatible-mode/")) {
    return "https://dashscope.aliyuncs.com/api/v1";
  }
  if (trimmed.endsWith("/api/v1")) return trimmed;
  return "https://dashscope.aliyuncs.com/api/v1";
}

async function requestDashScopeWanxVideo(args: RequestVideoArgs): Promise<Buffer> {
  const root = dashScopeApiV1Root(args.baseUrl);
  const createUrl = `${root}/services/aigc/video-generation/video-synthesis`;
  const parameters: Record<string, unknown> = {};
  if (typeof args.durationSeconds === "number" && Number.isFinite(args.durationSeconds)) {
    parameters.duration = args.durationSeconds;
  }
  if (args.aspectRatio?.trim()) {
    parameters.size = args.aspectRatio.trim().replace(":", "*");
  }
  const created = await performJsonRequest(args.fetchImpl, {
    url: createUrl,
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model: args.model,
      input: { prompt: args.prompt },
      ...(Object.keys(parameters).length > 0 ? { parameters } : {}),
    }),
    timeoutMs: Math.min(args.timeoutMs, 60_000),
    context: args.context,
    label: "generate_video_wanx_create",
  });
  const taskId = readString(created?.output?.task_id) ?? readString(created?.task_id);
  if (!taskId) {
    throw new PilotDeckToolRuntimeError(
      "tool_execution_failed",
      "DashScope video task returned no task_id.",
    );
  }

  const deadline = Date.now() + args.timeoutMs;
  while (Date.now() < deadline) {
    await sleep(args.pollIntervalMs, args.context.abortSignal);
    const status = await performJsonRequest(args.fetchImpl, {
      url: `${root}/tasks/${encodeURIComponent(taskId)}`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        Accept: "application/json",
      },
      timeoutMs: Math.min(args.timeoutMs, 30_000),
      context: args.context,
      label: "generate_video_wanx_poll",
    });
    const taskStatus = readString(status?.output?.task_status)?.toUpperCase();
    if (taskStatus === "FAILED" || taskStatus === "CANCELLED") {
      const reason =
        readString(status?.output?.message) ??
        readString(status?.message) ??
        "wanx video generation failed";
      throw new PilotDeckToolRuntimeError("tool_execution_failed", reason);
    }
    if (taskStatus === "SUCCEEDED") {
      const videoUrl =
        readString(status?.output?.video_url)
        ?? readString(status?.output?.results?.video_url)
        ?? readString(status?.output?.results?.[0]?.url);
      if (!videoUrl) {
        throw new PilotDeckToolRuntimeError(
          "tool_execution_failed",
          "DashScope video task succeeded but returned no video URL.",
        );
      }
      return performBinaryDownload(args.fetchImpl, videoUrl, args.timeoutMs, args.context, "generate_video_wanx_fetch");
    }
  }
  throw new PilotDeckToolRuntimeError("tool_timeout", `generate_video timed out after ${args.timeoutMs}ms.`);
}

function extractVideoPayload(raw: any): Buffer | undefined {
  const data = Array.isArray(raw?.data) ? raw.data[0] : raw?.data;
  const b64 = readString(data?.b64_json) ?? readString(data?.video_b64) ?? readString(raw?.b64_json);
  if (b64) {
    return Buffer.from(b64, "base64");
  }
  return undefined;
}

function extractVideoUrl(raw: any): string | undefined {
  const data = Array.isArray(raw?.data) ? raw.data[0] : raw?.data;
  return readString(data?.url) ?? readString(raw?.url);
}

type JsonRequestArgs = {
  url: string;
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
  context: PilotDeckToolRuntimeContext;
  label: string;
};

async function performJsonRequest(fetchImpl: typeof fetch, args: JsonRequestArgs): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);
  const detachAbort = forwardAbort(args.context.abortSignal, controller);
  try {
    const response = await fetchImpl(args.url, {
      method: args.method,
      headers: args.headers,
      ...(args.body ? { body: args.body } : {}),
      signal: controller.signal,
    });
    const text = await response.text();
    const raw = text ? safeJsonParse(text) : {};
    if (!response.ok) {
      const detail =
        readString(raw?.error?.message) ??
        readString(raw?.message) ??
        `${response.status} ${response.statusText}`;
      throw new PilotDeckToolRuntimeError("tool_execution_failed", `${args.label} failed: ${detail}`);
    }
    return raw;
  } catch (error) {
    if (controller.signal.aborted && args.context.abortSignal?.aborted !== true) {
      throw new PilotDeckToolRuntimeError("tool_timeout", `${args.label} timed out after ${args.timeoutMs}ms.`);
    }
    if (error instanceof PilotDeckToolRuntimeError) {
      throw error;
    }
    throw new PilotDeckToolRuntimeError(
      "tool_execution_failed",
      `${args.label} request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timeout);
    detachAbort?.();
  }
}

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

async function performBinaryDownload(
  fetchImpl: typeof fetch,
  url: string,
  timeoutMs: number,
  context: PilotDeckToolRuntimeContext,
  label: string,
): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const detachAbort = forwardAbort(context.abortSignal, controller);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new PilotDeckToolRuntimeError(
        "tool_execution_failed",
        `${label} failed: ${response.status} ${response.statusText}`,
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    if (controller.signal.aborted && context.abortSignal?.aborted !== true) {
      throw new PilotDeckToolRuntimeError("tool_timeout", `${label} timed out after ${timeoutMs}ms.`);
    }
    if (error instanceof PilotDeckToolRuntimeError) throw error;
    throw new PilotDeckToolRuntimeError(
      "tool_execution_failed",
      `${label} request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timeout);
    detachAbort?.();
  }
}

function readEnv(context: PilotDeckToolRuntimeContext, name: string): string | undefined {
  const value = (context.env ?? process.env)[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function forwardAbort(signal: AbortSignal | undefined, controller: AbortController): (() => void) | undefined {
  if (!signal) return undefined;
  const listener = () => controller.abort();
  signal.addEventListener("abort", listener);
  return () => signal.removeEventListener("abort", listener);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(new PilotDeckToolRuntimeError("tool_execution_failed", "generate_video aborted."));
    };
    signal.addEventListener("abort", onAbort);
  });
}
