/** PD-SAAS-FORK: IM notify MCP feature flag (off|shadow|enforce). */

export type ImNotifyFlagMode = "off" | "shadow" | "enforce";

export function resolveImNotifyMcpFlag(
  env: NodeJS.ProcessEnv = process.env,
): ImNotifyFlagMode {
  const raw = String(env.PILOTDECK_IM_NOTIFY_MCP || "off").trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "enforce") return "enforce";
  if (raw === "shadow") return "shadow";
  return "off";
}

export function isImNotifyMcpEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return resolveImNotifyMcpFlag(env) !== "off";
}
