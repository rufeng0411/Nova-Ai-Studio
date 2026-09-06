/** PD-SAAS-FORK: App IM chat channels flag (off|shadow|enforce). Default off. */

export type ImChannelsFlagMode = "off" | "shadow" | "enforce";

export const IM_CHAT_CHANNEL_KEYS = ["wecom", "dingtalk", "whatsapp"] as const;
export type ImChatChannelKey = (typeof IM_CHAT_CHANNEL_KEYS)[number];

export function resolveImChannelsFlag(
  env: NodeJS.ProcessEnv = process.env,
): ImChannelsFlagMode {
  const raw = String(env.PILOTDECK_IM_CHANNELS || "off").trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "enforce") return "enforce";
  if (raw === "shadow") return "shadow";
  return "off";
}

/** Whether adapters.*.enabled=true may be persisted / loaded. */
export function canEnableImChannels(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return resolveImChannelsFlag(env) !== "off";
}
