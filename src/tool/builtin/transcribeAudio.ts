import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PermissionResult } from "../../permission/index.js";
import { PilotDeckToolRuntimeError } from "../protocol/errors.js";
import type {
  PilotDeckToolDefinition,
  PilotDeckToolRuntimeContext,
} from "../protocol/types.js";
import { resolvePilotDeckWorkspacePath, toWorkspaceRelativePath } from "./filesystem/pathSafety.js";

export type TranscribeAudioProvider =
  | "openai-compatible"
  | "google"
  | "qwen"
  | "volcengine"
  | "baidu"
  | "azure"
  | "cloud";

export type CreateTranscribeAudioToolOptions = {
  provider?: TranscribeAudioProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export type TranscribeAudioInput = {
  audio_path: string;
  language?: string;
  output_path?: string;
};

export type TranscribeAudioOutput = {
  provider: TranscribeAudioProvider;
  model: string;
  text: string;
  outputPath?: string;
  relativePath?: string;
};

const DEFAULT_TIMEOUT_MS = 300_000;

export function createTranscribeAudioTool(
  options: CreateTranscribeAudioToolOptions = {},
): PilotDeckToolDefinition<TranscribeAudioInput, TranscribeAudioOutput> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return {
    name: "transcribe_audio",
    aliases: ["TranscribeAudio"],
    description:
      "Transcribe speech from a local audio file to text (ASR). Uses configured speech provider (default: DashScope Fun-ASR).",
    kind: "network",
    inputSchema: {
      type: "object",
      required: ["audio_path"],
      additionalProperties: false,
      properties: {
        audio_path: { type: "string", description: "Workspace path to audio file (mp3/wav/m4a)." },
        language: { type: "string", description: "Optional BCP-47 language hint, e.g. zh or en." },
        output_path: { type: "string", description: "Optional path to save transcript text." },
      },
    },
    isReadOnly: () => false,
    isConcurrencySafe: () => true,
    isOpenWorld: () => true,
    checkPermissions: async (): Promise<PermissionResult> => ({
      type: "ask",
      reason: {
        type: "tool",
        toolName: "transcribe_audio",
        message: "Audio transcription requires network access and file reads.",
      },
      request: {
        toolCallId: "",
        toolName: "transcribe_audio",
        inputSummary: "transcribe audio",
        reason: {
          type: "tool",
          toolName: "transcribe_audio",
          message: "Audio transcription requires network access and file reads.",
        },
        options: [
          { id: "allow_once", label: "Allow transcription" },
          { id: "deny", label: "Deny" },
        ],
      },
    }),
    execute: async (input, context) => {
      const audioPath = input.audio_path.trim();
      if (!audioPath) {
        throw new PilotDeckToolRuntimeError("invalid_tool_input", "transcribe_audio requires audio_path.");
      }
      const resolved = resolvePilotDeckWorkspacePath(audioPath, context, { forWrite: false });
      if (!resolved.ok) {
        throw new PilotDeckToolRuntimeError(resolved.error.code, resolved.error.message, resolved.error.details);
      }
      const fileBuffer = await readFile(resolved.absolutePath);
      const provider = resolveProvider(options.provider, context);
      const apiKey = resolveApiKey(options.apiKey, provider, context);
      const baseUrl = resolveBaseUrl(options.baseUrl, provider, context);
      const model = resolveModel(options.model, provider, context);
      if (!apiKey) {
        throw new PilotDeckToolRuntimeError(
          "unsupported_tool",
          "transcribe_audio is not configured. Set tools.speech.apiKey or DASHSCOPE_API_KEY.",
        );
      }

      const text = await requestTranscription({
        provider,
        apiKey,
        baseUrl,
        model,
        fileBuffer,
        fileName: path.basename(resolved.absolutePath),
        language: input.language,
        timeoutMs,
        fetchImpl,
        context,
      });

      let outputPath: string | undefined;
      let relativePath: string | undefined;
      if (input.output_path?.trim()) {
        const outResolved = resolvePilotDeckWorkspacePath(input.output_path.trim(), context, { forWrite: true });
        if (!outResolved.ok) {
          throw new PilotDeckToolRuntimeError(outResolved.error.code, outResolved.error.message, outResolved.error.details);
        }
        const { writeFile, mkdir } = await import("node:fs/promises");
        await mkdir(path.dirname(outResolved.absolutePath), { recursive: true });
        await writeFile(outResolved.absolutePath, text, "utf8");
        outputPath = outResolved.absolutePath;
        relativePath = toWorkspaceRelativePath(outResolved.absolutePath, outResolved.root).split(path.sep).join("/");
      }

      const preview = text.length > 500 ? `${text.slice(0, 500)}…` : text;
      return {
        content: [
          { type: "text", text: relativePath ? `Transcript saved to ${relativePath}.\n\n${preview}` : preview },
        ],
        data: {
          provider,
          model,
          text,
          ...(outputPath ? { outputPath, relativePath } : {}),
        },
      };
    },
  };
}

function resolveProvider(
  input: TranscribeAudioProvider | undefined,
  context: PilotDeckToolRuntimeContext,
): TranscribeAudioProvider {
  if (input) return input;
  return (readEnv(context, "PILOTDECK_SPEECH_PROVIDER") as TranscribeAudioProvider | undefined) ?? "qwen";
}

function resolveApiKey(
  input: string | undefined,
  provider: TranscribeAudioProvider,
  context: PilotDeckToolRuntimeContext,
): string | undefined {
  const fromOption = input?.trim();
  if (fromOption) return fromOption;
  if (provider === "qwen") {
    return readEnv(context, "DASHSCOPE_API_KEY") ?? readEnv(context, "PILOTDECK_SPEECH_API_KEY");
  }
  return readEnv(context, "PILOTDECK_SPEECH_API_KEY") ?? readEnv(context, "OPENAI_API_KEY");
}

