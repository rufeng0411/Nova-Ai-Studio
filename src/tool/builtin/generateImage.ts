import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PermissionResult } from "../../permission/index.js";
import { PilotDeckToolRuntimeError } from "../protocol/errors.js";
import type {
  PilotDeckToolDefinition,
  PilotDeckToolExecutionOutput,
  PilotDeckToolRuntimeContext,
} from "../protocol/types.js";
import { resolvePilotDeckWorkspacePath, toWorkspaceRelativePath } from "./filesystem/pathSafety.js";
import { resolveResilienceConfig } from "../../pilot/config/resolveResilienceConfig.js";
import { getImageGenerationGate } from "../../saas/resilience/imageGenerationGate.js";
import { novaSlideImageParallelLimit } from "../../saas/resilience/stabilityFlags.js";
import { redirectWritePathToTaskDir } from "../../saas/taskState/taskPathGuard.js";
import { ingestGeneratedImageIntoManifest } from "../../saas/media/visualAssetPlatform/ingestFromGenerateImage.js";
import { clampToolCapabilityFallbacks, executeWithCapabilityFallbacks } from "../../pilot/config/toolCapabilityFallbacks.js";

export type GenerateImageProvider =
  | "openai-compatible"
  | "google"
  | "qwen"
  | "volcengine"
  | "baidu"
  | "azure"
  | "cloud";

export type CreateGenerateImageToolOptions = {
  provider?: GenerateImageProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  /** PD-SAAS-FORK: up to 2 fallback image providers tried after primary failure. */
  fallbacks?: CreateGenerateImageToolOptions[];
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export type GenerateImageInput = {
  prompt: string;
  size?: string;
  aspect_ratio?: string;
  output_path?: string;
  /** PD-SAAS-FORK VAP P1-B: official reference edit paths (manifest official assets). */
  reference_image_paths?: string[];
};

export type GenerateImageOutput = {
  provider: GenerateImageProvider;
  model: string;
  outputPath: string;
  relativePath: string;
  bytes: number;
  mimeType: string;
};

const DEFAULT_TIMEOUT_MS = 90_000;

// PD-SAAS-FORK: cap the base64 image echoed back INTO the model conversation. A generated image is
// saved to disk and surfaced via the `file` block + the "saved to <path>" text, so the model needs no
// raw bytes to embed, cite, or preview it. Echoing a multi-MB base64 image every subsequent turn
// inflates the request body until the provider call dies with a raw "fetch failed" (observed in the
// field at ~880k-token contexts from a single hero image). Small images stay inline so the rare
// "generate then visually critique" flow still works; anything larger is referenced by path only.
export const DEFAULT_MAX_INLINE_IMAGE_BYTES = 512 * 1024;

export function resolveMaxInlineImageBytes(value: string | undefined): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_MAX_INLINE_IMAGE_BYTES;
}

export function shouldInlineGeneratedImage(byteLength: number, maxInlineBytes: number): boolean {
  return byteLength > 0 && byteLength <= maxInlineBytes;
}

