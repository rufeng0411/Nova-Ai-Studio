// PD-SAAS-FORK P0-4: scope-bound official media localization with bounded provenance.

import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  unlink,
} from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import type { PermissionResult } from "../../permission/index.js";
import { resolveResilienceConfig } from "../../pilot/config/resolveResilienceConfig.js";
import { appendAssetProvenanceEntry } from "../../saas/media/assetProvenanceLedger.js";
import { redactUrlsInText } from "../../saas/security/urlRedaction.js";
import {
  getSharedOfficialMediaCandidateRegistry,
  type OfficialMediaCandidateBinding,
  type OfficialMediaCandidateRegistry,
  type StoredOfficialMediaCandidate,
} from "../../saas/media/officialMediaCandidateRegistry.js";
import { classifyOfficialMediaAsset } from "../../saas/media/officialSourceClassifier.js";
import {
  getSharedOutboundGate,
  type OutboundGate,
} from "../../saas/resilience/outboundGate.js";
import { isVapDirectImageUrlEnabled } from "../../saas/media/visualAssetPlatform/vapOutboundGate.js";
import {
  createIngestedEntry,
  ingestVisualAssetEntry,
  loadVisualAssetManifest,
  saveVisualAssetManifest,
} from "../../saas/media/visualAssetPlatform/manifestStore.js";
import type { VisualAssetSource } from "../../saas/media/visualAssetPlatform/types.js";
import { resolveSessionDownloadsAbsDir } from "../../saas/media/visualAssetPlatform/sessionDownloadPaths.js";
import { visualAssetPlatformMode } from "../../saas/resilience/stabilityFlags.js";
import { PilotDeckToolRuntimeError } from "../protocol/errors.js";
import type {
  PilotDeckToolDefinition,
  PilotDeckToolRuntimeContext,
} from "../protocol/types.js";
import {
  fetchPublicHttpResource,
  normalizePublicHttpUrl,
  type PublicDnsResolver,
} from "./web/publicHttpUrlPolicy.js";

export const FETCH_MEDIA_ASSET_MAX_BYTES = 12 * 1024 * 1024;
export const FETCH_MEDIA_ASSET_TURN_MAX_BYTES = 48 * 1024 * 1024;
export const FETCH_MEDIA_ASSET_MAX_INPUT_PIXELS = 40_000_000;

const MAX_BUDGET_KEYS = 1_024;
const SAFE_FILENAME_STEM = /[^\p{L}\p{N}._-]+/gu;

type MediaAssetBudgetState = {
  usedBytes: number;
  reservedBytes: number;
};

type MediaAssetBudgetReservation = {
  commit(actualBytes: number): void;
  release(): void;
};

export type MediaAssetTurnBudgetOptions = {
  maxBytesPerAsset?: number;
  maxBytesPerTurn?: number;
};

export class MediaAssetTurnBudget {
  readonly maxBytesPerAsset: number;
  readonly maxBytesPerTurn: number;
  private readonly states = new Map<string, MediaAssetBudgetState>();

  constructor(options: MediaAssetTurnBudgetOptions = {}) {
    this.maxBytesPerAsset = boundedPositiveInteger(
      options.maxBytesPerAsset,
      FETCH_MEDIA_ASSET_MAX_BYTES,
    );
    this.maxBytesPerTurn = boundedPositiveInteger(
      options.maxBytesPerTurn,
      FETCH_MEDIA_ASSET_TURN_MAX_BYTES,
    );
    if (this.maxBytesPerAsset > this.maxBytesPerTurn) {
      throw new Error(
        "MediaAssetTurnBudget maxBytesPerAsset cannot exceed maxBytesPerTurn.",
      );
    }
  }

