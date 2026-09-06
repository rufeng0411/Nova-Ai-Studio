// PD-SAAS-FORK: tools.resilience yaml section

import type { PilotConfigSnapshot } from "./types.js";

export type ResilienceConfig = {
  enabled: boolean;
  maxRecoveryBudgetPerTurn: number;
  /** Recoverable lane (tool/model/strategy); default 12 when unset. */
  recoverableMaxPerTurn: number;
  /** Hard-fail confirm lane (auth/billing/gateway); default 3. */
  hardFailMaxPerTurn: number;
  outboundMaxConcurrent: number;
  outboundFetchRetries: number;
  wsReconnectBaseMs: number;
  wsReconnectMaxMs: number;
  wsReconnectDebounceMs: number;
  /** When true, tightens auto_continue heuristics (default false for safe rollout). */
  autoContinueStrict: boolean;
  /** Block repeated identical tool hard failures in one turn. */
  toolFailureRepeatGuard: boolean;
  /** Max concurrent generate_image calls (0 = gate disabled). */
  imageMaxConcurrent: number;
  /** PD-SAAS-FORK: Phase 0 session catalog durability (SaaS). */
  sessionDurability: boolean;
  /** PD-SAAS-FORK: Phase 1 infra auto-continue via UI. */
  infraAutoContinue: boolean;
  /** PD-SAAS-FORK: Phase 2 JSONL turn_progress rows. */
  turnProgressEntries: boolean;
  /** PD-SAAS-FORK: Phase 4 deliverable validate-before-show. */
  deliverableValidation: boolean;
  /** PD-SAAS-FORK: Phase 4 hide text-only phantom deliverables in T2. */
  hidePhantomDeliverables: boolean;
};

export type ProcessUxConfig = {
  enabled: boolean;
  deadManGuidance: boolean;
  staleTurnWarnSec: number;
  staleTurnFallbackSec: number;
};

const DEFAULTS: ResilienceConfig = {
  enabled: true,
  maxRecoveryBudgetPerTurn: 8,
  recoverableMaxPerTurn: 12,
  hardFailMaxPerTurn: 3,
  outboundMaxConcurrent: 3,
  outboundFetchRetries: 1,
  wsReconnectBaseMs: 800,
  wsReconnectMaxMs: 30_000,
  wsReconnectDebounceMs: 300,
  autoContinueStrict: false,
  toolFailureRepeatGuard: true,
  imageMaxConcurrent: 2,
  sessionDurability: true,
  infraAutoContinue: true,
  turnProgressEntries: true,
  deliverableValidation: true,
  hidePhantomDeliverables: true,
};

const PROCESS_UX_DEFAULTS: ProcessUxConfig = {
  enabled: true,
  deadManGuidance: true,
  staleTurnWarnSec: 90,
  staleTurnFallbackSec: 180,
};

function readPositiveInt(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

function readNonNegativeInt(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

export function resolveResilienceConfig(
  snapshot?: Pick<PilotConfigSnapshot, "config"> | null,
): ResilienceConfig {
  const raw = (snapshot?.config as { tools?: { resilience?: Record<string, unknown> } } | undefined)
    ?.tools?.resilience;
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULTS };
  }
  return {
    enabled: raw.enabled !== false,
    maxRecoveryBudgetPerTurn: readPositiveInt(
      raw.maxRecoveryBudgetPerTurn,
      DEFAULTS.maxRecoveryBudgetPerTurn,
    ),
    recoverableMaxPerTurn: readPositiveInt(
      raw.recoverableMaxPerTurn,
      readPositiveInt(raw.maxRecoveryBudgetPerTurn, DEFAULTS.recoverableMaxPerTurn),
    ),
    hardFailMaxPerTurn: readPositiveInt(
      raw.hardFailMaxPerTurn,
      DEFAULTS.hardFailMaxPerTurn,
    ),
    outboundMaxConcurrent: readPositiveInt(
      raw.outboundMaxConcurrent,
      DEFAULTS.outboundMaxConcurrent,
    ),
    outboundFetchRetries: readPositiveInt(
      raw.outboundFetchRetries,
      DEFAULTS.outboundFetchRetries,
    ),
    wsReconnectBaseMs: readPositiveInt(raw.wsReconnectBaseMs, DEFAULTS.wsReconnectBaseMs),
    wsReconnectMaxMs: readPositiveInt(raw.wsReconnectMaxMs, DEFAULTS.wsReconnectMaxMs),
    wsReconnectDebounceMs: readPositiveInt(
      raw.wsReconnectDebounceMs,
      DEFAULTS.wsReconnectDebounceMs,
    ),
    autoContinueStrict: raw.autoContinueStrict === true,
    toolFailureRepeatGuard: raw.toolFailureRepeatGuard !== false,
    imageMaxConcurrent: readNonNegativeInt(raw.imageMaxConcurrent, DEFAULTS.imageMaxConcurrent),
    sessionDurability: raw.sessionDurability !== false,
    infraAutoContinue: raw.infraAutoContinue !== false,
    turnProgressEntries: raw.turnProgressEntries !== false,
    deliverableValidation: raw.deliverableValidation !== false,
    hidePhantomDeliverables: raw.hidePhantomDeliverables !== false,
  };
}

export function resolveProcessUxConfig(
  snapshot?: Pick<PilotConfigSnapshot, "config"> | null,
): ProcessUxConfig {
  const raw = (snapshot?.config as { tools?: { ui?: { processUx?: Record<string, unknown> } } } | undefined)
    ?.tools?.ui?.processUx;
  if (!raw || typeof raw !== "object") {
    if (process.env.PILOTDECK_PROCESS_UX === "0") {
      return { enabled: false, deadManGuidance: false, staleTurnWarnSec: 0, staleTurnFallbackSec: 0 };
    }
    return { ...PROCESS_UX_DEFAULTS };
  }
  return {
    enabled: raw.enabled !== false,
    deadManGuidance: raw.deadManGuidance !== false,
    staleTurnWarnSec: readPositiveInt(raw.staleTurnWarnSec, PROCESS_UX_DEFAULTS.staleTurnWarnSec),
    staleTurnFallbackSec: readPositiveInt(raw.staleTurnFallbackSec, PROCESS_UX_DEFAULTS.staleTurnFallbackSec),
  };
}