export function createGenerateImageTool(
  options: CreateGenerateImageToolOptions = {},
): PilotDeckToolDefinition<GenerateImageInput, GenerateImageOutput> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return {
    name: "generate_image",
    aliases: ["GenerateImage"],
    description:
      "Generate an image from a text prompt and save it into the workspace as a binary file.",
    kind: "network",
    inputSchema: {
      type: "object",
      required: ["prompt"],
      additionalProperties: false,
      properties: {
        prompt: { type: "string", description: "Prompt used to generate the image." },
        size: { type: "string", description: "Optional size, e.g. 1024x1024." },
        aspect_ratio: { type: "string", description: "Optional aspect ratio, e.g. 16:9." },
        output_path: { type: "string", description: "Optional workspace output file path (.png/.jpg)." },
        reference_image_paths: {
          type: "array",
          items: { type: "string" },
          description: "Optional official reference images for edit/compose (workspace-relative paths).",
        },
      },
    },
    isReadOnly: () => false,
    isConcurrencySafe: () => true,
    isOpenWorld: () => true,
    checkPermissions: async (): Promise<PermissionResult> => ({
      type: "ask",
      reason: {
        type: "tool",
        toolName: "generate_image",
        message: "Image generation requires network access and file writes.",
      },
      request: {
        toolCallId: "",
        toolName: "generate_image",
        inputSummary: "generate image",
        reason: {
          type: "tool",
          toolName: "generate_image",
          message: "Image generation requires network access and file writes.",
        },
        options: [
          { id: "allow_once", label: "Allow image generation" },
          { id: "deny", label: "Deny" },
        ],
      },
    }),
    execute: async (input, context) => {
      const prompt = input.prompt.trim();
      if (!prompt) {
        throw new PilotDeckToolRuntimeError("invalid_tool_input", "generate_image requires a non-empty prompt.");
      }
      const referencePaths = Array.isArray(input.reference_image_paths)
        ? input.reference_image_paths.map((value) => String(value ?? "").trim()).filter(Boolean)
        : [];
      for (const ref of referencePaths) {
        const resolvedRef = resolvePilotDeckWorkspacePath(ref, context, { forWrite: false });
        if (!resolvedRef.ok) {
          throw new PilotDeckToolRuntimeError(
            resolvedRef.error.code,
            `reference_image_paths invalid: ${resolvedRef.error.message}`,
            resolvedRef.error.details,
          );
        }
      }
      const promptWithRefs = referencePaths.length > 0
        ? `${prompt}\n\n[official_reference_edit refs: ${referencePaths.join(", ")}]`
        : prompt;

      const attemptConfigs = [options, ...clampToolCapabilityFallbacks(options.fallbacks)];
      return executeWithCapabilityFallbacks(
        attemptConfigs.map((attemptOptions) => async () =>
          runGenerateImageAttempt({
            input,
            context,
            options: attemptOptions,
            promptWithRefs,
            fetchImpl,
            timeoutMs,
          }),
        ),
      );
    },
  };
}

async function runGenerateImageAttempt(args: {
  input: GenerateImageInput;
  context: PilotDeckToolRuntimeContext;
  options: CreateGenerateImageToolOptions;
  promptWithRefs: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
}): Promise<PilotDeckToolExecutionOutput<GenerateImageOutput>> {
  const { input, context, options, promptWithRefs, fetchImpl, timeoutMs } = args;
      const provider = resolveProvider(options.provider, context);
      const apiKey = resolveApiKey(options.apiKey, provider, context);
      const baseUrl = resolveBaseUrl(options.baseUrl, provider, context);
      const model = resolveModel(options.model, provider, context);
      if (!apiKey) {
        throw new PilotDeckToolRuntimeError(
          "unsupported_tool",
          "generate_image is not configured. Set tools.image.apiKey or related environment variable.",
        );
      }
      if (!baseUrl) {
        throw new PilotDeckToolRuntimeError(
          "unsupported_tool",
          "generate_image is not configured. Set tools.image.baseUrl or provider-specific base URL.",
        );
      }

      const imageRequest = () =>
        requestImage({
          provider,
          apiKey,
          baseUrl,
          model,
          prompt: promptWithRefs,
          size: input.size,
          aspectRatio: input.aspect_ratio,
          timeoutMs,
          fetchImpl,
          context,
        });

      const resilience = resolveResilienceConfig();
      const imageConcurrency = Math.max(
        resilience.imageMaxConcurrent,
        novaSlideImageParallelLimit(),
      );
      const imageBuffer =
        imageConcurrency > 0
          ? await getImageGenerationGate(imageConcurrency).run(imageRequest)
          : await imageRequest();

      const outputPathRaw = input.output_path?.trim() || `artifacts/media/image-${Date.now()}.png`;
      const outputPath = context.taskArtifactDir
        ? redirectWritePathToTaskDir(outputPathRaw, context.taskArtifactDir, {
          knownTaskDirs: context.knownTaskArtifactDirs,
        })
        : outputPathRaw;
      const resolved = resolvePilotDeckWorkspacePath(outputPath, context, { forWrite: true });
      if (!resolved.ok) {
        throw new PilotDeckToolRuntimeError(resolved.error.code, resolved.error.message, resolved.error.details);
      }
      await mkdir(path.dirname(resolved.absolutePath), { recursive: true });
      await writeFile(resolved.absolutePath, imageBuffer);
      const relative = toWorkspaceRelativePath(resolved.absolutePath, resolved.root).split(path.sep).join("/");
      const mimeType = inferImageMimeType(resolved.absolutePath);
      const data: GenerateImageOutput = {
        provider,
        model,
        outputPath: resolved.absolutePath,
        relativePath: relative,
        bytes: imageBuffer.length,
        mimeType,
      };
      // PD-SAAS-FORK: only inline small images into the model context (see helper above). Large
      // generated images are referenced by the `file` block + path text, never echoed as base64.
      const maxInlineBytes = resolveMaxInlineImageBytes(readEnv(context, "PILOTDECK_IMAGE_INLINE_MAX_BYTES"));
      const inlineImage = shouldInlineGeneratedImage(imageBuffer.length, maxInlineBytes)
        ? [{ type: "image" as const, mimeType, data: imageBuffer.toString("base64") }]
        : [];
      // PD-SAAS-FORK VAP: auto-ingest generated images for prepare/slot binding.
      await ingestGeneratedImageIntoManifest({
        workspaceRoot: resolved.root,
        sessionId: context.sessionId,
        taskArtifactDir: context.taskArtifactDir,
        relativePath: relative,
        subjectAnchor: context.sessionGoalQualityContract?.subjectAnchor,
        goalVersion: context.taskGoalVersion,
        officialMediaPolicy: context.sessionGoalQualityContract?.officialMediaPolicy,
      });
      return {
        content: [
          { type: "text", text: `Generated image saved to ${relative}.` },
          { type: "file", path: resolved.absolutePath, mimeType, description: "Generated image file" },
          ...inlineImage,
        ],
        data,
      };
}

