/**
 * PD-SAAS-FORK: Feature flags for history message read-path optimizations.
 */

function readBoolEnv(name: string): boolean | undefined {
  const raw = process.env[name]?.trim();
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  return undefined;
}

export function isHistorySanitizeEnabled(): boolean {
  const explicit = readBoolEnv("PILOTDECK_HISTORY_SANITIZE");
  if (explicit !== undefined) return explicit;
  return process.env.PILOTDECK_SAAS_MODE === "1";
}

export function isHistoryTailReadEnabled(): boolean {
  return readBoolEnv("PILOTDECK_HISTORY_TAIL_READ") === true;
}

export function isHistoryMessageCacheEnabled(): boolean {
  return readBoolEnv("PILOTDECK_HISTORY_MESSAGE_CACHE") === true;
}
