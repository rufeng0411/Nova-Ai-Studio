import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PermissionResult } from "../../permission/index.js";
import { PilotDeckToolRuntimeError } from "../protocol/errors.js";
import type {
  PilotDeckToolDefinition,
  PilotDeckToolRuntimeContext,
} from "../protocol/types.js";
import { resolvePilotDeckWorkspacePath, toWorkspaceRelativePath } from "./filesystem/pathSafety.js";

export type GenerateSpeechProvider =
  | "openai-compatible"
  | "google"
  | "qwen"
  | "volcengine"
  | "baidu"
  | "azure"
  | "cloud";

export type CreateGenerateSpeechToolOptions = {
  provider?: GenerateSpeechProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  voice?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export type GenerateSpeechInput = {
  text: string;
  voice?: string;
  output_path?: string;
  format?: "mp3" | "wav";
};

export type GenerateSpeechOutput = {
  provider: GenerateSpeechProvider;
  model: string;
  outputPath: string;
  relativePath: string;
  bytes: number;
  mimeType: string;
};

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_VOICE = "longanyang";

export function createGenerateSpeechTool(
  options: CreateGenerateSpeechToolOptions = {},
): PilotDeckToolDefinition<GenerateSpeechInput, GenerateSpeechOutput> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return {
    name: "generate_speech",
    aliases: ["GenerateSpeech"],
    description:
      "Synthesize speech audio (MP3/WAV) from text. Uses configured TTS provider (default: DashScope CosyVoice).",
    kind: "network",
    inputSchema: {
      type: "object",
      required: ["text"],
      additionalProperties: false,
      properties: {
        text: { type: "string", description: "Text to speak." },
        voice: { type: "string", description: "Voice id, e.g. longanyang for CosyVoice." },
        output_path: { type: "string", description: "Optional workspace output path." },
        format: { type: "string", enum: ["mp3", "wav"], description: "Audio format." },
      },
    },
    isReadOnly: () => false,
    isConcurrencySafe: () => true,
    isOpenWorld: () => true,
    checkPermissions: async (): Promise<PermissionResult> => ({
      type: "ask",
      reason: {
        type: "tool",
        toolName: "generate_speech",
        message: "Speech synthesis requires network access and file writes.",
      },
      request: {
        toolCallId: "",
        toolName: "generate_speech",
        inputSummary: "generate speech",
        reason: {
          type: "tool",
          toolName: "generate_speech",
          message: "Speech synthesis requires network access and file writes.",
        },
        options: [
          { id: "allow_once", label: "Allow speech synthesis" },
          { id: "deny", label: "Deny" },
        ],
      },
    }),
    execute: async (input, context) => {
      const text = input.text.trim();
      if (!text) {
        throw new PilotDeckToolRuntimeError("invalid_tool_input", "generate_speech requires non-empty text.");
      }
      const provider = resolveProvider(options.provider, context);
      const apiKey = resolveApiKey(options.apiKey, provider, context);
      const baseUrl = resolveBaseUrl(options.baseUrl, provider, context);
      const model = resolveModel(options.model, provider, context);
      const voice = input.voice?.trim() || options.voice?.trim() || DEFAULT_VOICE;
      const format = input.format ?? "mp3";
      if (!apiKey) {
        throw new PilotDeckToolRuntimeError(
          "unsupported_tool",
          "generate_speech is not configured. Set tools.tts.apiKey or DASHSCOPE_API_KEY.",
        );
      }

      const audioBuffer = await requestSpeech({
        provider,
        apiKey,
        baseUrl,
        model,
        text,
        voice,
        format,
        timeoutMs,
        fetchImpl,
        context,
      });

      const ext = format === "wav" ? "wav" : "mp3";
      const mimeType = format === "wav" ? "audio/wav" : "audio/mpeg";
      const outputPath = input.output_path?.trim() || `artifacts/media/speech-${Date.now()}.${ext}`;
      const resolved = resolvePilotDeckWorkspacePath(outputPath, context, { forWrite: true });
      if (!resolved.ok) {
        throw new PilotDeckToolRuntimeError(resolved.error.code, resolved.error.message, resolved.error.details);
      }
      await mkdir(path.dirname(resolved.absolutePath), { recursive: true });
      await writeFile(resolved.absolutePath, audioBuffer);
      const relative = toWorkspaceRelativePath(resolved.absolutePath, resolved.root).split(path.sep).join("/");
      return {
        content: [
          { type: "text", text: `Speech audio saved to ${relative}.` },
          { type: "file", path: resolved.absolutePath, mimeType, description: "Generated speech audio" },
        ],
        data: {
          provider,
          model,
          outputPath: resolved.absolutePath,
          relativePath: relative,
          bytes: audioBuffer.length,
          mimeType,
        },
      };
    },
  };
}

function resolveProvider(
  input: GenerateSpeechProvider | undefined,
  context: PilotDeckToolRuntimeContext,
): GenerateSpeechProvider {
  if (input) return input;
  return (readEnv(context, "PILOTDECK_TTS_PROVIDER") as GenerateSpeechProvider | undefined) ?? "qwen";
}

function resolveApiKey(
  input: string | undefined,
  provider: GenerateSpeechProvider,
  context: PilotDeckToolRuntimeContext,
): string | undefined {
  const fromOption = input?.trim();
  if (fromOption) return fromOption;
  if (provider === "qwen") return readEnv(context, "DASHSCOPE_API_KEY") ?? readEnv(context, "PILOTDECK_TTS_API_KEY");
  return readEnv(context, "PILOTDECK_TTS_API_KEY") ?? readEnv(context, "OPENAI_API_KEY");
}