function resolveProvider(
  input: GenerateImageProvider | undefined,
  context: PilotDeckToolRuntimeContext,
): GenerateImageProvider {
  if (input) return input;
  return (readEnv(context, "PILOTDECK_IMAGE_PROVIDER") as GenerateImageProvider | undefined) ?? "openai-compatible";
}

function resolveApiKey(
  input: string | undefined,
  provider: GenerateImageProvider,
  context: PilotDeckToolRuntimeContext,
): string | undefined {
  const fromOption = input?.trim();
  if (fromOption) return fromOption;
  if (provider === "google") return readEnv(context, "GOOGLE_API_KEY");
  if (provider === "qwen") return readEnv(context, "DASHSCOPE_API_KEY");
  if (provider === "volcengine") return readEnv(context, "VOLCENGINE_API_KEY");
  if (provider === "baidu") return readEnv(context, "QIANFAN_API_KEY");
  return readEnv(context, "OPENAI_API_KEY") ?? readEnv(context, "PILOTDECK_IMAGE_API_KEY");
}

function resolveBaseUrl(
  input: string | undefined,
  provider: GenerateImageProvider,
  context: PilotDeckToolRuntimeContext,
): string | undefined {
  const fromOption = input?.trim();
  if (fromOption) {
    const trimmed = fromOption.replace(/\/+$/, "");
    return provider === "google" ? googleNativeApiBaseUrl(trimmed) : trimmed;
  }
  if (provider === "google") return "https://generativelanguage.googleapis.com/v1beta";
  if (provider === "qwen") return "https://dashscope.aliyuncs.com/compatible-mode/v1";
  if (provider === "volcengine") return "https://ark.cn-beijing.volces.com/api/v3";
  if (provider === "baidu") return "https://qianfan.baidubce.com/v2";
  return readEnv(context, "OPENAI_BASE_URL") ?? readEnv(context, "PILOTDECK_IMAGE_BASE_URL");
}

function googleNativeApiBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "").replace(/\/openai$/i, "");
}

