/**
 * PD-SAAS-FORK: project memory continuity helpers (turn summary + settings gate).
 */
import type { PilotMemoryConfig } from "../pilot/config/types.js";

const MEMORY_OPT_OUT_PATTERNS = [
  /不要记/,
  /别记/,
  /不要写入记忆/,
  /别写入记忆/,
  /不要记录/,
  /别记录到记忆/,
  /do not remember/i,
  /don't remember/i,
  /do not save (?:this )?to memory/i,
];

export function isUserOptOutMemoryText(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  return MEMORY_OPT_OUT_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isProjectContinuityConfigEnabled(memory?: PilotMemoryConfig): boolean {
  if (!memory?.enabled) return false;
  return memory.projectContinuity?.enabled !== false;
}

/** Platform yaml + optional per-user SaaS preference (undefined/true => on). */
export function isProjectContinuityEffective(
  memory: PilotMemoryConfig | undefined,
  userPreference?: boolean | null,
): boolean {
  if (!isProjectContinuityConfigEnabled(memory)) return false;
  if (userPreference === false) return false;
  return true;
}

export type TurnSummaryContext = {
  anchorUserText: string;
  assistantDeliveryText: string;
  deliverablePaths: string[];
  optOut: boolean;
};
