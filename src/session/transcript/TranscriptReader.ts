import { open, readFile, stat } from "node:fs/promises";
import type { AgentTranscriptDiagnostic, AgentTranscriptEntry } from "./TranscriptEntry.js";

export const DEFAULT_MAX_TRANSCRIPT_READ_BYTES = 50 * 1024 * 1024;

export type AgentTranscriptReadResult = {
  entries: AgentTranscriptEntry[];
  diagnostics: AgentTranscriptDiagnostic[];
  /** True when only the tail of a larger transcript was loaded. */
  truncated?: boolean;
};

export type ReadTranscriptOptions = {
  maxBytes?: number;
};

export type ReadTranscriptTailOptions = {
  maxBytesFromEnd?: number;
  maxEntries?: number;
};

export type ReadTranscriptHeadOptions = {
  maxBytesFromStart?: number;
  maxEntries?: number;
};

export type AgentTranscriptTailReadResult = AgentTranscriptReadResult & {
  fileSize: number;
};

/** PD-SAAS-FORK: O(n) non-empty line count for tail-read total estimation. */
export async function countTranscriptLines(path: string): Promise<number> {
  let handle;
  try {
    handle = await open(path, "r");
  } catch (error) {
    if (isNotFoundError(error)) return 0;
    throw error;
  }

  try {
    const fileStat = await stat(path);
    const chunkSize = 256 * 1024;
    let offset = 0;
    let lineCount = 0;
    let inLine = false;

    while (offset < fileStat.size) {
      const readSize = Math.min(chunkSize, fileStat.size - offset);
      const buffer = Buffer.alloc(readSize);
      const { bytesRead } = await handle.read(buffer, 0, readSize, offset);
      if (bytesRead <= 0) break;
      const chunk = buffer.subarray(0, bytesRead).toString("utf8");
      for (let index = 0; index < chunk.length; index += 1) {
        const char = chunk[index];
        if (char === "\n") {
          if (inLine) lineCount += 1;
          inLine = false;
        } else if (char !== "\r") {
          inLine = true;
        }
      }
      offset += bytesRead;
    }

    if (inLine) lineCount += 1;
    return lineCount;
  } finally {
    await handle.close();
  }
}

/** PD-SAAS-FORK: Read only the tail bytes of a jsonl transcript (backward history paging). */
export async function readTranscriptTailEntries(
  path: string,
  options: ReadTranscriptTailOptions = {},
): Promise<AgentTranscriptTailReadResult> {
  const maxEntries = options.maxEntries ?? 2000;
  let maxBytes = options.maxBytesFromEnd ?? 4 * 1024 * 1024;

  let fileStat;
  try {
    fileStat = await stat(path);
  } catch (error) {
    if (isNotFoundError(error)) {
      return {
        entries: [],
        diagnostics: [
          {
            code: "transcript_missing",
            severity: "warning",
            message: `Transcript ${path} does not exist.`,
          },
        ],
        fileSize: 0,
      };
    }
    throw error;
  }

  if (fileStat.size === 0) {
    return { entries: [], diagnostics: [], fileSize: 0 };
  }

  let truncated = false;
  let content = "";
  while (true) {
    const readSize = Math.min(maxBytes, fileStat.size);
    content = await readFileTail(path, readSize, fileStat.size);
    truncated = readSize < fileStat.size;
    const parsed = parseTranscriptContent(content, truncated, maxBytes);
    if (parsed.entries.length >= maxEntries || !truncated || readSize >= fileStat.size) {
      const fullFileLoaded = readSize >= fileStat.size;
      const entryCountTruncated = parsed.entries.length > maxEntries;
      // PD-SAAS-FORK: When the entire file is in memory, never drop head entries via
      // maxEntries — that removed the first accepted_input on dense agent transcripts.
      const entries = entryCountTruncated && !fullFileLoaded
        ? parsed.entries.slice(-maxEntries)
        : parsed.entries;
      return {
        entries,
        diagnostics: parsed.diagnostics,
        truncated: truncated || (entryCountTruncated && !fullFileLoaded),
        fileSize: fileStat.size,
      };
    }
    maxBytes = Math.min(maxBytes * 2, fileStat.size);
  }
}