function resolveBaseUrl(
  input: string | undefined,
  provider: GenerateSpeechProvider,
  context: PilotDeckToolRuntimeContext,
): string {
  const fromOption = input?.trim();
  if (fromOption) return fromOption.replace(/\/+$/, "");
  if (provider === "qwen") {
    return readEnv(context, "PILOTDECK_TTS_BASE_URL")
      ?? "https://dashscope.aliyuncs.com/compatible-mode/v1";
  }
  return readEnv(context, "PILOTDECK_TTS_BASE_URL")
    ?? readEnv(context, "OPENAI_BASE_URL")
    ?? "https://api.openai.com/v1";
}

function resolveModel(
  input: string | undefined,
  provider: GenerateSpeechProvider,
  context: PilotDeckToolRuntimeContext,
): string {
  const fromOption = input?.trim();
  if (fromOption) return fromOption;
  if (provider === "qwen") return readEnv(context, "PILOTDECK_TTS_MODEL") ?? "cosyvoice-v3-flash";
  return readEnv(context, "PILOTDECK_TTS_MODEL") ?? "tts-1";
}

type RequestSpeechArgs = {
  provider: GenerateSpeechProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  text: string;
  voice: string;
  format: "mp3" | "wav";
  timeoutMs: number;
  fetchImpl: typeof fetch;
  context: PilotDeckToolRuntimeContext;
};

async function requestSpeech(args: RequestSpeechArgs): Promise<Buffer> {
  if (args.provider === "qwen" && !args.baseUrl.includes("compatible-mode")) {
    return requestDashScopeCosyVoice(args);
  }
  if (args.provider === "qwen") {
    const native = dashScopeApiV1Root(args.baseUrl);
    if (native.includes("dashscope.aliyuncs.com/api/v1")) {
      return requestDashScopeCosyVoice({ ...args, baseUrl: native });
    }
  }
  return requestOpenAiCompatibleSpeech(args);
}

async function requestDashScopeCosyVoice(args: RequestSpeechArgs): Promise<Buffer> {
  const root = dashScopeApiV1Root(args.baseUrl);
  const url = `${root}/services/aigc/text2speech/synthesis`;
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
      input: { text: args.text },
      parameters: {
        voice: args.voice,
        format: args.format,
        sample_rate: 22050,
      },
    }),
    timeoutMs: Math.min(args.timeoutMs, 90_000),
    context: args.context,
    label: "generate_speech_cosyvoice",
  });
  assertDashScopeOk(raw, "generate_speech");
  const audioUrl = readString(raw?.output?.audio_url);
  const b64 = readString(raw?.output?.audio) ?? readString(raw?.output?.audio_data);
  if (b64) return Buffer.from(b64, "base64");
  if (audioUrl) {
    return performBinaryDownload(args.fetchImpl, audioUrl, args.timeoutMs, args.context, "generate_speech_fetch");
  }
  throw new PilotDeckToolRuntimeError("tool_execution_failed", "CosyVoice returned no audio payload.");
}

async function requestOpenAiCompatibleSpeech(args: RequestSpeechArgs): Promise<Buffer> {
  const url = `${args.baseUrl.replace(/\/+$/, "")}/audio/speech`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);
  try {
    const response = await args.fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: args.model,
        input: args.text,
        voice: args.voice,
        response_format: args.format,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new PilotDeckToolRuntimeError(
        "tool_execution_failed",
        `generate_speech failed: ${response.status} ${detail.slice(0, 200)}`,
      );
    }
    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }
}

function dashScopeApiV1Root(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.includes("/compatible-mode/")) {
    return "https://dashscope.aliyuncs.com/api/v1";
  }
  if (trimmed.endsWith("/api/v1")) return trimmed;
  return "https://dashscope.aliyuncs.com/api/v1";
}

function assertDashScopeOk(raw: any, label: string): void {
  const code = raw?.code ?? raw?.status_code;
  if (code && String(code) !== "200" && String(code) !== "Success") {
    const msg = readString(raw?.message) ?? readString(raw?.output?.message) ?? String(code);
    throw new PilotDeckToolRuntimeError("tool_execution_failed", `${label}: ${msg}`);
  }
}

async function performJsonRequest(
  fetchImpl: typeof fetch,
  args: {
    url: string;
    method: "GET" | "POST";
    headers: Record<string, string>;
    body?: string;
    timeoutMs: number;
    context: PilotDeckToolRuntimeContext;
    label: string;
  },
): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);
  try {
    const response = await fetchImpl(args.url, {
      method: args.method,
      headers: args.headers,
      ...(args.body ? { body: args.body } : {}),
      signal: controller.signal,
    });
    const text = await response.text();
    const raw = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const detail = readString(raw?.message) ?? readString(raw?.error?.message) ?? text.slice(0, 200);
      throw new PilotDeckToolRuntimeError("tool_execution_failed", `${args.label} failed: ${detail}`);
    }
    return raw;
  } finally {
    clearTimeout(timeout);
  }
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
  try {
    const response = await fetchImpl(url, { method: "GET", signal: controller.signal });
    if (!response.ok) {
      throw new PilotDeckToolRuntimeError("tool_execution_failed", `${label}: ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }
}

function readEnv(context: PilotDeckToolRuntimeContext, name: string): string | undefined {
  const value = (context.env ?? process.env)[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}
