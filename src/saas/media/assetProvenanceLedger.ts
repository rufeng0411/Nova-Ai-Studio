// PD-SAAS-FORK P0-4: bounded, URL-redacted provenance for localized official media.

import { randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import type { OfficialMediaSourceTier } from "../constraints/officialMediaRequirement.js";
import type { OfficialSourceLevel } from "./officialSourceClassifier.js";
import { canonicalizeUrlForModel } from "../security/urlRedaction.js";

export const ASSET_PROVENANCE_LEDGER_MAX_ENTRIES = 32;
export const ASSET_PROVENANCE_LEDGER_MAX_BYTES = 8 * 1024;
export const ASSET_PROVENANCE_LEDGER_FILENAME =
  ".asset-provenance-ledger.json";

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const ledgerWriteQueues = new Map<string, Promise<void>>();

export type AssetProvenanceEntry = {
  candidateId: string;
  localPath: string;
  sha256: string;
  assetUrlHash: string;
  sourcePage: string;
  sourceLevel: OfficialSourceLevel;
  sourceTier?: OfficialMediaSourceTier;
  mimeType: string;
  width: number;
  height: number;
  bytes: number;
  fetchedAt: string;
};

export type AssetProvenanceLedgerSnapshot = {
  ledgerPath: string;
  entries: AssetProvenanceEntry[];
};

type StoredAssetProvenanceLedger = {
  version: 1;
  entries: AssetProvenanceEntry[];
};

function boundedText(
  value: unknown,
  maxChars: number,
  label: string,
): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new Error(`Asset provenance ${label} is required.`);
  }
  return normalized.slice(0, maxChars);
}

function boundedInteger(value: unknown, label: string): number {
  if (
    typeof value !== "number"
    || !Number.isSafeInteger(value)
    || value < 1
  ) {
    throw new Error(`Asset provenance ${label} must be a positive integer.`);
  }
  return value;
}

function normalizeHash(value: unknown, label: string): string {
  const normalized = boundedText(value, 64, label).toLowerCase();
  if (!SHA256_PATTERN.test(normalized)) {
    throw new Error(`Asset provenance ${label} must be a SHA-256 digest.`);
  }
  return normalized;
}

function normalizeEntry(
  entry: AssetProvenanceEntry,
): AssetProvenanceEntry {
  const sourceLevel: OfficialSourceLevel =
    entry.sourceLevel === "L0"
    || entry.sourceLevel === "L1"
    || entry.sourceLevel === "L2"
    || entry.sourceLevel === "L3"
      ? entry.sourceLevel
      : "L3";
  const sourceTier =
    entry.sourceTier === "brand_official"
    || entry.sourceTier === "authorized_partner_official"
    || entry.sourceTier === "platform_verified_official"
      ? entry.sourceTier
      : undefined;
  const localPath = boundedText(entry.localPath, 512, "localPath")
    .replace(/\\/gu, "/");
  if (localPath.includes("\0")) {
    throw new Error("Asset provenance localPath contains a null byte.");
  }
  const fetchedAt = new Date(entry.fetchedAt);
  if (!Number.isFinite(fetchedAt.getTime())) {
    throw new Error("Asset provenance fetchedAt is invalid.");
  }
  return {
    candidateId: boundedText(entry.candidateId, 160, "candidateId"),
    localPath,
    sha256: normalizeHash(entry.sha256, "sha256"),
    assetUrlHash: normalizeHash(entry.assetUrlHash, "assetUrlHash"),
    sourcePage: canonicalizeUrlForModel(
      boundedText(entry.sourcePage, 2_048, "sourcePage"),
    ).slice(0, 512),
    sourceLevel,
    ...(sourceTier ? { sourceTier } : {}),
    mimeType: boundedText(entry.mimeType, 80, "mimeType").toLowerCase(),
    width: boundedInteger(entry.width, "width"),
    height: boundedInteger(entry.height, "height"),
    bytes: boundedInteger(entry.bytes, "bytes"),
    fetchedAt: fetchedAt.toISOString(),
  };
}

function ledgerPathForTask(taskRoot: string): string {
  return path.join(path.resolve(taskRoot), "assets", ASSET_PROVENANCE_LEDGER_FILENAME);
}

function isPathWithin(parentPath: string, candidatePath: string): boolean {
  const relative = path.relative(
    path.resolve(parentPath),
    path.resolve(candidatePath),
  );
  return (
    relative === ""
    || (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

async function resolveLedgerPathForTask(
  taskRoot: string,
  createDirectory: boolean,
): Promise<string> {
  const taskRootReal = await realpath(path.resolve(taskRoot));
  const assetsDirectory = path.join(taskRootReal, "assets");
  if (createDirectory) {
    await mkdir(assetsDirectory, { recursive: false }).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code !== "EEXIST") {
          throw error;
        }
      },
    );
  }

  const directoryStats = await lstat(assetsDirectory).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT" && !createDirectory) {
        return undefined;
      }
      throw error;
    },
  );
  if (!directoryStats) {
    return ledgerPathForTask(taskRootReal);
  }
  if (directoryStats.isSymbolicLink()) {
    throw new Error(
      "Asset provenance directory cannot be a symbolic link or reparse point.",
    );
  }
  if (!directoryStats.isDirectory()) {
    throw new Error("Asset provenance directory must be a directory.");
  }

  const assetsDirectoryReal = await realpath(assetsDirectory);
  if (!isPathWithin(taskRootReal, assetsDirectoryReal)) {
    throw new Error(
      "Asset provenance directory resolves outside the task root.",
    );
  }
  return path.join(assetsDirectoryReal, ASSET_PROVENANCE_LEDGER_FILENAME);
}

