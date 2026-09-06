// PD-SAAS-FORK: per-turn cache to skip redundant validateEngineDeliverables sweeps
import type { CanonicalMessage } from "../../model/index.js";
import type { SessionDeliverableManifest } from "../../saas/taskState/sessionDeliverableManifest.js";
import type { EngineDeliverableValidation } from "./validateDeliverablesEngine.js";

export type TurnValidationCacheKey = {
  writeOpsCount: number;
  goalVersion: number;
  manifestVersion: number;
  manifestSlotCount: number;
};

export type TurnValidationCacheEntry = {
  key: TurnValidationCacheKey;
  result: EngineDeliverableValidation;
};

const WRITE_TOOL_NAMES = new Set(["write_file", "edit_file", "edit", "str_replace_editor"]);

export function countDeliverableWriteOps(messages: CanonicalMessage[]): number {
  let count = 0;
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const block of message.content) {
      if (block.type !== "tool_call") continue;
      if (WRITE_TOOL_NAMES.has(block.name)) {
        count += 1;
      }
    }
  }
  return count;
}

export function buildTurnValidationCacheKey(input: {
  messages: CanonicalMessage[];
  sessionManifest?: SessionDeliverableManifest;
}): TurnValidationCacheKey {
  const manifest = input.sessionManifest;
  return {
    writeOpsCount: countDeliverableWriteOps(input.messages),
    goalVersion: manifest?.goalVersion ?? 0,
    manifestVersion: manifest?.manifestVersion ?? 0,
    manifestSlotCount: manifest?.slots?.length ?? 0,
  };
}

export function turnValidationCacheKeysEqual(
  a: TurnValidationCacheKey,
  b: TurnValidationCacheKey,
): boolean {
  return a.writeOpsCount === b.writeOpsCount
    && a.goalVersion === b.goalVersion
    && a.manifestVersion === b.manifestVersion
    && a.manifestSlotCount === b.manifestSlotCount;
}

export function lookupTurnValidationCache(
  cache: TurnValidationCacheEntry | null,
  key: TurnValidationCacheKey,
): EngineDeliverableValidation | null {
  if (!cache) return null;
  if (!turnValidationCacheKeysEqual(cache.key, key)) return null;
  return cache.result;
}

export function storeTurnValidationCache(
  key: TurnValidationCacheKey,
  result: EngineDeliverableValidation,
): TurnValidationCacheEntry {
  return { key, result };
}