  reserve(key: string): MediaAssetBudgetReservation {
    const normalizedKey = String(key ?? "").trim();
    if (!normalizedKey) {
      throw new Error("Media asset turn download budget key is required.");
    }
    const state = this.states.get(normalizedKey) ?? {
      usedBytes: 0,
      reservedBytes: 0,
    };
    if (
      state.usedBytes
        + state.reservedBytes
        + this.maxBytesPerAsset
      > this.maxBytesPerTurn
    ) {
      throw new PilotDeckToolRuntimeError(
        "tool_execution_failed",
        "fetch_media_asset reached the per-turn download budget.",
      );
    }
    state.reservedBytes += this.maxBytesPerAsset;
    this.states.delete(normalizedKey);
    this.states.set(normalizedKey, state);
    this.prune();

    let settled = false;
    return {
      commit: (actualBytes) => {
        if (settled) return;
        settled = true;
        if (
          !Number.isSafeInteger(actualBytes)
          || actualBytes < 0
          || actualBytes > this.maxBytesPerAsset
        ) {
          state.reservedBytes = Math.max(
            0,
            state.reservedBytes - this.maxBytesPerAsset,
          );
          state.usedBytes += this.maxBytesPerAsset;
          throw new PilotDeckToolRuntimeError(
            "tool_execution_failed",
            "fetch_media_asset response exceeded the per-asset byte limit.",
          );
        }
        state.reservedBytes = Math.max(
          0,
          state.reservedBytes - this.maxBytesPerAsset,
        );
        state.usedBytes += actualBytes;
      },
      release: () => {
        if (settled) return;
        settled = true;
        state.reservedBytes = Math.max(
          0,
          state.reservedBytes - this.maxBytesPerAsset,
        );
        if (state.usedBytes === 0 && state.reservedBytes === 0) {
          this.states.delete(normalizedKey);
        }
      },
    };
  }

  clear(): void {
    this.states.clear();
  }

  private prune(): void {
    for (const [key, state] of this.states) {
      if (this.states.size <= MAX_BUDGET_KEYS) break;
      if (state.reservedBytes === 0) {
        this.states.delete(key);
      }
    }
  }
}

export type FetchMediaAssetInput = {
  candidateId: string;
  filename?: string;
};

export type FetchMediaAssetOutput = {
  localPath: string;
  width: number;
  height: number;
  mimeType: string;
  bytes: number;
  sha256: string;
  sourcePage: string;
};

export type CreateFetchMediaAssetToolOptions = {
  fetchImpl?: typeof fetch;
  dnsResolver?: PublicDnsResolver;
  candidateRegistry?: OfficialMediaCandidateRegistry;
  outboundGate?: Pick<OutboundGate, "run">;
  downloadBudget?: MediaAssetTurnBudget;
  timeoutMs?: number;
};

type DetectedImageType = {
  mimeType: string;
  extension: "png" | "jpg" | "webp" | "gif" | "avif";
  sharpFormat: "png" | "jpeg" | "webp" | "gif" | "heif";
};

type SecureSessionDownloadsDirectory = {
  taskRootAbsolute: string;
  taskRootReal: string;
  downloadsAbsolute: string;
  downloadsReal: string;
};

let sharedDownloadBudget: MediaAssetTurnBudget | undefined;

function getSharedDownloadBudget(): MediaAssetTurnBudget {
  sharedDownloadBudget ??= new MediaAssetTurnBudget();
  return sharedDownloadBudget;
}

export function resetSharedMediaAssetTurnBudgetForTests(): void {
  sharedDownloadBudget?.clear();
  sharedDownloadBudget = undefined;
}

function boundedPositiveInteger(
  value: number | undefined,
  upperBound: number,
): number {
  if (
    typeof value !== "number"
    || !Number.isSafeInteger(value)
    || value < 1
  ) {
    return upperBound;
  }
  return Math.min(value, upperBound);
}