function parseLedger(raw: string): StoredAssetProvenanceLedger {
  try {
    const parsed = JSON.parse(raw) as {
      version?: unknown;
      entries?: unknown;
    };
    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) {
      return { version: 1, entries: [] };
    }
    const entries: AssetProvenanceEntry[] = [];
    for (const value of parsed.entries) {
      try {
        entries.push(normalizeEntry(value as AssetProvenanceEntry));
      } catch {
        // Invalid historical rows are dropped instead of poisoning new writes.
      }
    }
    return {
      version: 1,
      entries: entries.slice(-ASSET_PROVENANCE_LEDGER_MAX_ENTRIES),
    };
  } catch {
    return { version: 1, entries: [] };
  }
}

async function readStoredLedger(
  ledgerPath: string,
): Promise<StoredAssetProvenanceLedger> {
  try {
    return parseLedger(await readFile(ledgerPath, "utf8"));
  } catch {
    return { version: 1, entries: [] };
  }
}

function serializeBoundedLedger(
  entries: AssetProvenanceEntry[],
): string {
  const bounded = entries.slice(-ASSET_PROVENANCE_LEDGER_MAX_ENTRIES);
  while (bounded.length > 0) {
    const serialized = `${JSON.stringify({
      version: 1,
      entries: bounded,
    } satisfies StoredAssetProvenanceLedger)}\n`;
    if (
      Buffer.byteLength(serialized, "utf8")
      <= ASSET_PROVENANCE_LEDGER_MAX_BYTES
    ) {
      return serialized;
    }
    bounded.shift();
  }
  return `${JSON.stringify({ version: 1, entries: [] })}\n`;
}

async function assertLedgerIsNotReparsePoint(
  ledgerPath: string,
): Promise<void> {
  try {
    const stats = await lstat(ledgerPath);
    if (stats.isSymbolicLink()) {
      throw new Error("Asset provenance ledger must not be a reparse point.");
    }
  } catch (error) {
    if (
      error
      && typeof error === "object"
      && "code" in error
      && error.code === "ENOENT"
    ) {
      return;
    }
    throw error;
  }
}

async function writeLedgerAtomically(
  ledgerPath: string,
  content: string,
): Promise<void> {
  await assertLedgerIsNotReparsePoint(ledgerPath);
  const tempPath = path.join(
    path.dirname(ledgerPath),
    `.${path.basename(ledgerPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(tempPath, content, { encoding: "utf8", flag: "wx" });
    await rename(tempPath, ledgerPath);
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
}

async function withLedgerWriteQueue<T>(
  ledgerPath: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = ledgerWriteQueues.get(ledgerPath)
    ?? Promise.resolve();
  const run = previous
    .catch(() => undefined)
    .then(operation);
  const settled = run.then(
    () => undefined,
    () => undefined,
  );
  ledgerWriteQueues.set(ledgerPath, settled);
  try {
    return await run;
  } finally {
    if (ledgerWriteQueues.get(ledgerPath) === settled) {
      ledgerWriteQueues.delete(ledgerPath);
    }
  }
}

export async function appendAssetProvenanceEntry(input: {
  taskRoot: string;
  entry: AssetProvenanceEntry;
}): Promise<AssetProvenanceLedgerSnapshot> {
  const ledgerPath = await resolveLedgerPathForTask(input.taskRoot, true);
  return withLedgerWriteQueue(ledgerPath, async () => {
    const stored = await readStoredLedger(ledgerPath);
    const entry = normalizeEntry(input.entry);
    const entries = stored.entries.filter(
      (existing) =>
        existing.localPath !== entry.localPath
        && existing.sha256 !== entry.sha256,
    );
    entries.push(entry);
    const serialized = serializeBoundedLedger(entries);
    await writeLedgerAtomically(ledgerPath, serialized);
    return {
      ledgerPath,
      entries: parseLedger(serialized).entries,
    };
  });
}

export async function readAssetProvenanceLedger(
  taskRoot: string,
): Promise<AssetProvenanceLedgerSnapshot> {
  const ledgerPath = await resolveLedgerPathForTask(taskRoot, false);
  const stored = await readStoredLedger(ledgerPath);
  return {
    ledgerPath,
    entries: stored.entries,
  };
}
