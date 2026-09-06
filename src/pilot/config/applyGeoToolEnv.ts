import { existsSync } from "node:fs";
import { join } from "node:path";
import { resolvePilotDeckRepoRoot } from "./applyYixiaoerToolEnv.js";
import type { PilotGeoToolConfig } from "./types.js";

// PD-SAAS-FORK: tools.geo env injection for geo_api

/**
 * Inject GEO tool paths and shared search keys from `tools.geo` / web search config.
 * GEO verify uses Bocha (BOCHA_API_KEY) or agent-led web_search — not Perplexity.
 */
export function applyGeoToolEnv(
  env: NodeJS.ProcessEnv,
  geo: PilotGeoToolConfig | undefined,
  credentialEnv: NodeJS.ProcessEnv = env,
): void {
  const repoRoot = resolvePilotDeckRepoRoot([process.cwd()]);
  if (repoRoot) {
    const wrapper = `${join(repoRoot, "scripts", "aigeo-api.mjs")}`.replace(/\\/g, "/");
    env.PILOTDECK_GEO_API = wrapper;
    const skillRepo = `${join(repoRoot, "skills", "pd-geo")}`.replace(/\\/g, "/");
    if (existsSync(skillRepo)) {
      env.PILOTDECK_GEO_SKILL_DIR = skillRepo;
    }
  }

  const bocha =
    geo?.bochaApiKey?.trim()
    || credentialEnv.BOCHA_API_KEY?.trim()
    || credentialEnv.PILOTDECK_BOCHA_API_KEY?.trim();
  if (bocha) {
    env.BOCHA_API_KEY = bocha;
  }

  const dataDir = geo?.dataDir?.trim();
  if (dataDir) {
    env.PILOTDECK_GEO_DATA_DIR = dataDir;
  }
}
