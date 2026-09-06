import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PilotYixiaoerToolConfig } from "./types.js";

/** Default YiXiaoEr Open API base (matches skills/yixiaoer/scripts/api.ts). */
export const YIXIAOER_DEFAULT_API_URL = "https://www.yixiaoer.cn/api";

/** Locate PilotDeck install root (contains scripts/yixiaoer-api.mjs). */
export function resolvePilotDeckRepoRoot(candidates: string[] = []): string | undefined {
  const defaults = [
    process.env.PILOTDECK_REPO_ROOT,
    process.env.PILOTDECK_APP_ROOT,
    resolve(fileURLToPath(new URL("../../../..", import.meta.url))),
  ].filter((value): value is string => Boolean(value?.trim()));

  for (const root of [...candidates, ...defaults]) {
    const resolved = resolve(root);
    if (
      existsSync(join(resolved, "scripts", "yixiaoer-api.mjs")) ||
      existsSync(join(resolved, "scripts", "aigeo-api.mjs"))
    ) {
      return resolved;
    }
  }
  return undefined;
}

/**
 * Inject `YIXIAOER_*` env vars from `tools.yixiaoer` in pilotdeck.yaml.
 * Config values take precedence over existing process env when non-empty.
 */
export function applyYixiaoerToolEnv(
  env: Record<string, string | undefined>,
  yixiaoer: PilotYixiaoerToolConfig | undefined,
  credentialEnv: Record<string, string | undefined> = process.env,
): void {
  if (!yixiaoer && !credentialEnv.YIXIAOER_API_KEY?.trim()) {
    return;
  }

  const configKey = yixiaoer?.apiKey?.trim();
  const apiKey = configKey || credentialEnv.YIXIAOER_API_KEY?.trim();
  if (apiKey) {
    env.YIXIAOER_API_KEY = apiKey;
  }

  const configUrl = yixiaoer?.apiUrl?.trim();
  const apiUrl = configUrl || credentialEnv.YIXIAOER_API_URL?.trim();
  if (apiUrl) {
    env.YIXIAOER_API_URL = apiUrl;
  }
}

/** Resolve PilotDeck install paths so agents can call yixiaoer-api from any project cwd. */
export function applyYixiaoerToolPaths(
  env: Record<string, string | undefined>,
  options: { repoRoot?: string; pilotHome?: string } = {},
): void {
  const repoRoot = options.repoRoot?.trim();
  const pilotHome = options.pilotHome?.trim() || process.env.PILOTDECK_HOME?.trim();
  if (repoRoot) {
    const wrapper = `${repoRoot}/scripts/yixiaoer-api.mjs`.replace(/\\/g, "/");
    env.PILOTDECK_YIXIAOER_API = wrapper;
    const skillRepo = `${repoRoot}/skills/yixiaoer`.replace(/\\/g, "/");
    if (!env.PILOTDECK_YIXIAOER_SKILL_DIR) {
      env.PILOTDECK_YIXIAOER_SKILL_DIR = skillRepo;
    }
  }
  if (pilotHome) {
    const skillHome = `${pilotHome}/skills/yixiaoer`.replace(/\\/g, "/");
    if (typeof env.PILOTDECK_YIXIAOER_SKILL_DIR === "undefined") {
      env.PILOTDECK_YIXIAOER_SKILL_DIR = skillHome;
    }
  }
}
