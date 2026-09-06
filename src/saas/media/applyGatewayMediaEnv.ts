// PD-SAAS-FORK: Gateway process.env parity with Bridge applyMediaToolsRuntimeEnv (video lane).

import type { PilotMediaToolConfig, PilotToolsConfig } from "../../pilot/config/types.js";

type CredentialEnv = NodeJS.ProcessEnv;

function trimEnv(value: string | undefined): string | undefined {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function resolveVideoApiKey(
  video: PilotMediaToolConfig | undefined,
  credentialEnv: CredentialEnv,
): string | undefined {
  const fromConfig = trimEnv(video?.apiKey);
  if (fromConfig) return fromConfig;
  return trimEnv(credentialEnv.PILOTDECK_VIDEO_API_KEY)
    ?? trimEnv(credentialEnv.DASHSCOPE_API_KEY)
    ?? trimEnv(credentialEnv.VOLCENGINE_API_KEY)
    ?? trimEnv(credentialEnv.VOLC_ARK_API_KEY)
    ?? trimEnv(credentialEnv.GOOGLE_API_KEY);
}

/**
 * Inject video media keys into Gateway process.env so generate_video / mediaStrategyResolver
 * see the same readiness as Bridge (tools.video + env fallbacks).
 */
export function applyGatewayMediaEnv(
  env: NodeJS.ProcessEnv,
  tools: PilotToolsConfig | undefined,
  credentialEnv: CredentialEnv = env,
): void {
  const video = tools?.video;
  const provider = trimEnv(video?.provider)
    ?? trimEnv(credentialEnv.PILOTDECK_VIDEO_PROVIDER)
    ?? "volcengine";
  const apiKey = resolveVideoApiKey(video, credentialEnv);
  const model = trimEnv(video?.model) ?? trimEnv(credentialEnv.PILOTDECK_VIDEO_MODEL);
  const baseUrl = trimEnv(video?.baseUrl) ?? trimEnv(credentialEnv.PILOTDECK_VIDEO_BASE_URL);

  env.PILOTDECK_MEDIA_STRATEGY_RESOLVER = "1";
  // PD-SAAS-FORK: creative prefer-generate_image — default shadow unless explicitly set.
  if (!trimEnv(env.PILOTDECK_PREFER_GENERATE_IMAGE) && !trimEnv(credentialEnv.PILOTDECK_PREFER_GENERATE_IMAGE)) {
    env.PILOTDECK_PREFER_GENERATE_IMAGE = "shadow";
  } else if (!trimEnv(env.PILOTDECK_PREFER_GENERATE_IMAGE)) {
    env.PILOTDECK_PREFER_GENERATE_IMAGE = trimEnv(credentialEnv.PILOTDECK_PREFER_GENERATE_IMAGE);
  }

  if (provider) env.PILOTDECK_VIDEO_PROVIDER = provider;
  if (apiKey) {
    env.PILOTDECK_VIDEO_API_KEY = apiKey;
    if (provider === "qwen" || /^sk-/i.test(apiKey)) {
      env.DASHSCOPE_API_KEY = apiKey;
    }
    if (provider === "volcengine") {
      env.VOLCENGINE_API_KEY = apiKey;
    }
    if (provider === "google") {
      env.GOOGLE_API_KEY = apiKey;
    }
  }
  if (model) env.PILOTDECK_VIDEO_MODEL = model;
  if (baseUrl) env.PILOTDECK_VIDEO_BASE_URL = baseUrl;
}
