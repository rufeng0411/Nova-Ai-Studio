// PD-SAAS-FORK: strict contract-unit binding kernel (0717 P0-2)
import type { SessionDeliverableManifest, SessionDeliverableSlot } from "../taskState/sessionDeliverableManifest.js";
import { isRealArtifactDeliverablePath } from "../taskState/sessionDeliverableManifest.js";
import { filterVerifiedForContractBinding } from "./filterVerifiedForContractBinding.js";
import {
  CAMPAIGN_SLOT_PATTERNS,
  isChartMermaidSlot,
  isLongformCountSlot,
  isResearchSynthesisSlot,
  kindMatchAllowed,
  normalizeSdmPath,
  pathMatchesKind,
  pathSatisfiesSdmSlot,
  sdmBasename,
  slotMatchPatterns,
  type SdmSlotLike,
} from "./sdmSlotMatching.js";
import { deliverableBasenamesMatch } from "./normalizeDeliverableBasename.js";
import { isRepairEligiblePath, isRepairPlaceholderDeliverablePath } from "./repairEligiblePath.js";
export {
  computeStableContractHashV2,
  type ContractHashManifestLike,
} from "./deliverableContractHash.js";

export const MAX_CONTRACT_UNITS = 128;
export const MAX_CONTRACT_EVIDENCE = 500;

export type ContractMatchTier = "exact" | "basename" | "pattern" | "kind";

export type ContractUnit = {
  unitId: string;
  slotId: string;
  slotLabel: string;
  expectedPath: string;
  expectedBasename: string;
  kind?: string;
  required: boolean;
};

export type ContractUnitBinding = {
  unitId: string;
  slotId: string;
  evidencePath?: string;
  matchTier?: ContractMatchTier;
  matched: boolean;
};

export type ContractSlotBindingSummary = {
  slotId: string;
  label: string;
  required: boolean;
  requiredCount: number;
  matchedCount: number;
  resolvedPaths: string[];
};

export type ContractBindingResult = {
  complete: boolean;
  incompleteReason?: string;
  requiredCount: number;
  matchedCount: number;
  units: ContractUnit[];
  bindings: ContractUnitBinding[];
  slotSummaries: ContractSlotBindingSummary[];
  usedEvidencePaths: string[];
};

export type BindContractUnitsInput = {
  manifest: SessionDeliverableManifest;
  verifiedPaths?: string[];
  diskPaths?: string[];
  scopeDir?: string | null;
};

const PROCESS_ONLY_EXTENSIONS = new Set([
  ".bat", ".cmd", ".js", ".mjs", ".ps1", ".py", ".sh", ".ts", ".tsx",
]);

const TIER_RANK: Record<ContractMatchTier, number> = {
  exact: 0,
  basename: 1,
  pattern: 2,
  kind: 3,
};

function pathsEqual(a: string, b: string): boolean {
  return normalizeSdmPath(a).toLowerCase() === normalizeSdmPath(b).toLowerCase();
}

function joinScopePath(scopeDir: string | null | undefined, fileName: string): string {
  const scope = normalizeSdmPath(String(scopeDir ?? "")).replace(/\/+$/, "");
  const file = normalizeSdmPath(fileName);
  if (file.includes("/")) return file;
  return scope ? `${scope}/${file}` : file;
}

/** Reject slide-NN.png / * / [N] placeholder path literals — never contract evidence. */
export function isContractPlaceholderPath(path: string): boolean {
  const base = sdmBasename(path);
  if (!base) return true;
  if (base.includes("*")) return true;
  if (/\[\s*N\s*\]/i.test(base)) return true;
  if (/\bNN\b/i.test(base)) return true;
  if (/slide-NN\.png/i.test(base)) return true;
  if (/slide-\[N\]\.png/i.test(base)) return true;
  return false;
}