function normalizeGoogleModelId(model: string): string {
  return model.trim().replace(/^models\//i, "");
}

function isGeminiNativeImageModel(model: string): boolean {
  const id = normalizeGoogleModelId(model).toLowerCase();
  if (/^imagen-/.test(id)) return false;
  return /^gemini-.*-image|nano-banana|flash-image|image-generation/.test(id);
}

function resolveModel(
  input: string | undefined,
  provider: GenerateImageProvider,
  context: PilotDeckToolRuntimeContext,
): string {
  const fromOption = input?.trim();
  if (fromOption) return fromOption;
  if (provider === "google") return "imagen-3.0-generate-002";
  if (provider === "qwen") return "qwen-image-plus";
  if (provider === "volcengine") return "doubao-seedream-3-0-t2i-250415";
  if (provider === "baidu") return "ernie-vilg-v2";
  return readEnv(context, "PILOTDECK_IMAGE_MODEL") ?? "gpt-image-1";
}

type RequestImageArgs = {
  provider: GenerateImageProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  prompt: string;
  size?: string;
  aspectRatio?: string;
  timeoutMs: number;
  fetchImpl: typeof fetch;
  context: PilotDeckToolRuntimeContext;
};

function dashScopeApiV1Root(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (/\/api\/v1$/i.test(trimmed)) return trimmed;
  const intl = /dashscope-intl\.aliyuncs\.com/i.test(trimmed);
  return intl
    ? "https://dashscope-intl.aliyuncs.com/api/v1"
    : "https://dashscope.aliyuncs.com/api/v1";
}

function usesDashScopeImageApi(provider: GenerateImageProvider, model: string): boolean {
  if (provider === "qwen") return true;
  const id = model.trim().toLowerCase();
  return /qwen-image|wanx|wan2\.\d+-t2i/.test(id);
}

function isWanxLegacyT2iModel(model: string): boolean {
  const id = model.trim().toLowerCase();
  if (/wan2\.6-t2i/.test(id)) return false;
  return /wanx2\.\d+-t2i|wanx-v1|wan2\.[0-5]-t2i/.test(id);
}

/** DashScope size uses `width*height`; map aspect_ratio / OpenAI-style size. */
function dashScopeImageSize(size?: string, aspectRatio?: string): string {
  const rawSize = size?.trim();
  if (rawSize) {
    const normalized = rawSize.replace(/x/gi, "*");
    if (/^\d+\*\d+$/.test(normalized)) return normalized;
  }
  switch (aspectRatio?.trim()) {
    case "16:9":
      return "1664*928";
    case "9:16":
      return "928*1664";
    case "4:3":
      return "1472*1104";
    case "3:4":
      return "1104*1472";
    case "1:1":
      return "1328*1328";
    default:
      return "1664*928";
  }
}

function assertDashScopeOk(raw: any, label: string): void {
  const code = readString(raw?.code);
  if (code && code !== "Success" && code !== "success") {
    const message = readString(raw?.message) ?? code;
    throw new PilotDeckToolRuntimeError("tool_execution_failed", `${label} failed: ${message}`);
  }
}

function extractDashScopeImageUrl(raw: any): string | undefined {
  const choices = raw?.output?.choices;
  if (Array.isArray(choices)) {
    for (const choice of choices) {
      const content = choice?.message?.content;
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        const image = readString(part?.image);
        if (image) return image;
      }
    }
  }
  const results = raw?.output?.results;
  if (Array.isArray(results)) {
    for (const item of results) {
      const url = readString(item?.url);
      if (url) return url;
    }
  }
  return undefined;
}

async function requestImage(args: RequestImageArgs): Promise<Buffer> {
  if (args.provider === "google") {
    return requestGoogleImage(args);
  }
  if (args.provider === "baidu") {
    return requestBaiduImage(args);
  }
  if (usesDashScopeImageApi(args.provider, args.model)) {
    if (isWanxLegacyT2iModel(args.model)) {
      return requestDashScopeWanxLegacyImage(args);
    }
    return requestDashScopeQwenImage(args);
  }
  return requestOpenAiCompatibleImage(args);
}

async function requestDashScopeQwenImage(args: RequestImageArgs): Promise<Buffer> {
  const root = dashScopeApiV1Root(args.baseUrl);
  const url = `${root}/services/aigc/multimodal-generation/generation`;
  const raw = await performJsonRequest(args.fetchImpl, {
    url,
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      input: {
        messages: [
          {
            role: "user",
            content: [{ text: args.prompt }],
          },
        ],
      },
      parameters: {
        size: dashScopeImageSize(args.size, args.aspectRatio),
        prompt_extend: true,
        watermark: false,
      },
    }),
    timeoutMs: args.timeoutMs,
    context: args.context,
    label: "generate_image_qwen",
  });
  assertDashScopeOk(raw, "generate_image");
  const imageUrl = extractDashScopeImageUrl(raw);
  if (!imageUrl) {
    throw new PilotDeckToolRuntimeError(
      "tool_execution_failed",
      "DashScope image provider returned no image URL.",
    );
  }
  return performBinaryRequest(args.fetchImpl, {
    url: imageUrl,
    method: "GET",
    headers: {},
    timeoutMs: args.timeoutMs,
    context: args.context,
    label: "generate_image_qwen_fetch",
  });
}

