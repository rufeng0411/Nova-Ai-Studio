// PD-SAAS-FORK P0-3/P0-4: bounded, scope-bound in-memory retention for signed media URLs.

import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

import { canonicalizeUrlForModel } from "../security/urlRedaction.js";
import { normalizePublicHttpUrl } from "../../tool/builtin/web/publicHttpUrlPolicy.js";
import type { OfficialSourceClassification } from "./officialSourceClassifier.js";

export const DEFAULT_OFFICIAL_MEDIA_CANDIDATE_TTL_MS = 10 * 60 * 1_000;
export const DEFAULT_OFFICIAL_MEDIA_CANDIDATE_MAX_ENTRIES = 400;

export type PublicOfficialMediaCandidate = {
  candidateId: string;
  canonicalUrl: string;
  width?: number;
  height?: number;
  mediaType?: string;
  sourcePage: string;
};

export type OfficialMediaCandidateBinding = {
  tenantScopeId: string;
  principalScopeId: string;
  workspaceRoot: string;
  sessionId: string;
  taskRoot: string;
  goalVersion: number;
};

export type RegisterOfficialMediaCandidateInput =
  & OfficialMediaCandidateBinding
  & {
  turnId: string;
  fullUrl: string;
  sourcePageUrl: string;
  width?: number;
  height?: number;
  mediaType?: string;
  sourceClassification: OfficialSourceClassification;
  };

export type StoredOfficialMediaCandidate =
  RegisterOfficialMediaCandidateInput
  & PublicOfficialMediaCandidate
  & {
    assetUrlHash: string;
    sourcePageHash: string;
    bindingHash: string;
    expiresAt: number;
  };

export type OfficialMediaCandidateRegistryOptions = {
  maxEntries?: number;
  ttlMs?: number;
  now?: () => number;
  idFactory?: () => string;
};

function normalizePositiveInteger(value: number | undefined): number | undefined {
  return Number.isSafeInteger(value) && (value ?? 0) > 0 ? value : undefined;
}

function boundedPositiveInteger(
  value: number | undefined,
  upperBound: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return upperBound;
  }
  return Math.min(Math.floor(value), upperBound);
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeScopePart(value: string, label: string): string {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > 512) {
    throw new Error(`Official media candidate ${label} is invalid.`);
  }
  return normalized;
}

function normalizeWorkspaceRoot(value: string): string {
  const resolved = path.resolve(normalizeScopePart(value, "workspaceRoot"))
    .replace(/\\/gu, "/")
    .replace(/\/+$/u, "");
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function normalizeTaskRoot(value: string): string {
  const normalized = normalizeScopePart(value, "taskRoot")
    .replace(/\\/gu, "/")
    .replace(/^\.\/+/u, "")
    .replace(/\/+$/u, "");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function normalizeGoalVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error("Official media candidate goalVersion is invalid.");
  }
  return value;
}

function normalizeBinding(
  binding: OfficialMediaCandidateBinding,
): OfficialMediaCandidateBinding {
  return {
    tenantScopeId: normalizeScopePart(
      binding.tenantScopeId,
      "tenantScopeId",
    ),
    principalScopeId: normalizeScopePart(
      binding.principalScopeId,
      "principalScopeId",
    ),
    workspaceRoot: normalizeWorkspaceRoot(binding.workspaceRoot),
    sessionId: normalizeScopePart(binding.sessionId, "sessionId"),
    taskRoot: normalizeTaskRoot(binding.taskRoot),
    goalVersion: normalizeGoalVersion(binding.goalVersion),
  };
}

function computeBindingHash(input: {
  binding: OfficialMediaCandidateBinding;
  sourcePageHash: string;
  assetUrlHash: string;
}): string {
  return sha256(JSON.stringify([
    input.binding.tenantScopeId,
    input.binding.principalScopeId,
    input.binding.workspaceRoot,
    input.binding.sessionId,
    input.binding.taskRoot,
    input.binding.goalVersion,
    input.sourcePageHash,
    input.assetUrlHash,
  ]));
}

