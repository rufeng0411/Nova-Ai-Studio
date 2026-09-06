// PD-SAAS-FORK: browser-safe v2 deliverable contract identity kernel.
import { normalizeSdmPath } from "./sdmSlotMatching.js";

function hashPayload(payload: string): string {
  let hash = 5381;
  for (let i = 0; i < payload.length; i += 1) {
    hash = ((hash << 5) + hash) ^ payload.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

function normalizeContractScope(path: string | null | undefined): string {
  return normalizeSdmPath(String(path ?? "")).replace(/\/+$/, "").toLowerCase();
}

export type ContractHashManifestLike = {
  goalVersion: number;
  taskArtifactDir?: string;
  slots: Array<{
    id: string;
    kind?: string;
    required?: boolean;
    count?: number;
    pathHint?: string;
    pathHints?: string[];
    status?: string;
  }>;
};

/** contractHashVersion=2 — includes task scope, count, pathHints, and goalVersion. */
export function computeStableContractHashV2(
  manifest: ContractHashManifestLike | undefined,
  scopeDir?: string | null,
): string {
  if (!manifest) return "0";
  const slotPayload = manifest.slots
    .filter((slot) => slot.status !== "removed")
    .map((slot) => [
      slot.id,
      slot.kind ?? "",
      slot.required === false ? "0" : "1",
      String(typeof slot.count === "number" && slot.count > 0 ? slot.count : 1),
      normalizeSdmPath(slot.pathHint ?? ""),
      ...(slot.pathHints ?? []).map((hint) => normalizeSdmPath(hint)),
    ].join("|"))
    .join(";");
  const payload = [
    "v2",
    normalizeContractScope(scopeDir ?? manifest.taskArtifactDir),
    String(manifest.goalVersion),
    slotPayload,
  ].join(";");
  return hashPayload(payload);
}