function resolveBaseUrl(
  input: string | undefined,
  provider: TranscribeAudioProvider,
  context: PilotDeckToolRuntimeContext,
): string {
  const fromOption = input?.trim();
  if (fromOption) return fromOption.replace(/\/+$/, "");
  if (provider === "qwen") {
    return readEnv(context, "PILOTDECK_SPEECH_BASE_URL")
      ?? "https://dashscope.aliyuncs.com/compatible-mode/v1";
  }
  return readEnv(context, "PILOTDECK_SPEECH_BASE_URL")
    ?? readEnv(context, "OPENAI_BASE_URL")
    ?? "https://api.openai.com/v1";
}

function resolveModel(
  input: string | undefined,
  provider: TranscribeAudioProvider,
  context: PilotDeckToolRuntimeContext,
): string {
  const fromOption = input?.trim();
  if (fromOption) return fromOption;
  if (provider === "qwen") return readEnv(context, "PILOTDECK_SPEECH_MODEL") ?? "fun-asr";
  return readEnv(context, "PILOTDECK_SPEECH_MODEL") ?? "whisper-1";
}

type RequestTranscriptionArgs = {
  provider: TranscribeAudioProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  fileBuffer: Buffer;
  fileName: string;
  language?: string;
  timeoutMs: number;
  fetchImpl: typeof fetch;
  context: PilotDeckToolRuntimeContext;
};

async function requestTranscription(args: RequestTranscriptionArgs): Promise<string> {
  if (args.provider === "qwen") {
    try {
      return await requestOpenAiCompatibleTranscription(args);
    } catch {
      return requestDashScopeFunAsr(args);
    }
  }
  return requestOpenAiCompatibleTranscription(args);
}

async function requestOpenAiCompatibleTranscription(args: RequestTranscriptionArgs): Promise<string> {
  const url = `${args.baseUrl.replace(/\/+$/, "")}/audio/transcriptions`;
  const form = new FormData();
  const blob = new Blob([new Uint8Array(args.fileBuffer)], { type: guessMime(args.fileName) });
  form.append("file", blob, args.fileName);
  form.append("model", args.model);
  if (args.language?.trim()) form.append("language", args.language.trim());

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);
  try {
    const response = await args.fetchImpl(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${args.apiKey}` },
      body: form,
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new PilotDeckToolRuntimeError(
        "tool_execution_failed",
        `transcribe_audio failed: ${response.status} ${text.slice(0, 200)}`,
      );
    }
    const raw = JSON.parse(text);
    const transcript = readString(raw?.text) ?? readString(raw?.transcript);
    if (!transcript) {
      throw new PilotDeckToolRuntimeError("tool_execution_failed", "transcribe_audio returned empty text.");
    }
    return transcript;
  } finally {
    clearTimeout(timeout);
  }
}

async function requestDashScopeFunAsr(args: RequestTranscriptionArgs): Promise<string> {
  const root = "https://dashscope.aliyuncs.com/api/v1";
  const createUrl = `${root}/services/audio/asr/transcription`;
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
      input: {
        file: args.fileBuffer.toString("base64"),
        format: path.extname(args.fileName).replace(/^\./, "") || "mp3",
      },
      parameters: args.language ? { language_hints: [args.language] } : {},
    }),
    timeoutMs: Math.min(args.timeoutMs, 60_000),
    context: args.context,
    label: "transcribe_audio_create",
  });
  const taskId = readString(created?.output?.task_id) ?? readString(created?.task_id);
  if (!taskId) {
    const inline = readString(created?.output?.text) ?? readString(created?.output?.transcription);
    if (inline) return inline;
    throw new PilotDeckToolRuntimeError("tool_execution_failed", "Fun-ASR returned no task_id.");
  }

  const deadline = Date.now() + args.timeoutMs;
  while (Date.now() < deadline) {
    await sleep(2_000, args.context.abortSignal);
    const status = await performJsonRequest(args.fetchImpl, {
      url: `${root}/tasks/${encodeURIComponent(taskId)}`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        Accept: "application/json",
      },
      timeoutMs: 30_000,
      context: args.context,
      label: "transcribe_audio_poll",
    });
    const taskStatus = readString(status?.output?.task_status)?.toUpperCase();
    if (taskStatus === "FAILED") {
      throw new PilotDeckToolRuntimeError(
        "tool_execution_failed",
        readString(status?.output?.message) ?? "Fun-ASR task failed",
      );
    }
    if (taskStatus === "SUCCEEDED") {
      const text =
        readString(status?.output?.text)
        ?? readString(status?.output?.transcription)
        ?? readString(status?.output?.results?.[0]?.text);
      if (text) return text;
      throw new PilotDeckToolRuntimeError("tool_execution_failed", "Fun-ASR succeeded but returned no text.");
    }
  }
  throw new PilotDeckToolRuntimeError("tool_timeout", "transcribe_audio timed out.");
}

function guessMime(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".wav") return "audio/wav";
  if (ext === ".m4a") return "audio/mp4";
  if (ext === ".ogg") return "audio/ogg";
  return "audio/mpeg";
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
    let raw: any = {};
    try {
      raw = text ? JSON.parse(text) : {};
    } catch {
      raw = { message: text };
    }
    if (!response.ok) {
      const detail = readString(raw?.message) ?? text.slice(0, 200);
      throw new PilotDeckToolRuntimeError("tool_execution_failed", `${args.label}: ${detail}`);
    }
    return raw;
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

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) return new Promise((resolve) => setTimeout(resolve, ms));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new PilotDeckToolRuntimeError("tool_execution_failed", "transcribe_audio aborted."));
    };
    signal.addEventListener("abort", onAbort);
  });
}
