// PD-SAAS-FORK (ROG Phase 8 PR-V1): DashScope video model registry + fallback chain.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type VideoModelRegistryEntry = {
  id: string;
  label: string;
  dashScopeModel: string;
  kind: "t2v" | "i2v" | "r2v";
};

export type VideoModelRegistry = {
  version: number;
  provider: string;
  fallbackChain: VideoModelRegistryEntry[];
  modelNotExistPatterns: string[];
};

let cached: VideoModelRegistry | null = null;

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
}

export function loadVideoModelRegistry(): VideoModelRegistry {
  if (cached) return cached;
  const filePath = path.join(repoRoot(), "config", "video-model-registry.json");
  const raw = fs.readFileSync(filePath, "utf8");
  cached = JSON.parse(raw) as VideoModelRegistry;
  return cached;
}

export function resolveVideoModelFallbackChain(requestedModel?: string): string[] {
  const registry = loadVideoModelRegistry();
  const chain = registry.fallbackChain.map((entry) => entry.dashScopeModel);
  const requested = String(requestedModel ?? "").trim();
  if (!requested) return chain;
  const normalized = requested.toLowerCase();
  const idx = chain.findIndex((m) => m.toLowerCase() === normalized);
  if (idx <= 0) {
    if (idx === -1) return [requested, ...chain];
    return chain;
  }
  return [...chain.slice(idx)];
}

export function isModelNotExistError(message: string): boolean {
  const registry = loadVideoModelRegistry();
  const lower = String(message ?? "").toLowerCase();
  return registry.modelNotExistPatterns.some((pattern) =>
    lower.includes(String(pattern).toLowerCase()));
}