/** PD-SAAS-FORK: Read the head of a jsonl transcript (first user turn + early history). */
export async function readTranscriptHeadEntries(
  path: string,
  options: ReadTranscriptHeadOptions = {},
): Promise<AgentTranscriptTailReadResult> {
  const maxEntries = options.maxEntries ?? 200;
  const maxBytes = options.maxBytesFromStart ?? 512 * 1024;

  let fileStat;
  try {
    fileStat = await stat(path);
  } catch (error) {
    if (isNotFoundError(error)) {
      return {
        entries: [],
        diagnostics: [
          {
            code: "transcript_missing",
            severity: "warning",
            message: `Transcript ${path} does not exist.`,
          },
        ],
        fileSize: 0,
      };
    }
    throw error;
  }

  if (fileStat.size === 0) {
    return { entries: [], diagnostics: [], fileSize: 0 };
  }

  const readSize = Math.min(maxBytes, fileStat.size);
  const handle = await open(path, "r");
  try {
    const buffer = Buffer.alloc(readSize);
    const { bytesRead } = await handle.read(buffer, 0, readSize, 0);
    let text = buffer.subarray(0, bytesRead).toString("utf8");
    const byteTruncated = readSize < fileStat.size;
    if (byteTruncated) {
      const lastNewline = text.lastIndexOf("\n");
      if (lastNewline >= 0) {
        text = text.slice(0, lastNewline);
      }
    }
    const parsed = parseTranscriptContent(text, byteTruncated, maxBytes);
    const entryCountTruncated = parsed.entries.length > maxEntries;
    const entries = entryCountTruncated
      ? parsed.entries.slice(0, maxEntries)
      : parsed.entries;
    return {
      entries,
      diagnostics: parsed.diagnostics,
      truncated: byteTruncated || entryCountTruncated,
      fileSize: fileStat.size,
    };
  } finally {
    await handle.close();
  }
}

/** Merge transcript entries by entryId / sequence without duplicates. */
export function mergeTranscriptEntries(
  head: AgentTranscriptEntry[],
  tail: AgentTranscriptEntry[],
): AgentTranscriptEntry[] {
  const byKey = new Map<string, AgentTranscriptEntry>();
  for (const entry of [...head, ...tail]) {
    const key = entry.entryId ?? `${entry.sequence}:${entry.turnId}:${entry.type}`;
    byKey.set(key, entry);
  }
  return [...byKey.values()].sort((left, right) => {
    if (left.sequence !== right.sequence) return left.sequence - right.sequence;
    return left.createdAt.localeCompare(right.createdAt);
  });
}

function parseTranscriptContent(
  content: string,
  truncated: boolean,
  maxBytes: number,
): AgentTranscriptReadResult {
  const entries: AgentTranscriptEntry[] = [];
  const diagnostics: AgentTranscriptDiagnostic[] = [];
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as unknown;
      if (isTranscriptEntry(parsed)) {
        entries.push(parsed);
      } else {
        diagnostics.push({
          code: "transcript_entry_invalid",
          severity: "error",
          message: "Transcript entry has an invalid shape.",
          line: index + 1,
        });
      }
    } catch (error) {
      diagnostics.push({
        code: "transcript_line_invalid",
        severity: "error",
        message: error instanceof Error ? error.message : "Transcript line is not valid JSON.",
        line: index + 1,
      });
    }
  }

  entries.sort((left, right) => {
    if (left.sequence !== right.sequence) return left.sequence - right.sequence;
    return left.createdAt.localeCompare(right.createdAt);
  });

  if (truncated) {
    diagnostics.push({
      code: "transcript_truncated",
      severity: "warning",
      message: `Transcript exceeded ${maxBytes} bytes; loaded the most recent portion only.`,
    });
  }

  return { entries, diagnostics, truncated };
}

export async function readTranscript(path: string, options: ReadTranscriptOptions = {}): Promise<AgentTranscriptReadResult> {
  let content: string;
  let truncated = false;
  try {
    const fileStat = await stat(path);
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_TRANSCRIPT_READ_BYTES;
    if (fileStat.size > maxBytes) {
      content = await readFileTail(path, maxBytes, fileStat.size);
      truncated = true;
    } else {
      content = await readFile(path, "utf8");
    }
  } catch (error) {
    if (isNotFoundError(error)) {
      return {
        entries: [],
        diagnostics: [
          {
            code: "transcript_missing",
            severity: "warning",
            message: `Transcript ${path} does not exist.`,
          },
        ],
      };
    }
    throw error;
  }

  const parsed = parseTranscriptContent(content, truncated, options.maxBytes ?? DEFAULT_MAX_TRANSCRIPT_READ_BYTES);
  return parsed;
}

async function readFileTail(path: string, maxBytes: number, fileSize: number): Promise<string> {
  const readSize = Math.min(maxBytes, fileSize);
  const readOffset = fileSize - readSize;
  const handle = await open(path, "r");
  try {
    const buffer = Buffer.alloc(readSize);
    const { bytesRead } = await handle.read(buffer, 0, readSize, readOffset);
    let text = buffer.subarray(0, bytesRead).toString("utf8");
    // Only drop a partial first line when the read started mid-file.
    if (readOffset > 0) {
      const newline = text.indexOf("\n");
      if (newline >= 0) {
        text = text.slice(newline + 1);
      }
    }
    return text;
  } finally {
    await handle.close();
  }
}

function isTranscriptEntry(value: unknown): value is AgentTranscriptEntry {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.type === "string" &&
    typeof value.sessionId === "string" &&
    typeof value.turnId === "string" &&
    typeof value.sequence === "number" &&
    typeof value.createdAt === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNotFoundError(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}