function isProcessDeliverablePath(path: string): boolean {
  const normalized = normalizeSdmPath(path).toLowerCase();
  if (!normalized) return true;
  if (normalized.includes("/skills/") || normalized.endsWith("/skill.md")) return true;
  const ext = normalized.includes(".") ? `.${normalized.split(".").pop()}` : "";
  return PROCESS_ONLY_EXTENSIONS.has(ext);
}

function pathUnderScope(filePath: string, scopeDir: string | null | undefined): boolean {
  if (!scopeDir) return true;
  const normalized = normalizeSdmPath(filePath).replace(/\\/g, "/");
  const scope = normalizeSdmPath(scopeDir).replace(/\\/g, "/").replace(/\/+$/, "");
  if (!scope) return true;
  return normalized === scope || normalized.startsWith(`${scope}/`);
}

function activeRequiredSlots(manifest: SessionDeliverableManifest): SessionDeliverableSlot[] {
  return manifest.slots.filter((slot) => slot.status !== "removed" && slot.required !== false);
}

function shouldExpandCountAsSlideDeck(slot: SessionDeliverableSlot): boolean {
  const kind = String(slot.kind ?? "").toLowerCase();
  if (["markdown", "html", "docx", "pdf", "jsonld", "md"].includes(kind)) return false;
  const hint = String(slot.pathHint ?? slot.pathHints?.[0] ?? "").toLowerCase();
  if (/\.(md|html|jsonld?|docx|pdf|json)$/i.test(hint)) return false;
  if (/platform|成稿|article|zhihu|xiaohongshu|wechat|weibo|csdn/.test(hint)) return false;
  if (kind === "image" || kind === "png") return true;
  if (/slide-\d+\.png/i.test(hint)) return true;
  if (isContractPlaceholderPath(hint)) return true;
  return !hint || /\.(?:png|jpe?g|webp|svg)$/i.test(hint);
}

function expandLongformUnits(
  slot: SessionDeliverableSlot,
  count: number,
  scopeDir: string | null | undefined,
): ContractUnit[] {
  const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
  return Array.from({ length: count }, (_, index) => {
    const letter = letters[index] ?? String(index + 1);
    const fileName = `02-支柱长文${letter}.md`;
    const expectedPath = joinScopePath(scopeDir, fileName);
    return {
      unitId: `${slot.id}__${index + 1}`,
      slotId: slot.id,
      slotLabel: slot.label,
      expectedPath,
      expectedBasename: sdmBasename(expectedPath),
      kind: slot.kind ?? "markdown",
      required: slot.required !== false,
    };
  });
}

function expandSlideUnits(
  slot: SessionDeliverableSlot,
  count: number,
  scopeDir: string | null | undefined,
): ContractUnit[] {
  return Array.from({ length: count }, (_, index) => {
    const pageNum = index + 1;
    const padded = String(pageNum).padStart(2, "0");
    const fileName = `slide-${padded}.png`;
    const expectedPath = joinScopePath(scopeDir, fileName);
    return {
      unitId: `${slot.id}__slide_${pageNum}`,
      slotId: slot.id,
      slotLabel: slot.label,
      expectedPath,
      expectedBasename: fileName,
      kind: slot.kind ?? "image",
      required: slot.required !== false,
    };
  });
}

function compileSingleUnitPath(slot: SessionDeliverableSlot, scopeDir: string | null | undefined): string {
  const hints = [
    ...(Array.isArray(slot.pathHints) ? slot.pathHints : []),
    slot.pathHint,
  ].filter(Boolean) as string[];

  for (const raw of hints) {
    const hint = normalizeSdmPath(String(raw));
    if (!hint || isContractPlaceholderPath(hint)) continue;
    if (hint.includes("/")) return hint;
    return joinScopePath(scopeDir, hint);
  }
  return joinScopePath(scopeDir, `${slot.id}.deliverable`);
}

function appendUnitIndex(path: string, unitNumber: number): string {
  const normalized = normalizeSdmPath(path);
  const slashIndex = normalized.lastIndexOf("/");
  const directory = slashIndex >= 0 ? normalized.slice(0, slashIndex + 1) : "";
  const basename = slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
  const extensionIndex = basename.lastIndexOf(".");
  if (extensionIndex <= 0) return `${directory}${basename}-${unitNumber}`;
  return `${directory}${basename.slice(0, extensionIndex)}-${unitNumber}${basename.slice(extensionIndex)}`;
}