function bindingsEqual(
  left: OfficialMediaCandidateBinding,
  right: OfficialMediaCandidateBinding,
): boolean {
  return (
    left.tenantScopeId === right.tenantScopeId
    && left.principalScopeId === right.principalScopeId
    && left.workspaceRoot === right.workspaceRoot
    && left.sessionId === right.sessionId
    && left.taskRoot === right.taskRoot
    && left.goalVersion === right.goalVersion
  );
}

export class OfficialMediaCandidateRegistry {
  private readonly entries = new Map<string, StoredOfficialMediaCandidate>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly idFactory: () => string;

  constructor(options: OfficialMediaCandidateRegistryOptions = {}) {
    this.maxEntries = boundedPositiveInteger(
      options.maxEntries,
      DEFAULT_OFFICIAL_MEDIA_CANDIDATE_MAX_ENTRIES,
    );
    this.ttlMs = boundedPositiveInteger(
      options.ttlMs,
      DEFAULT_OFFICIAL_MEDIA_CANDIDATE_TTL_MS,
    );
    this.now = options.now ?? Date.now;
    this.idFactory = options.idFactory ?? (() => `media-${randomUUID()}`);
  }

  register(
    input: RegisterOfficialMediaCandidateInput,
  ): PublicOfficialMediaCandidate {
    this.pruneExpired();
    while (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }

    const fullUrl = normalizePublicHttpUrl(input.fullUrl).toString();
    const sourcePageUrl = normalizePublicHttpUrl(
      input.sourcePageUrl,
    ).toString();
    const binding = normalizeBinding(input);
    const assetUrlHash = sha256(fullUrl);
    const sourcePageHash = sha256(sourcePageUrl);
    const bindingHash = computeBindingHash({
      binding,
      sourcePageHash,
      assetUrlHash,
    });
    const candidateId = this.idFactory();
    const width = normalizePositiveInteger(input.width);
    const height = normalizePositiveInteger(input.height);
    const publicCandidate: PublicOfficialMediaCandidate = {
      candidateId,
      canonicalUrl: canonicalizeUrlForModel(fullUrl),
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
      ...(input.mediaType ? { mediaType: input.mediaType } : {}),
      sourcePage: canonicalizeUrlForModel(sourcePageUrl),
    };
    this.entries.set(candidateId, {
      ...input,
      ...binding,
      ...publicCandidate,
      fullUrl,
      sourcePageUrl,
      assetUrlHash,
      sourcePageHash,
      bindingHash,
      sourceClassification: { ...input.sourceClassification },
      expiresAt: this.now() + this.ttlMs,
    });
    return publicCandidate;
  }

  resolve(
    candidateId: string,
    binding: OfficialMediaCandidateBinding,
  ): StoredOfficialMediaCandidate | undefined {
    this.pruneExpired();
    const entry = this.entries.get(candidateId);
    if (!entry) return undefined;
    let normalizedBinding: OfficialMediaCandidateBinding;
    try {
      normalizedBinding = normalizeBinding(binding);
    } catch {
      return undefined;
    }
    if (!bindingsEqual(entry, normalizedBinding)) return undefined;
    const expectedBindingHash = computeBindingHash({
      binding: normalizedBinding,
      sourcePageHash: sha256(entry.sourcePageUrl),
      assetUrlHash: sha256(entry.fullUrl),
    });
    if (entry.bindingHash !== expectedBindingHash) return undefined;
    return {
      ...entry,
      sourceClassification: { ...entry.sourceClassification },
    };
  }

  get size(): number {
    this.pruneExpired();
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  private pruneExpired(): void {
    const now = this.now();
    for (const [candidateId, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(candidateId);
      }
    }
  }
}

let sharedOfficialMediaCandidateRegistry:
  | OfficialMediaCandidateRegistry
  | undefined;

export function getSharedOfficialMediaCandidateRegistry():
  OfficialMediaCandidateRegistry {
  sharedOfficialMediaCandidateRegistry ??=
    new OfficialMediaCandidateRegistry();
  return sharedOfficialMediaCandidateRegistry;
}

export function resetSharedOfficialMediaCandidateRegistryForTests(): void {
  sharedOfficialMediaCandidateRegistry?.clear();
  sharedOfficialMediaCandidateRegistry = undefined;
}