async function requestDashScopeWanxLegacyImage(args: RequestImageArgs): Promise<Buffer> {
  const root = dashScopeApiV1Root(args.baseUrl);
  const createUrl = `${root}/services/aigc/text2image/image-synthesis`;
  const created = await performJsonRequest(args.fetchImpl, {
    url: createUrl,
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      input: { prompt: args.prompt },
      parameters: {
        size: dashScopeImageSize(args.size, args.aspectRatio),
        n: 1,
      },
    }),
    timeoutMs: Math.min(args.timeoutMs, 60_000),
    context: args.context,
    label: "generate_image_wanx_create",
  });
  assertDashScopeOk(created, "generate_image");
  const taskId = readString(created?.output?.task_id) ?? readString(created?.task_id);
  if (!taskId) {
    throw new PilotDeckToolRuntimeError(
      "tool_execution_failed",
      "DashScope wanx task returned no task_id.",
    );
  }

  const deadline = Date.now() + args.timeoutMs;
  const pollIntervalMs = 2_000;
  while (Date.now() < deadline) {
    await sleep(pollIntervalMs, args.context.abortSignal);
    const status = await performJsonRequest(args.fetchImpl, {
      url: `${root}/tasks/${encodeURIComponent(taskId)}`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        Accept: "application/json",
      },
      timeoutMs: Math.min(args.timeoutMs, 30_000),
      context: args.context,
      label: "generate_image_wanx_poll",
    });
    assertDashScopeOk(status, "generate_image");
    const taskStatus = readString(status?.output?.task_status)?.toUpperCase();
    if (taskStatus === "FAILED" || taskStatus === "CANCELLED") {
      const reason =
        readString(status?.output?.message) ??
        readString(status?.message) ??
        "wanx image generation failed";
      throw new PilotDeckToolRuntimeError("tool_execution_failed", reason);
    }
    if (taskStatus === "SUCCEEDED") {
      const imageUrl = extractDashScopeImageUrl(status);
      if (!imageUrl) {
        throw new PilotDeckToolRuntimeError(
          "tool_execution_failed",
          "DashScope wanx task succeeded but returned no image URL.",
        );
      }
      return performBinaryRequest(args.fetchImpl, {
        url: imageUrl,
        method: "GET",
        headers: {},
        timeoutMs: args.timeoutMs,
        context: args.context,
        label: "generate_image_wanx_fetch",
      });
    }
  }
  throw new PilotDeckToolRuntimeError("tool_timeout", `generate_image timed out after ${args.timeoutMs}ms.`);
}

function sleep(ms: number, abortSignal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (abortSignal?.aborted) {
      reject(new PilotDeckToolRuntimeError("tool_cancelled", "generate_image cancelled."));
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new PilotDeckToolRuntimeError("tool_cancelled", "generate_image cancelled."));
    };
    abortSignal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function requestOpenAiCompatibleImage(args: RequestImageArgs): Promise<Buffer> {
  const url = `${args.baseUrl.replace(/\/+$/, "")}/images/generations`;
  const payload: Record<string, unknown> = {
    model: args.model,
    prompt: args.prompt,
    response_format: "b64_json",
  };
  if (args.size?.trim()) payload.size = args.size.trim();
  if (args.aspectRatio?.trim()) payload.aspect_ratio = args.aspectRatio.trim();
  const raw = await performJsonRequest(args.fetchImpl, {
    url,
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    timeoutMs: args.timeoutMs,
    context: args.context,
    label: "generate_image",
  });
  const first = Array.isArray(raw?.data) ? raw.data[0] : undefined;
  const b64 = typeof first?.b64_json === "string" ? first.b64_json : undefined;
  if (b64) {
    return Buffer.from(b64, "base64");
  }
  const urlValue = typeof first?.url === "string" ? first.url : undefined;
  if (!urlValue) {
    throw new PilotDeckToolRuntimeError("tool_execution_failed", "Image provider returned no image payload.");
  }
  const fileResponse = await performBinaryRequest(args.fetchImpl, {
    url: urlValue,
    method: "GET",
    headers: {},
    timeoutMs: args.timeoutMs,
    context: args.context,
    label: "generate_image_fetch",
  });
  return fileResponse;
}

