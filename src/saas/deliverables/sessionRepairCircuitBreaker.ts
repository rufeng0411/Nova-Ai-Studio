// PD-SAAS-FORK (ROG Phase 7 G0): session-level repair circuit breaker (cross-turn).
import {
  normalizeRepairGapKey,
  buildRepairFastStopContinuePrompt,
} from "./repairStreakTracker.js";
import type { SessionDeliverableManifest } from "../taskState/sessionDeliverableManifest.js";
import { shouldSkipRepairGapForPptxAlias, shouldSkipRepairGapForGeoKeywordAlias } from "./reconcileDeliverableFacts.js";

export type SessionRepairCircuit = {
  gapCounts: Record<string, number>;
  totalRepairs: number;
  tripped?: boolean;
  /** PD-SAAS-FORK 0731-fail-B: verified count at last distill gap record (net-progress gate). */
  lastVerifiedCount?: number;
};

const DEFAULT_GAP_LIMIT = 3;
const DEFAULT_TOTAL_LIMIT = 6;
/** Distill main slot: same gap ≥3 with no verified net increase → trip (scoped). */
const DISTILL_MAIN_SLOT_RE = /authority_writing-style-distill_1/;
const DISTILL_GAP_LIMIT = 3;

function envFlagEnabled(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw == null) return fallback;
  const value = raw.trim().toLowerCase();
  if (value === "0" || value === "false" || value === "off") return false;
  if (value === "1" || value === "true" || value === "on") return true;
  return fallback;
}

export function isSessionRepairCircuitBreakerEnabled(): boolean {
  return envFlagEnabled("PILOTDECK_SESSION_REPAIR_CIRCUIT_BREAKER", true);
}

/** Strict mode: tripped circuit → needs_repair instead of passed (dev / R10 golden set). */
export function isRepairCircuitStrictEnabled(): boolean {
  return envFlagEnabled("PILOTDECK_REPAIR_CIRCUIT_STRICT", false);
}

function readGapLimit(): number {
  const raw = process.env.PILOTDECK_SESSION_REPAIR_GAP_LIMIT;
  const parsed = raw != null ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_GAP_LIMIT;
}

function readTotalLimit(): number {
  const raw = process.env.PILOTDECK_SESSION_REPAIR_TOTAL_LIMIT;
  const parsed = raw != null ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TOTAL_LIMIT;
}

export function readSessionRepairCircuit(
  manifest?: SessionDeliverableManifest | null,
): SessionRepairCircuit {
  const circuit = manifest?.repairCircuit;
  return {
    gapCounts: { ...(circuit?.gapCounts ?? {}) },
    totalRepairs: circuit?.totalRepairs ?? 0,
    tripped: Boolean(circuit?.tripped),
    lastVerifiedCount: typeof circuit?.lastVerifiedCount === "number"
      ? circuit.lastVerifiedCount
      : undefined,
  };
}

export type RecordRepairGapInput = {
  manifest?: SessionDeliverableManifest | null;
  missing: string[];
  broken: string[];
  sdmGapKey?: string;
  verified?: string[];
  userGoal?: string;
};

export type RecordRepairGapResult = {
  circuit: SessionRepairCircuit;
  tripped: boolean;
  gapKey: string;
};

function isDistillMainGap(gapKey: string, sdmGapKey?: string): boolean {
  return DISTILL_MAIN_SLOT_RE.test(gapKey) || DISTILL_MAIN_SLOT_RE.test(String(sdmGapKey ?? ""));
}

/** Increment cross-turn repair counters; returns tripped when limits exceeded. */
export function recordSessionRepairGap(input: RecordRepairGapInput): RecordRepairGapResult {
  const circuit = readSessionRepairCircuit(input.manifest);
  if (!isSessionRepairCircuitBreakerEnabled() || circuit.tripped) {
    return { circuit, tripped: circuit.tripped ?? false, gapKey: "" };
  }

  if (
    shouldSkipRepairGapForPptxAlias({
      missing: input.missing,
      verified: input.verified ?? [],
    })
  ) {
    return { circuit, tripped: false, gapKey: "" };
  }

  if (
    shouldSkipRepairGapForGeoKeywordAlias({
      missing: input.missing,
      verified: input.verified ?? [],
      sessionManifest: input.manifest ?? undefined,
    })
  ) {
    return { circuit, tripped: false, gapKey: "" };
  }

  const gapKey = normalizeRepairGapKey(input.missing, input.broken, input.sdmGapKey);
  if (!gapKey) {
    return { circuit, tripped: false, gapKey: "" };
  }

  const verifiedCount = (input.verified ?? []).length;
  const next: SessionRepairCircuit = {
    gapCounts: { ...circuit.gapCounts },
    totalRepairs: circuit.totalRepairs + 1,
    tripped: false,
    lastVerifiedCount: verifiedCount,
  };

  // PD-SAAS-FORK 0731-fail-B: distill main slot — trip only on same gap ≥3 with no verified net increase.
  // Campaign / IP global thresholds unchanged.
  if (isDistillMainGap(gapKey, input.sdmGapKey)) {
    const prevVerified = circuit.lastVerifiedCount;
    const noNetProgress = prevVerified == null || verifiedCount <= prevVerified;
    if (noNetProgress) {
      next.gapCounts[gapKey] = (circuit.gapCounts[gapKey] ?? 0) + 1;
    } else {
      next.gapCounts[gapKey] = 1;
    }
    if ((next.gapCounts[gapKey] ?? 0) >= DISTILL_GAP_LIMIT && noNetProgress) {
      next.tripped = true;
    }
    return { circuit: next, tripped: next.tripped ?? false, gapKey };
  }

  next.gapCounts[gapKey] = (next.gapCounts[gapKey] ?? 0) + 1;

  const gapLimit = readGapLimit();
  const totalLimit = readTotalLimit();
  if ((next.gapCounts[gapKey] ?? 0) >= gapLimit || next.totalRepairs >= totalLimit) {
    next.tripped = true;
  }

  return { circuit: next, tripped: next.tripped ?? false, gapKey };
}

export function mergeRepairCircuitIntoManifest(
  manifest: SessionDeliverableManifest,
  circuit: SessionRepairCircuit,
): SessionDeliverableManifest {
  return { ...manifest, repairCircuit: circuit };
}

export function buildCircuitBreakerContinuePrompt(verifiedCount: number, totalHint: number): string {
  return buildRepairFastStopContinuePrompt({
    verifiedCount,
    totalHint,
    reason: "会话级熔断：同一缺口多次修复未通过，已按现有成果降级完成",
  });
}
