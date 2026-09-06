// PD-SAAS-FORK: Prefer generate_image for creative visual scenes (off|shadow|enforce).

export type PreferGenerateImageMode = "off" | "shadow" | "enforce";

export type PreferGenerateImageEnv = Record<string, string | undefined>;

/**
 * PILOTDECK_PREFER_GENERATE_IMAGE=off|shadow|enforce
 * Default when unset: shadow (dev/pack inject explicitly).
 */
export function resolvePreferGenerateImageMode(
  env: PreferGenerateImageEnv = typeof process !== "undefined" ? process.env : {},
): PreferGenerateImageMode {
  const raw = String(env.PILOTDECK_PREFER_GENERATE_IMAGE ?? "shadow").trim().toLowerCase();
  if (raw === "0" || raw === "off" || raw === "false") return "off";
  if (raw === "1" || raw === "enforce" || raw === "on" || raw === "true") return "enforce";
  return "shadow";
}

export function isPreferGenerateImageEnabled(
  env: PreferGenerateImageEnv = typeof process !== "undefined" ? process.env : {},
): boolean {
  return resolvePreferGenerateImageMode(env) !== "off";
}

export function isPreferGenerateImageEnforce(
  env: PreferGenerateImageEnv = typeof process !== "undefined" ? process.env : {},
): boolean {
  return resolvePreferGenerateImageMode(env) === "enforce";
}