export function looksLikeHttpsImageUrl(value: string): boolean {
  const trimmed = String(value ?? "").trim();
  if (!/^https:\/\//iu.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname.toLowerCase();
    return /\.(?:jpe?g|png|webp|gif|avif)(?:[?#]|$)/iu.test(pathname);
  } catch {
    return false;
  }
}

function resolveOrRegisterDirectImageCandidate(input: {
  candidateId: string;
  binding: OfficialMediaCandidateBinding;
  context: PilotDeckToolRuntimeContext;
  registry: OfficialMediaCandidateRegistry;
}): StoredOfficialMediaCandidate | undefined {
  const existing = input.registry.resolve(input.candidateId, input.binding);
  if (existing) return existing;
  if (
    !isVapDirectImageUrlEnabled()
    || !looksLikeHttpsImageUrl(input.candidateId)
  ) {
    return undefined;
  }

  try {
    const normalizedUrl = normalizePublicHttpUrl(input.candidateId.trim())
      .toString();
    const directSource = {
      url: normalizedUrl,
      level: "L3" as const,
      reason: "unverified" as const,
    };
    const registered = input.registry.register({
      tenantScopeId: input.binding.tenantScopeId,
      principalScopeId: input.binding.principalScopeId,
      workspaceRoot: input.binding.workspaceRoot,
      sessionId: input.binding.sessionId,
      taskRoot: input.binding.taskRoot,
      goalVersion: input.binding.goalVersion,
      turnId: input.context.turnId,
      fullUrl: normalizedUrl,
      sourcePageUrl: normalizedUrl,
      mediaType: "image/*",
      sourceClassification: classifyOfficialMediaAsset({
        assetUrl: normalizedUrl,
        sourcePage: directSource,
      }),
    });
    return input.registry.resolve(registered.candidateId, input.binding);
  } catch {
    return undefined;
  }
}

function sha256(buffer: Buffer | string): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function isPathWithin(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === ""
    || (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function isMissingPathError(error: unknown): boolean {
  return (
    !!error
    && typeof error === "object"
    && "code" in error
    && error.code === "ENOENT"
  );
}

async function assertDirectoryIsNotReparsePoint(
  directory: string,
  label: string,
): Promise<void> {
  const stats = await lstat(directory);
  if (stats.isSymbolicLink()) {
    throw new PilotDeckToolRuntimeError(
      "path_not_allowed",
      `${label} must not be a symbolic link or reparse point.`,
    );
  }
  if (!stats.isDirectory()) {
    throw new PilotDeckToolRuntimeError(
      "path_not_allowed",
      `${label} must be a directory.`,
    );
  }
}

async function resolveSecureSessionDownloadsDirectory(
  context: PilotDeckToolRuntimeContext,
): Promise<SecureSessionDownloadsDirectory> {
  const taskRoot = String(context.taskArtifactDir ?? "").trim();
  const sessionId = String(context.sessionId ?? "").trim();
  const workspaceAbsolute = path.resolve(context.cwd);
  const taskRootAbsolute = path.resolve(workspaceAbsolute, taskRoot);
  if (
    !taskRoot
    || !sessionId
    || path.isAbsolute(taskRoot)
    || taskRoot.includes("\0")
    || taskRootAbsolute === workspaceAbsolute
  ) {
    throw new PilotDeckToolRuntimeError(
      "path_not_allowed",
      "fetch_media_asset requires a system-assigned task directory and active session id.",
    );
  }
  const workspaceReal = await realpath(context.cwd).catch(() =>
    workspaceAbsolute
  );
  if (!isPathWithin(taskRootAbsolute, workspaceAbsolute)) {
    throw new PilotDeckToolRuntimeError(
      "path_not_allowed",
      "The task artifact directory is outside the workspace.",
    );
  }
  await assertDirectoryIsNotReparsePoint(
    taskRootAbsolute,
    "The task artifact directory",
  );
  const taskRootReal = await realpath(taskRootAbsolute);
  if (!isPathWithin(taskRootReal, workspaceReal)) {
    throw new PilotDeckToolRuntimeError(
      "path_not_allowed",
      "The task artifact directory resolves outside the workspace.",
    );
  }

  const downloadsAbsolute = resolveSessionDownloadsAbsDir(context.cwd, sessionId);
  try {
    await assertDirectoryIsNotReparsePoint(
      downloadsAbsolute,
      "The session downloads directory",
    );
  } catch (error) {
    if (!isMissingPathError(error)) throw error;
    await mkdir(downloadsAbsolute, { recursive: true });
    await assertDirectoryIsNotReparsePoint(
      downloadsAbsolute,
      "The session downloads directory",
    );
  }
  const downloadsReal = await realpath(downloadsAbsolute);
  if (!isPathWithin(downloadsReal, workspaceReal)) {
    throw new PilotDeckToolRuntimeError(
      "path_not_allowed",
      "The session downloads directory resolves outside the workspace.",
    );
  }
  return {
    taskRootAbsolute,
    taskRootReal,
    downloadsAbsolute,
    downloadsReal,
  };
}

function resolveCandidateBinding(
  context: PilotDeckToolRuntimeContext,
): OfficialMediaCandidateBinding {
  const taskRoot = String(context.taskArtifactDir ?? "").trim();
  const workspaceAbsolute = path.resolve(context.cwd);
  const taskRootAbsolute = path.resolve(workspaceAbsolute, taskRoot);
  const goalVersion = context.taskGoalVersion;
  if (
    !taskRoot
    || path.isAbsolute(taskRoot)
    || taskRoot.includes("\0")
    || taskRootAbsolute === workspaceAbsolute
    || !isPathWithin(taskRootAbsolute, workspaceAbsolute)
    || !Number.isSafeInteger(goalVersion)
    || (goalVersion ?? 0) < 1
  ) {
    throw new PilotDeckToolRuntimeError(
      "tool_execution_failed",
      "fetch_media_asset requires an active task scope and goal version.",
    );
  }
  const trustedScope = context.trustedExecutionScope ?? {
    tenantScopeId: "local",
    principalScopeId: "local",
  };
  return {
    tenantScopeId: trustedScope.tenantScopeId,
    principalScopeId: trustedScope.principalScopeId,
    workspaceRoot: context.cwd,
    sessionId: context.sessionId,
    taskRoot,
    goalVersion: goalVersion!,
  };
}

function buildBudgetKey(
  binding: OfficialMediaCandidateBinding,
  turnId: string,
): string {
  return sha256(JSON.stringify([
    binding.tenantScopeId,
    binding.principalScopeId,
    path.resolve(binding.workspaceRoot),
    binding.sessionId,
    binding.taskRoot,
    binding.goalVersion,
    turnId,
  ]));
}

function detectImageType(buffer: Buffer): DetectedImageType | undefined {
  if (
    buffer.byteLength >= 8
    && buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return {
      mimeType: "image/png",
      extension: "png",
      sharpFormat: "png",
    };
  }
  if (
    buffer.byteLength >= 3
    && buffer[0] === 0xff
    && buffer[1] === 0xd8
    && buffer[2] === 0xff
  ) {
    return {
      mimeType: "image/jpeg",
      extension: "jpg",
      sharpFormat: "jpeg",
    };
  }
  if (
    buffer.byteLength >= 12
    && buffer.toString("ascii", 0, 4) === "RIFF"
    && buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return {
      mimeType: "image/webp",
      extension: "webp",
      sharpFormat: "webp",
    };
  }
  const gifHeader = buffer.toString("ascii", 0, 6);
  if (gifHeader === "GIF87a" || gifHeader === "GIF89a") {
    return {
      mimeType: "image/gif",
      extension: "gif",
      sharpFormat: "gif",
    };
  }
  if (
    buffer.byteLength >= 12
    && buffer.toString("ascii", 4, 8) === "ftyp"
    && ["avif", "avis"].includes(buffer.toString("ascii", 8, 12))
  ) {
    return {
      mimeType: "image/avif",
      extension: "avif",
      sharpFormat: "heif",
    };
  }
  return undefined;
}

function normalizeResponseMime(value: string | undefined): string {
  const mime = String(value ?? "")
    .split(";", 1)[0]
    ?.trim()
    .toLowerCase() ?? "";
  return mime === "image/jpg" ? "image/jpeg" : mime;
}

function filenameStem(
  requested: string | undefined,
  candidate: StoredOfficialMediaCandidate,
): string {
  const rawRequested = String(requested ?? "").trim();
  if (
    rawRequested
    && (
      rawRequested.includes("\0")
      || rawRequested !== path.basename(rawRequested)
      || rawRequested === "."
      || rawRequested === ".."
    )
  ) {
    throw new PilotDeckToolRuntimeError(
      "invalid_tool_input",
      "fetch_media_asset filename must be a basename without path separators.",
    );
  }
  let raw = rawRequested;
  if (!raw) {
    try {
      raw = decodeURIComponent(
        path.posix.basename(new URL(candidate.fullUrl).pathname),
      );
    } catch {
      raw = "official-media";
    }
  }
  const extension = path.extname(raw);
  const stem = raw
    .slice(0, extension ? -extension.length : undefined)
    .replace(SAFE_FILENAME_STEM, "-")
    .replace(/^[-._]+|[-._]+$/gu, "")
    .slice(0, 64);
  return stem || "official-media";
}

async function inspectImage(
  buffer: Buffer,
  detected: DetectedImageType,
): Promise<{ width: number; height: number }> {
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    metadata = await sharp(buffer, {
      failOn: "error",
      limitInputPixels: FETCH_MEDIA_ASSET_MAX_INPUT_PIXELS,
    }).metadata();
  } catch (error) {
    throw new PilotDeckToolRuntimeError(
      "tool_execution_failed",
      `fetch_media_asset rejected invalid image content: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (
    metadata.format !== detected.sharpFormat
    || !metadata.width
    || !metadata.height
    || metadata.width * metadata.height > FETCH_MEDIA_ASSET_MAX_INPUT_PIXELS
  ) {
    throw new PilotDeckToolRuntimeError(
      "tool_execution_failed",
      "fetch_media_asset image metadata disagrees with its magic bytes or exceeds the pixel limit.",
    );
  }
  return { width: metadata.width, height: metadata.height };
}

async function writeAssetAtomically(input: {
  directory: SecureSessionDownloadsDirectory;
  filename: string;
  buffer: Buffer;
  digest: string;
}): Promise<{ absolutePath: string; created: boolean }> {
  const finalPath = path.join(input.directory.downloadsReal, input.filename);
  if (!isPathWithin(finalPath, input.directory.downloadsReal)) {
    throw new PilotDeckToolRuntimeError(
      "path_not_allowed",
      "fetch_media_asset output escaped the session downloads directory.",
    );
  }
  const tempPath = path.join(
    input.directory.downloadsReal,
    `.${input.filename}.${process.pid}.${randomUUID()}.tmp`,
  );
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(tempPath, "wx", 0o600);
    await handle.writeFile(input.buffer);
    await handle.sync();
    await handle.close();
    handle = undefined;

    await assertDirectoryIsNotReparsePoint(
      input.directory.downloadsAbsolute,
      "The session downloads directory",
    );
    const currentDownloadsReal = await realpath(
      input.directory.downloadsAbsolute,
    );
    if (currentDownloadsReal !== input.directory.downloadsReal) {
      throw new PilotDeckToolRuntimeError(
        "path_not_allowed",
        "The session downloads directory changed during the download.",
      );
    }

    try {
      const existingStats = await lstat(finalPath);
      if (existingStats.isSymbolicLink() || !existingStats.isFile()) {
        throw new PilotDeckToolRuntimeError(
          "path_not_allowed",
          "fetch_media_asset output target is not a regular file.",
        );
      }
      const existingReal = await realpath(finalPath);
      if (!isPathWithin(existingReal, input.directory.downloadsReal)) {
        throw new PilotDeckToolRuntimeError(
          "path_not_allowed",
          "fetch_media_asset output target resolves outside the session downloads directory.",
        );
      }
      const existingHash = sha256(await readFile(finalPath));
      if (existingHash !== input.digest) {
        throw new PilotDeckToolRuntimeError(
          "tool_execution_failed",
          "fetch_media_asset detected a localized filename collision.",
        );
      }
      return { absolutePath: finalPath, created: false };
    } catch (error) {
      if (!isMissingPathError(error)) throw error;
    }

    await rename(tempPath, finalPath);
    const finalReal = await realpath(finalPath);
    if (!isPathWithin(finalReal, input.directory.downloadsReal)) {
      throw new PilotDeckToolRuntimeError(
        "path_not_allowed",
        "fetch_media_asset output resolves outside the session downloads directory.",
      );
    }
    return { absolutePath: finalPath, created: true };
  } finally {
    await handle?.close().catch(() => undefined);
    await unlink(tempPath).catch(() => undefined);
  }
}

function mapCandidateSourceToVisualAssetSource(
  candidate: StoredOfficialMediaCandidate,
): VisualAssetSource {
  const level = candidate.sourceClassification.level;
  if (level === "L0" || level === "L1") return "official_fetch";
  if (level === "L2") return "authority_site";
  return "web_search_image";
}

async function ingestLocalizedAssetIntoManifest(input: {
  context: PilotDeckToolRuntimeContext;
  candidate: StoredOfficialMediaCandidate;
  localPath: string;
  width: number;
  height: number;
  digest: string;
}): Promise<void> {
  if (visualAssetPlatformMode() === "off") return;
  const taskDir = String(input.context.taskArtifactDir ?? "").trim();
  if (!taskDir) return;
  try {
    const source = mapCandidateSourceToVisualAssetSource(input.candidate);
    let manifest = await loadVisualAssetManifest({
      workspaceRoot: input.context.cwd,
      taskArtifactDir: taskDir,
      sessionId: input.context.sessionId,
      goalVersion: input.context.taskGoalVersion,
      subject: input.context.sessionGoalQualityContract?.subjectAnchor,
    });
    manifest = ingestVisualAssetEntry(
      manifest,
      createIngestedEntry({
        source,
        rawPath: input.localPath,
        recommendedTier: "none",
        role: "product_hero",
        processingStatus: "ok",
        width: input.width,
        height: input.height,
        provenance: {
          candidateId: input.candidate.candidateId,
          sourcePageUrl: input.candidate.sourcePage,
          fetchedAt: (input.context.now?.() ?? new Date()).toISOString(),
          notes: `sha256:${input.digest.slice(0, 12)}`,
        },
      }),
    );
    await saveVisualAssetManifest({
      workspaceRoot: input.context.cwd,
      manifest,
    });
  } catch {
    // Never fail fetch_media_asset because of VAP bookkeeping.
  }
}

function permissionRequest(): PermissionResult {
  return {
    type: "ask",
    reason: {
      type: "tool",
      toolName: "fetch_media_asset",
      message: "Downloading an official media asset requires network and file access.",
    },
    request: {
      toolCallId: "",
      toolName: "fetch_media_asset",
      inputSummary: "download official media asset",
      reason: {
        type: "tool",
        toolName: "fetch_media_asset",
        message: "Downloading an official media asset requires network and file access.",
      },
      options: [
        { id: "allow_once", label: "Allow download" },
        { id: "deny", label: "Deny" },
      ],
    },
  };
}

export function createFetchMediaAssetTool(
  options: CreateFetchMediaAssetToolOptions = {},
): PilotDeckToolDefinition<FetchMediaAssetInput, FetchMediaAssetOutput> {
  const timeoutMs = boundedPositiveInteger(options.timeoutMs, 60_000);
  const directUrlEnabled = isVapDirectImageUrlEnabled();
  const candidateIdMaxLength = directUrlEnabled ? 2048 : 200;
  const candidateIdDescription = directUrlEnabled
    ? "Candidate ID returned by fetch_page_images, or a direct HTTPS image URL when direct URL mode is enabled."
    : "Candidate ID returned by fetch_page_images.";
  return {
    name: "fetch_media_asset",
    aliases: ["FetchMediaAsset"],
    description: directUrlEnabled
      ? "Download one scope-bound candidate returned by fetch_page_images, or a direct HTTPS image URL, into the active session downloads directory (artifacts/sessions/{sessionId}/downloads). Validates public DNS, byte limits, MIME/magic, image pixels, and provenance."
      : "Download one scope-bound candidate returned by fetch_page_images into the active session downloads directory (artifacts/sessions/{sessionId}/downloads). Validates public DNS, byte limits, MIME/magic, image pixels, and provenance. Pass candidateId; never pass a raw URL.",
    kind: "network",
    inputSchema: {
      type: "object",
      required: ["candidateId"],
      additionalProperties: false,
      properties: {
        candidateId: {
          type: "string",
          minLength: 1,
          maxLength: candidateIdMaxLength,
          description: candidateIdDescription,
        },
        filename: {
          type: "string",
          minLength: 1,
          maxLength: 120,
          description: "Optional safe basename stem for the localized image.",
        },
      },
    },
    maxResultBytes: 20_000,
    isReadOnly: () => false,
    isConcurrencySafe: () => true,
    isOpenWorld: () => true,
    checkPermissions: async () => permissionRequest(),
    execute: async (input, context) => {
      const binding = resolveCandidateBinding(context);
      const registry = options.candidateRegistry
        ?? getSharedOfficialMediaCandidateRegistry();
      const candidate = resolveOrRegisterDirectImageCandidate({
        candidateId: input.candidateId,
        binding,
        context,
        registry,
      });
      if (!candidate) {
        throw new PilotDeckToolRuntimeError(
          "tool_execution_failed",
          "fetch_media_asset candidate is unavailable or does not match the current bound candidate scope.",
        );
      }

      const directory = await resolveSecureSessionDownloadsDirectory(context);
      const downloadBudget = options.downloadBudget
        ?? getSharedDownloadBudget();
      const reservation = downloadBudget.reserve(
        buildBudgetKey(binding, context.turnId),
      );
      const timeout = new AbortController();
      const timer = setTimeout(
        () => timeout.abort(new Error("fetch_media_asset timeout")),
        timeoutMs,
      );
      const onParentAbort = () => timeout.abort();
      context.abortSignal?.addEventListener(
        "abort",
        onParentAbort,
        { once: true },
      );

      let response: Awaited<ReturnType<typeof fetchPublicHttpResource>>;
      let fetched = false;
      try {
        const resilience = resolveResilienceConfig();
        const gate = options.outboundGate
          ?? getSharedOutboundGate(resilience.outboundMaxConcurrent);
        response = await gate.run(() =>
          fetchPublicHttpResource(candidate.fullUrl, {
            fetchImpl: options.fetchImpl,
            resolver: options.dnsResolver,
            expectedKind: "image",
            maxImageBytes: downloadBudget.maxBytesPerAsset,
            headers: {
              Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif",
              "User-Agent":
                "Mozilla/5.0 (compatible; Nova-Ai-Studio/2.0; official-media)",
            },
            signal: timeout.signal,
          })
        );
        fetched = true;
        reservation.commit(response.buffer.byteLength);
      } catch (error) {
        if (!fetched) reservation.release();
        const message = redactUrlsInText(
          error instanceof Error ? error.message : String(error),
        );
        if (error instanceof PilotDeckToolRuntimeError) throw error;
        throw new PilotDeckToolRuntimeError(
          "tool_execution_failed",
          `fetch_media_asset could not download the candidate: ${message}`,
        );
      } finally {
        clearTimeout(timer);
        context.abortSignal?.removeEventListener(
          "abort",
          onParentAbort,
        );
      }

      if (response.status < 200 || response.status >= 300) {
        throw new PilotDeckToolRuntimeError(
          "tool_execution_failed",
          `fetch_media_asset received HTTP ${response.status}.`,
        );
      }
      if (
        response.buffer.byteLength < 1
        || response.buffer.byteLength > downloadBudget.maxBytesPerAsset
      ) {
        throw new PilotDeckToolRuntimeError(
          "tool_execution_failed",
          "fetch_media_asset response exceeded the per-asset byte limit.",
        );
      }

      const detected = detectImageType(response.buffer);
      if (!detected) {
        throw new PilotDeckToolRuntimeError(
          "tool_execution_failed",
          "fetch_media_asset response failed image magic validation.",
        );
      }
      const responseMime = normalizeResponseMime(
        response.headers["content-type"],
      );
      if (responseMime !== detected.mimeType) {
        throw new PilotDeckToolRuntimeError(
          "tool_execution_failed",
          `fetch_media_asset MIME ${responseMime || "(missing)"} disagrees with ${detected.mimeType} magic bytes.`,
        );
      }
      const dimensions = await inspectImage(response.buffer, detected);
      const digest = sha256(response.buffer);
      const outputFilename = `${
        filenameStem(input.filename, candidate)
      }-${digest.slice(0, 12)}.${detected.extension}`;
      const written = await writeAssetAtomically({
        directory,
        filename: outputFilename,
        buffer: response.buffer,
        digest,
      });
      const localPath = path.relative(
        context.cwd,
        written.absolutePath,
      ).split(path.sep).join("/");

      try {
        await appendAssetProvenanceEntry({
          taskRoot: directory.taskRootReal,
          entry: {
            candidateId: candidate.candidateId,
            localPath,
            sha256: digest,
            assetUrlHash: candidate.assetUrlHash,
            sourcePage: candidate.sourcePage,
            sourceLevel: candidate.sourceClassification.level,
            sourceTier: candidate.sourceClassification.sourceTier,
            mimeType: detected.mimeType,
            width: dimensions.width,
            height: dimensions.height,
            bytes: response.buffer.byteLength,
            fetchedAt: (context.now?.() ?? new Date()).toISOString(),
          },
        });
      } catch (error) {
        if (written.created) {
          await unlink(written.absolutePath).catch(() => undefined);
        }
        throw error;
      }

      await ingestLocalizedAssetIntoManifest({
        context,
        candidate,
        localPath,
        width: dimensions.width,
        height: dimensions.height,
        digest,
      });

      const data: FetchMediaAssetOutput = {
        localPath,
        width: dimensions.width,
        height: dimensions.height,
        mimeType: detected.mimeType,
        bytes: response.buffer.byteLength,
        sha256: digest,
        sourcePage: candidate.sourcePage,
      };
      return {
        content: [
          {
            type: "text",
            text: `Localized official media asset to ${localPath}.`,
          },
          {
            type: "file",
            path: written.absolutePath,
            mimeType: detected.mimeType,
            description: "Localized official media asset",
          },
        ],
        data,
      };
    },
  };
}