async function requestGoogleImage(args: RequestImageArgs): Promise<Buffer> {
  const baseUrl = googleNativeApiBaseUrl(args.baseUrl);
  const model = normalizeGoogleModelId(args.model);
  const normalized = { ...args, baseUrl, model };
  if (isGeminiNativeImageModel(model)) {
    return requestGoogleGeminiImage(normalized);
  }
  return requestGoogleImagenImage(normalized);
}

async function requestGoogleGeminiImage(args: RequestImageArgs): Promise<Buffer> {
  const url = `${args.baseUrl}/models/${encodeURIComponent(args.model)}:generateContent?key=${encodeURIComponent(args.apiKey)}`;
  const payload: Record<string, unknown> = {
    contents: [{ parts: [{ text: args.prompt }] }],
  };
  const aspectRatio = args.aspectRatio?.trim();
  if (aspectRatio) {
    payload.generationConfig = { imageConfig: { aspectRatio } };
  }
  const raw = await performJsonRequest(args.fetchImpl, {
    url,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    timeoutMs: args.timeoutMs,
    context: args.context,
    label: "generate_image_google_gemini",
  });
  const parts = raw?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    for (const part of parts) {
      const b64 = typeof part?.inlineData?.data === "string" ? part.inlineData.data : undefined;
      if (b64) return Buffer.from(b64, "base64");
    }
  }
  throw new PilotDeckToolRuntimeError(
    "tool_execution_failed",
    "Google Gemini image provider returned no image payload.",
  );
}

async function requestGoogleImagenImage(args: RequestImageArgs): Promise<Buffer> {
  const url = `${args.baseUrl}/models/${encodeURIComponent(args.model)}:predict?key=${encodeURIComponent(args.apiKey)}`;
  const payload: Record<string, unknown> = {
    instances: [{ prompt: args.prompt }],
    parameters: { sampleCount: 1 },
  };
  const raw = await performJsonRequest(args.fetchImpl, {
    url,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    timeoutMs: args.timeoutMs,
    context: args.context,
    label: "generate_image_google",
  });
  const first = Array.isArray(raw?.predictions) ? raw.predictions[0] : undefined;
  const b64 = typeof first?.bytesBase64Encoded === "string" ? first.bytesBase64Encoded : undefined;
  if (!b64) {
    throw new PilotDeckToolRuntimeError("tool_execution_failed", "Google image provider returned no image payload.");
  }
  return Buffer.from(b64, "base64");
}

async function requestBaiduImage(args: RequestImageArgs): Promise<Buffer> {
  const url = `${args.baseUrl.replace(/\/+$/, "")}/txt2img`;
  const raw = await performJsonRequest(args.fetchImpl, {
    url,
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      prompt: args.prompt,
      response_format: "b64_json",
    }),
    timeoutMs: args.timeoutMs,
    context: args.context,
    label: "generate_image_baidu",
  });
  const b64 = typeof raw?.data?.[0]?.b64_image === "string"
    ? raw.data[0].b64_image
    : typeof raw?.data?.[0]?.b64_json === "string"
      ? raw.data[0].b64_json
      : undefined;
  if (!b64) {
    throw new PilotDeckToolRuntimeError("tool_execution_failed", "Baidu image provider returned no image payload.");
  }
  return Buffer.from(b64, "base64");
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

async function performBinaryRequest(fetchImpl: typeof fetch, args: Omit<JsonRequestArgs, "body">): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);
  const detachAbort = forwardAbort(args.context.abortSignal, controller);
  try {
    const response = await fetchImpl(args.url, {
      method: args.method,
      headers: args.headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new PilotDeckToolRuntimeError(
        "tool_execution_failed",
        `${args.label} failed: ${response.status} ${response.statusText}`,
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
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

function inferImageMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
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
