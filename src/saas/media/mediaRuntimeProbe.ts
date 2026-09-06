// PD-SAAS-FORK: runtime readiness probes for builtin media tools.

export type MediaRuntimeEnv = Record<string, string | undefined>;

function readMediaRuntimeEnv(): MediaRuntimeEnv {
  if (typeof process !== "undefined" && process.env) {
    return process.env;
  }
  return {};
}

function readEnv(env: MediaRuntimeEnv, name: string): string | undefined {
  const value = String(env[name] ?? "").trim();
  return value.length > 0 ? value : undefined;
}

function hasApiKey(env: MediaRuntimeEnv, ...names: string[]): boolean {
  return names.some((name) => Boolean(readEnv(env, name)));
}

const VIDEO_MODEL_HINT =
  /wanx|happyhorse|seedance|veo|videogen|t2v|i2v|sora|seedream.*video/i;

export function isVideoApiReady(env?: MediaRuntimeEnv): boolean {
  const runtime = env ?? readMediaRuntimeEnv();
  if (readEnv(runtime, "PILOTDECK_VIDEO_API_READY") === "1") return true;
  const model = readEnv(runtime, "PILOTDECK_VIDEO_MODEL");
  const key = readEnv(runtime, "PILOTDECK_VIDEO_API_KEY")
    ?? readEnv(runtime, "DASHSCOPE_API_KEY")
    ?? readEnv(runtime, "VOLCENGINE_API_KEY")
    ?? readEnv(runtime, "GOOGLE_API_KEY");
  if (!key) return false;
  if (model) return true;
  return VIDEO_MODEL_HINT.test(String(runtime.PILOTDECK_VIDEO_PROVIDER ?? ""));
}

export function isTtsApiReady(env?: MediaRuntimeEnv): boolean {
  const runtime = env ?? readMediaRuntimeEnv();
  return Boolean(
    readEnv(runtime, "PILOTDECK_TTS_API_KEY")
      ?? readEnv(runtime, "DASHSCOPE_API_KEY"),
  );
}

export function isSpeechApiReady(env?: MediaRuntimeEnv): boolean {
  const runtime = env ?? readMediaRuntimeEnv();
  return Boolean(
    readEnv(runtime, "PILOTDECK_SPEECH_API_KEY")
      ?? readEnv(runtime, "DASHSCOPE_API_KEY"),
  );
}

export function isWondaReady(env?: MediaRuntimeEnv): boolean {
  const runtime = env ?? readMediaRuntimeEnv();
  return hasApiKey(runtime, "WONDA_API_KEY", "PILOTDECK_SKILL_WONDA_API_KEY");
}

export function isImageApiReady(env?: MediaRuntimeEnv): boolean {
  const runtime = env ?? readMediaRuntimeEnv();
  return Boolean(
    readEnv(runtime, "PILOTDECK_IMAGE_API_KEY")
      ?? readEnv(runtime, "DASHSCOPE_API_KEY")
      ?? readEnv(runtime, "GOOGLE_API_KEY")
      ?? readEnv(runtime, "VOLCENGINE_API_KEY"),
  );
}
