/**
 * PD-SAAS-FORK: Shrink HTTP history API payloads without touching JSONL storage.
 * Applied only at `GET /api/sessions/:id/messages` after NormalizedMessage mapping.
 */

import { isHistorySanitizeEnabled } from "./historyReadFlags.js";

export { isHistorySanitizeEnabled };

export type NormalizedHistoryMessage = Record<string, unknown> & {
  kind?: string;
  historyTruncated?: boolean;
  writtenFilePath?: string;
};

const DEFAULT_TOOL_TEXT_PREVIEW = 12_288;
const DEFAULT_TOOL_INPUT_PREVIEW = 4_096;
const DEFAULT_USER_ASSISTANT_PREVIEW = 32_768;

const PATH_INPUT_KEYS = new Set([
  "file_path",
  "filePath",
  "output_path",
  "outputPath",
  "html_path",
  "htmlPath",
  "path",
  "relativePath",
  "planFilePath",
]);

const TRUNCATABLE_INPUT_KEYS = new Set([
  "content",
  "html",
  "file_content",
  "fileContent",
  "body",
  "markdown",
  "text",
  "source",
  "data",
]);

const TRUNCATION_SUFFIX = "\n\n[…正文过长，已从历史加载中省略；完整内容见任务文件夹]";

function readIntEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getHistoryToolTextPreview(): number {
  return readIntEnv("PILOTDECK_HISTORY_TOOL_TEXT_PREVIEW", DEFAULT_TOOL_TEXT_PREVIEW);
}

export function getHistoryToolInputPreview(): number {
  return readIntEnv("PILOTDECK_HISTORY_TOOL_INPUT_PREVIEW", DEFAULT_TOOL_INPUT_PREVIEW);
}

export function getHistoryUserAssistantTextPreview(): number {
  return readIntEnv("PILOTDECK_HISTORY_USER_ASSISTANT_PREVIEW", DEFAULT_USER_ASSISTANT_PREVIEW);
}

function truncateText(text: string, maxLen: number): { text: string; truncated: boolean } {
  if (text.length <= maxLen) return { text, truncated: false };
  return {
    text: `${text.slice(0, maxLen)}${TRUNCATION_SUFFIX}`,
    truncated: true,
  };
}

