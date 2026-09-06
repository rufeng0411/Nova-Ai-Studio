// PD-SAAS-FORK: cross-process JSONL append lock shared by Bridge and core writers.
import { randomUUID } from "node:crypto";
import {
  appendFile,
  mkdir,
  open,
  readFile,
  stat,
  unlink,
  type FileHandle,
} from "node:fs/promises";
import { dirname } from "node:path";
import type { AgentTranscriptEntry } from "./TranscriptEntry.js";
import { readTranscriptTailEntries } from "./TranscriptReader.js";

export type TranscriptAppendState = {
  maxSequence: number;
  lastEntryId: string | null;
  nextSequence: number;
};

export type TranscriptFileLockOptions = {
  maxWaitMs?: number;
  retryDelayMs?: number;
  staleAfterMs?: number;
  now?: () => number;
};

const DEFAULT_MAX_WAIT_MS = 2_000;
const DEFAULT_RETRY_DELAY_MS = 20;
const DEFAULT_STALE_AFTER_MS = 30_000;

export async function appendTranscriptEntryLocked<T extends AgentTranscriptEntry>(
  transcriptPath: string,
  createEntry: (state: TranscriptAppendState) => T,
  lockOptions?: TranscriptFileLockOptions,
): Promise<T> {
  const [entry] = await appendTranscriptEntriesLocked(
    transcriptPath,
    (state) => [createEntry(state)],
    lockOptions,
  );
  if (!entry) throw new Error("transcript append produced no entry");
  return entry;
}

export async function appendTranscriptEntriesLocked<T extends AgentTranscriptEntry>(
  transcriptPath: string,
  createEntries: (state: TranscriptAppendState) => readonly T[],
  lockOptions?: TranscriptFileLockOptions,
): Promise<T[]> {
  return withTranscriptFileLock(transcriptPath, async () => {
    const state = await readTranscriptAppendState(transcriptPath);
    const requested = createEntries(state);
    let parentEntryId = state.lastEntryId;
    const entries = requested.map((entry, index) => {
      const normalized = {
        ...entry,
        sequence: state.nextSequence + index,
        parentEntryId,
      } as T;
      parentEntryId = normalized.entryId ?? parentEntryId;
      return normalized;
    });
    if (entries.length > 0) {
      const lines = entries.map((entry) => `${JSON.stringify(entry)}\n`).join("");
      await appendFile(transcriptPath, lines, { encoding: "utf8", mode: 0o600 });
    }
    return entries;
  }, lockOptions);
}

export async function withTranscriptFileLock<T>(
  transcriptPath: string,
  operation: () => Promise<T>,
  options: TranscriptFileLockOptions = {},
): Promise<T> {
  const lockPath = `${transcriptPath}.lock`;
  const now = options.now ?? Date.now;
  const maxWaitMs = positiveOrDefault(options.maxWaitMs, DEFAULT_MAX_WAIT_MS);
  const retryDelayMs = positiveOrDefault(options.retryDelayMs, DEFAULT_RETRY_DELAY_MS);
  const staleAfterMs = positiveOrDefault(options.staleAfterMs, DEFAULT_STALE_AFTER_MS);
  const startedAt = now();
  const token = `${process.pid}:${randomUUID()}`;
  await mkdir(dirname(transcriptPath), { recursive: true, mode: 0o700 });

  let handle: FileHandle | undefined;
  while (!handle) {
    let acquiredHandle: FileHandle | undefined;
    try {
      acquiredHandle = await open(lockPath, "wx", 0o600);
      await acquiredHandle.writeFile(
        JSON.stringify({ token, pid: process.pid, createdAt: now() }),
        "utf8",
      );
      handle = acquiredHandle;
    } catch (error) {
      if (acquiredHandle) {
        await acquiredHandle.close().catch(() => {});
        await unlink(lockPath).catch(() => {});
        throw error;
      }
      if (!isCode(error, "EEXIST")) throw error;
      if (await removeStaleLock(lockPath, now(), staleAfterMs)) continue;
      if (now() - startedAt >= maxWaitMs) {
        throw new Error(`transcript lock timeout: ${lockPath}`);
      }
      await delay(Math.min(retryDelayMs, Math.max(1, maxWaitMs - (now() - startedAt))));
    }
  }

  try {
    return await operation();
  } finally {
    await handle.close().catch(() => {});
    await releaseOwnedLock(lockPath, token);
  }
}

export async function readTranscriptAppendState(
  transcriptPath: string,
): Promise<TranscriptAppendState> {
  const result = await readTranscriptTailEntries(transcriptPath, {
    maxBytesFromEnd: 1024 * 1024,
    maxEntries: 128,
  });
  const parseFailure = result.diagnostics.find((diagnostic) => diagnostic.severity === "error");
  if (parseFailure) {
    throw new Error(`transcript parse failed: ${parseFailure.message}`);
  }
  if (result.fileSize > 0 && result.entries.length === 0) {
    throw new Error("transcript parse failed: non-empty transcript has no valid entries");
  }
  const last = result.entries.at(-1);
  const maxSequence = last?.sequence ?? 0;
  if (!Number.isSafeInteger(maxSequence) || maxSequence < 0) {
    throw new Error("transcript sequence is invalid");
  }
  return {
    maxSequence,
    lastEntryId: last?.entryId ?? null,
    nextSequence: maxSequence + 1,
  };
}

async function removeStaleLock(
  lockPath: string,
  now: number,
  staleAfterMs: number,
): Promise<boolean> {
  try {
    const lockStat = await stat(lockPath);
    if (now - lockStat.mtimeMs <= staleAfterMs) return false;
    await unlink(lockPath);
    return true;
  } catch (error) {
    if (isCode(error, "ENOENT")) return true;
    return false;
  }
}

async function releaseOwnedLock(lockPath: string, token: string): Promise<void> {
  try {
    const content = await readFile(lockPath, "utf8");
    const parsed = JSON.parse(content) as { token?: unknown };
    if (parsed.token !== token) return;
    await unlink(lockPath);
  } catch (error) {
    if (isCode(error, "ENOENT")) return;
  }
}

function positiveOrDefault(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function isCode(error: unknown, code: string): boolean {
  return Boolean(
    error
    && typeof error === "object"
    && "code" in error
    && (error as { code?: unknown }).code === code,
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
