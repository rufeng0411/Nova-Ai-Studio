// PD-SAAS-FORK: N2 Bot β steward — fail-closed flag + sessionKind guards.

export type N2BotMode = "off" | "shadow" | "enforce";
export type N2SessionKind = "n2_bot";

export function isN2BotMode(raw: string | undefined): N2BotMode {
  try {
    if (raw == null) return "off";
    const v = String(raw).trim().toLowerCase();
    if (v === "shadow") return "shadow";
    if (v === "enforce") return "enforce";
    if (v === "1" || v === "true" || v === "on") return "enforce";
    return "off";
  } catch {
    return "off";
  }
}

export function resolveN2BotModeFromEnv(
  env: NodeJS.Dict<string> = process.env,
): N2BotMode {
  try {
    return isN2BotMode(env.PILOTDECK_N2_BOT ?? env.PILOTDECK_JARVIS_BUTLER);
  } catch {
    return "off";
  }
}

export function isN2BotSession(kind?: string | null): boolean {
  return kind === "n2_bot";
}

/** Only an explicit n2_bot kind skips SDM / STDA / repair. Missing kind = worker. */
export function shouldSkipDeliverableContract(kind?: string | null): boolean {
  return kind === "n2_bot";
}

export function isN2BotHudEnabled(mode: N2BotMode): boolean {
  return mode === "shadow" || mode === "enforce";
}

export function isStewardChatQueueExempt(input: {
  sessionKind?: string | null;
  command?: string;
  options?: { sessionKind?: string | null; n2BotTier?: string };
}): boolean {
  const kind = input.sessionKind
    ?? input.options?.sessionKind
    ?? null;
  if (kind !== "n2_bot") return false;
  const tier = input.options?.n2BotTier;
  if (tier === "T3") return false;
  return true;
}