function extractPathFromText(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      const direct =
        record.writtenFilePath
        ?? record.filePath
        ?? record.file_path
        ?? record.outputPath
        ?? record.output_path;
      if (typeof direct === "string" && direct.trim()) {
        return direct.trim();
      }
      const data = record.data;
      if (data && typeof data === "object") {
        const dataRecord = data as Record<string, unknown>;
        const nested = dataRecord.filePath ?? dataRecord.file_path ?? dataRecord.relativePath;
        if (typeof nested === "string" && nested.trim()) {
          return nested.trim();
        }
      }
    }
  } catch {
    // not JSON — fall through to regex
  }

  const artifactMatch = trimmed.match(/(?:artifacts|drafts|general\/artifacts)\/[^\s"'<>|]+/i);
  if (artifactMatch?.[0]) return artifactMatch[0];

  return undefined;
}

function extractWrittenFilePath(message: NormalizedHistoryMessage): string | undefined {
  if (typeof message.writtenFilePath === "string" && message.writtenFilePath.trim()) {
    return message.writtenFilePath.trim();
  }

  const content = typeof message.content === "string" ? message.content : "";
  const fromContent = extractPathFromText(content);
  if (fromContent) return fromContent;

  const toolResult = message.toolResult;
  if (toolResult && typeof toolResult === "object") {
    const record = toolResult as Record<string, unknown>;
    if (typeof record.writtenFilePath === "string" && record.writtenFilePath.trim()) {
      return record.writtenFilePath.trim();
    }
    if (typeof record.content === "string") {
      const fromToolContent = extractPathFromText(record.content);
      if (fromToolContent) return fromToolContent;
    }
  }

  const toolInput = message.toolInput;
  if (toolInput && typeof toolInput === "object") {
    const record = toolInput as Record<string, unknown>;
    for (const key of PATH_INPUT_KEYS) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  } else if (typeof toolInput === "string" && toolInput.trim()) {
    try {
      const parsed = JSON.parse(toolInput) as Record<string, unknown>;
      for (const key of PATH_INPUT_KEYS) {
        const value = parsed[key];
        if (typeof value === "string" && value.trim()) return value.trim();
      }
    } catch {
      // ignore
    }
  }

  return undefined;
}

function sanitizeToolInput(input: unknown): { value: unknown; truncated: boolean } {
  if (input == null) return { value: input, truncated: false };
  const maxLen = getHistoryToolInputPreview();

  if (typeof input === "string") {
    const { text, truncated } = truncateText(input, maxLen);
    return { value: text, truncated };
  }

  if (typeof input !== "object" || Array.isArray(input)) {
    return { value: input, truncated: false };
  }

  let truncated = false;
  const record = { ...(input as Record<string, unknown>) };
  for (const [key, value] of Object.entries(record)) {
    if (PATH_INPUT_KEYS.has(key)) continue;
    if (typeof value === "string" && TRUNCATABLE_INPUT_KEYS.has(key)) {
      const result = truncateText(value, maxLen);
      record[key] = result.text;
      truncated ||= result.truncated;
    } else if (typeof value === "string" && value.length > maxLen && !PATH_INPUT_KEYS.has(key)) {
      const result = truncateText(value, maxLen);
      record[key] = result.text;
      truncated ||= result.truncated;
    }
  }
  return { value: record, truncated };
}

function sanitizeToolResultBlock(message: NormalizedHistoryMessage): NormalizedHistoryMessage {
  const maxLen = getHistoryToolTextPreview();
  let truncated = false;
  const writtenFilePath = extractWrittenFilePath(message);
  const next: NormalizedHistoryMessage = { ...message };

  delete next.toolResultImages;
  if (writtenFilePath && /\.(png|jpe?g|webp|gif)$/i.test(writtenFilePath)) {
    next.artifactPath = writtenFilePath;
    next.artifactMime = /\.png$/i.test(writtenFilePath) ? 'image/png' : undefined;
  } else {
    delete next.images;
  }

  if (typeof next.content === "string") {
    const result = truncateText(next.content, maxLen);
    next.content = result.text;
    truncated ||= result.truncated;
  }

  if (next.toolResult && typeof next.toolResult === "object") {
    const toolResult = { ...(next.toolResult as Record<string, unknown>) };
    if (typeof toolResult.content === "string") {
      const result = truncateText(toolResult.content, maxLen);
      toolResult.content = result.text;
      truncated ||= result.truncated;
    }
    if (writtenFilePath) {
      toolResult.writtenFilePath = writtenFilePath;
    }
    next.toolResult = toolResult;
  } else if (writtenFilePath) {
    next.toolResult = {
      content: typeof next.content === "string" ? next.content : "",
      isError: Boolean(next.isError),
      writtenFilePath,
    };
  }

  if (writtenFilePath) {
    next.writtenFilePath = writtenFilePath;
  }

  if (truncated) next.historyTruncated = true;
  return next;
}

function sanitizeTextLike(message: NormalizedHistoryMessage): NormalizedHistoryMessage {
  const maxLen = getHistoryUserAssistantTextPreview();
  let truncated = false;
  const next: NormalizedHistoryMessage = { ...message };

  delete next.images;

  if (typeof next.content === "string") {
    const result = truncateText(next.content, maxLen);
    next.content = result.text;
    truncated ||= result.truncated;
  }
  if (typeof next.text === "string") {
    const result = truncateText(next.text, maxLen);
    next.text = result.text;
    truncated ||= result.truncated;
  }

  if (truncated) next.historyTruncated = true;
  return next;
}

export function sanitizeNormalizedHistoryMessage(message: NormalizedHistoryMessage): NormalizedHistoryMessage {
  const kind = message.kind;
  switch (kind) {
    case "tool_result":
    case "tool_result_reference":
      return sanitizeToolResultBlock(message);
    case "tool_use": {
      const { value, truncated } = sanitizeToolInput(message.toolInput);
      return truncated
        ? { ...message, toolInput: value, historyTruncated: true }
        : { ...message, toolInput: value };
    }
    case "text":
    case "thinking":
      return sanitizeTextLike(message);
    case "permission_request":
      return message;
    default:
      return message;
  }
}

export function sanitizeTurnDeliverableMeta(meta: unknown): unknown {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return meta;
  const slim: Record<string, unknown> = {};
  for (const [turnId, value] of Object.entries(meta as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      slim[turnId] = value;
      continue;
    }
    const record = value as Record<string, unknown>;
    slim[turnId] = {
      ...(typeof record.turnArtifactDir === "string" ? { turnArtifactDir: record.turnArtifactDir } : {}),
      ...(Array.isArray(record.verifiedPaths)
        ? { verifiedPaths: record.verifiedPaths.filter((p) => typeof p === "string").slice(0, 32) }
        : {}),
      ...(typeof record.alignmentStatus === "string" ? { alignmentStatus: record.alignmentStatus } : {}),
    };
  }
  return slim;
}

export function sanitizeHistoryMessages(messages: NormalizedHistoryMessage[]): NormalizedHistoryMessage[] {
  return messages.map(sanitizeNormalizedHistoryMessage);
}

export function estimateSanitizedPayloadBytes(messages: NormalizedHistoryMessage[]): number {
  return Buffer.byteLength(JSON.stringify(messages), "utf8");
}