function compileCountUnitPath(
  slot: SessionDeliverableSlot,
  index: number,
  scopeDir: string | null | undefined,
): string {
  const indexedHint = Array.isArray(slot.pathHints) ? slot.pathHints[index] : undefined;
  const firstHint = Array.isArray(slot.pathHints) ? slot.pathHints[0] : undefined;
  const directHint = indexedHint ?? (index === 0 ? slot.pathHint ?? firstHint : undefined);
  const normalizedDirect = normalizeSdmPath(String(directHint ?? ""));
  if (normalizedDirect && !isContractPlaceholderPath(normalizedDirect)) {
    return normalizedDirect.includes("/")
      ? normalizedDirect
      : joinScopePath(scopeDir, normalizedDirect);
  }

  const seed = normalizeSdmPath(String(firstHint ?? slot.pathHint ?? ""));
  if (seed && !isContractPlaceholderPath(seed)) {
    const uniqueHint = appendUnitIndex(seed, index + 1);
    return uniqueHint.includes("/")
      ? uniqueHint
      : joinScopePath(scopeDir, uniqueHint);
  }
  return joinScopePath(scopeDir, `${slot.id}-${index + 1}.deliverable`);
}

function dedupeSlotPathHints(slot: SessionDeliverableSlot): SessionDeliverableSlot {
  if (!Array.isArray(slot.pathHints) || slot.pathHints.length < 2) return slot;
  const seen = new Set<string>();
  const pathHints = slot.pathHints.filter((rawHint) => {
    const key = normalizeSdmPath(String(rawHint ?? "")).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return pathHints.length === slot.pathHints.length ? slot : { ...slot, pathHints };
}

/** Expand SDM slots into atomic contract units (count slots -> N concrete paths). */
export function expandSlotsToContractUnits(
  manifest: SessionDeliverableManifest,
  scopeDir?: string | null,
): ContractUnit[] {
  const units: ContractUnit[] = [];
  const resolvedScope = scopeDir ?? manifest.taskArtifactDir ?? null;

  for (const sourceSlot of activeRequiredSlots(manifest)) {
    const slot = dedupeSlotPathHints(sourceSlot);
    const count = typeof slot.count === "number" && slot.count > 1 ? slot.count : 1;
    if (count > 1 && isLongformCountSlot(slot)) {
      units.push(...expandLongformUnits(slot, count, resolvedScope));
      continue;
    }
    if (count > 1 && shouldExpandCountAsSlideDeck(slot)) {
      units.push(...expandSlideUnits(slot, count, resolvedScope));
      continue;
    }
    if (count > 1) {
      for (let index = 0; index < count; index += 1) {
        const expectedPath = compileCountUnitPath(slot, index, resolvedScope);
        units.push({
          unitId: `${slot.id}__${index + 1}`,
          slotId: slot.id,
          slotLabel: slot.label,
          expectedPath,
          expectedBasename: sdmBasename(expectedPath),
          kind: slot.kind,
          required: slot.required !== false,
        });
      }
      continue;
    }

    const expectedPath = compileSingleUnitPath(slot, resolvedScope);
    units.push({
      unitId: slot.id,
      slotId: slot.id,
      slotLabel: slot.label,
      expectedPath,
      expectedBasename: sdmBasename(expectedPath),
      kind: slot.kind,
      required: slot.required !== false,
    });
  }

  return units;
}

function collectEvidencePaths(input: BindContractUnitsInput): string[] {
  const merged = [
    ...(input.verifiedPaths ?? []),
    ...(input.diskPaths ?? []),
  ];
  const unique = [...new Set(merged.map(normalizeSdmPath).filter(Boolean))];
  const filtered = filterVerifiedForContractBinding(unique, { scopeDir: input.scopeDir })
    .filter((path) => isRealArtifactDeliverablePath(path))
    .filter((path) => !isContractPlaceholderPath(path))
    .filter((path) => !isRepairPlaceholderDeliverablePath(path))
    .filter((path) => !isProcessDeliverablePath(path))
    .filter((path) => isRepairEligiblePath(path))
    .filter((path) => pathUnderScope(path, input.scopeDir));

  return filtered.slice(0, MAX_CONTRACT_EVIDENCE);
}

function slotPathHints(slot: SdmSlotLike): string[] {
  const hints: string[] = [];
  if (Array.isArray(slot.pathHints)) {
    for (const raw of slot.pathHints) {
      const normalized = normalizeSdmPath(String(raw ?? ""));
      if (normalized && !isContractPlaceholderPath(normalized)) {
        hints.push(normalized);
      }
    }
  }
  for (const raw of [slot.pathHint, slot.path]) {
    const normalized = normalizeSdmPath(String(raw ?? ""));
    if (normalized && !isContractPlaceholderPath(normalized) && !hints.some((h) => pathsEqual(h, normalized))) {
      hints.unshift(normalized);
    }
  }
  return hints;
}

function scoreEvidenceForUnit(
  unit: ContractUnit,
  slot: SessionDeliverableSlot,
  evidencePath: string,
): ContractMatchTier | null {
  const path = normalizeSdmPath(evidencePath);
  if (!path || isContractPlaceholderPath(path)) return null;

  if (pathsEqual(path, unit.expectedPath)) return "exact";

  for (const hint of slotPathHints(slot)) {
    if (pathsEqual(path, hint)) return "exact";
    const hintBase = sdmBasename(hint);
    const pathBase = sdmBasename(path);
    if (pathBase.toLowerCase() === hintBase.toLowerCase()) return "basename";
    if (deliverableBasenamesMatch(pathBase, hintBase, { tier0Profile: true })) return "basename";
    if (pathBase.toLowerCase() === unit.expectedBasename.toLowerCase()) return "basename";
  }

  if (sdmBasename(path).toLowerCase() === unit.expectedBasename.toLowerCase()) {
    return "basename";
  }

  for (const pattern of slotMatchPatterns(slot)) {
    if (pattern.test(path) || pattern.test(sdmBasename(path))) return "pattern";
  }
  const campaign = CAMPAIGN_SLOT_PATTERNS[slot.id];
  if (campaign && (campaign.test(path) || campaign.test(sdmBasename(path)))) return "pattern";

  if (pathSatisfiesSdmSlot(path, slot)) {
    if (kindMatchAllowed(slot) && unit.kind && pathMatchesKind(path, unit.kind)) return "kind";
    if (pathSatisfiesSdmSlot(path, { ...slot, pathHint: unit.expectedPath })) return "pattern";
    return "pattern";
  }

  if (kindMatchAllowed(slot) && unit.kind && pathMatchesKind(path, unit.kind)) return "kind";
  return null;
}

function buildSlotSummaries(
  units: ContractUnit[],
  bindings: ContractUnitBinding[],
  slots: SessionDeliverableSlot[],
): ContractSlotBindingSummary[] {
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  const bindingsBySlot = new Map<string, ContractUnitBinding[]>();
  for (const binding of bindings) {
    const bucket = bindingsBySlot.get(binding.slotId) ?? [];
    bucket.push(binding);
    bindingsBySlot.set(binding.slotId, bucket);
  }

  const slotIds = [...new Set(units.map((unit) => unit.slotId))];
  return slotIds.map((slotId) => {
    const slot = slotById.get(slotId);
    const slotUnits = units.filter((unit) => unit.slotId === slotId);
    const slotBindings = bindingsBySlot.get(slotId) ?? [];
    const resolvedPaths = slotBindings
      .filter((binding) => binding.matched && binding.evidencePath)
      .map((binding) => binding.evidencePath as string);
    return {
      slotId,
      label: slot?.label ?? slotId,
      required: slot?.required !== false,
      requiredCount: slotUnits.length,
      matchedCount: slotBindings.filter((binding) => binding.matched).length,
      resolvedPaths,
    };
  });
}

/**
 * Strict one-file-one-unit binding. Only verified/disk evidence counts;
 * slot.status=done and slot.resolvedPath alone are never evidence.
 */
export function bindContractUnitsStrict(input: BindContractUnitsInput): ContractBindingResult {
  const scopeDir = input.scopeDir ?? input.manifest.taskArtifactDir ?? null;
  const units = expandSlotsToContractUnits(input.manifest, scopeDir);
  const evidencePaths = collectEvidencePaths(input);
  const activeSlots = activeRequiredSlots(input.manifest);
  const slotById = new Map(activeSlots.map((slot) => [slot.id, slot]));

  if (units.length > MAX_CONTRACT_UNITS) {
    return {
      complete: false,
      incompleteReason: `contract_unit_budget_exceeded:${units.length}>${MAX_CONTRACT_UNITS}`,
      requiredCount: units.length,
      matchedCount: 0,
      units,
      bindings: units.map((unit) => ({
        unitId: unit.unitId,
        slotId: unit.slotId,
        matched: false,
      })),
      slotSummaries: buildSlotSummaries(units, [], activeSlots),
      usedEvidencePaths: [],
    };
  }

  if (evidencePaths.length >= MAX_CONTRACT_EVIDENCE) {
    const overflowSource = [
      ...(input.verifiedPaths ?? []),
      ...(input.diskPaths ?? []),
    ].length;
    if (overflowSource > MAX_CONTRACT_EVIDENCE) {
      return {
        complete: false,
        incompleteReason: `evidence_budget_exceeded:${overflowSource}>${MAX_CONTRACT_EVIDENCE}`,
        requiredCount: units.length,
        matchedCount: 0,
        units,
        bindings: units.map((unit) => ({
          unitId: unit.unitId,
          slotId: unit.slotId,
          matched: false,
        })),
        slotSummaries: buildSlotSummaries(units, [], activeSlots),
        usedEvidencePaths: [],
      };
    }
  }

  const usedEvidence = new Set<string>();
  const bindings: ContractUnitBinding[] = [];

  for (const unit of units) {
    const slot = slotById.get(unit.slotId);
    if (!slot) {
      bindings.push({ unitId: unit.unitId, slotId: unit.slotId, matched: false });
      continue;
    }

    let bestPath: string | undefined;
    let bestTier: ContractMatchTier | undefined;
    let bestRank = Number.POSITIVE_INFINITY;

    for (const evidencePath of evidencePaths) {
      const key = evidencePath.toLowerCase();
      if (usedEvidence.has(key)) continue;
      const tier = scoreEvidenceForUnit(unit, slot, evidencePath);
      if (!tier) continue;
      const rank = TIER_RANK[tier];
      if (rank < bestRank || (rank === bestRank && evidencePath.length > (bestPath?.length ?? 0))) {
        bestRank = rank;
        bestTier = tier;
        bestPath = evidencePath;
      }
    }

    if (bestPath && bestTier) {
      usedEvidence.add(bestPath.toLowerCase());
      bindings.push({
        unitId: unit.unitId,
        slotId: unit.slotId,
        evidencePath: bestPath,
        matchTier: bestTier,
        matched: true,
      });
    } else {
      bindings.push({ unitId: unit.unitId, slotId: unit.slotId, matched: false });
    }
  }

  const matchedCount = bindings.filter((binding) => binding.matched).length;
  const requiredCount = units.length;
  const slotSummaries = buildSlotSummaries(units, bindings, activeSlots);
  const complete = requiredCount > 0
    ? matchedCount >= requiredCount
    : matchedCount === 0;

  return {
    complete,
    incompleteReason: complete ? undefined : `unbound_units:${requiredCount - matchedCount}`,
    requiredCount,
    matchedCount,
    units,
    bindings,
    slotSummaries,
    usedEvidencePaths: [...usedEvidence],
  };
}

