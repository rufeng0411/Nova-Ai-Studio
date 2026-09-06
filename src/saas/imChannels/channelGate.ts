/** PD-SAAS-FORK: strip / reject enabled IM chat adapters when flag is off. */

import {
  canEnableImChannels,
  IM_CHAT_CHANNEL_KEYS,
  type ImChatChannelKey,
  resolveImChannelsFlag,
} from "./flags.js";

export type AdapterSlice = {
  enabled?: boolean;
  token?: string;
  apiKey?: string;
  webhookUrl?: string;
  extra?: Record<string, unknown>;
  [key: string]: unknown;
};

export type AdaptersPatch = Partial<
  Record<ImChatChannelKey, AdapterSlice | undefined>
>;

const MASK = "••••";

export function isMaskedSecret(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const s = value.trim();
  return s === MASK || s === "********" || /^\u2022{2,}|^\*{2,}|^•{2,}/.test(s) || s.includes("••••");
}

/**
 * When PILOTDECK_IM_CHANNELS=off, force enabled=false on wecom/dingtalk/whatsapp.
 * Returns { adapters, blockedEnable: string[] }.
 */
export function applyImChannelEnableGate(
  adapters: Record<string, unknown> | undefined,
  env: NodeJS.ProcessEnv = process.env,
): { adapters: Record<string, unknown>; blockedEnable: string[]; flag: string } {
  const flag = resolveImChannelsFlag(env);
  const next: Record<string, unknown> = { ...(adapters || {}) };
  const blockedEnable: string[] = [];
  const allow = canEnableImChannels(env);

  for (const key of IM_CHAT_CHANNEL_KEYS) {
    const cur = next[key];
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) {
      next[key] = { enabled: false };
      continue;
    }
    const slice = { ...(cur as AdapterSlice) };
    if (slice.enabled === true && !allow) {
      blockedEnable.push(key);
      slice.enabled = false;
    }
    if (slice.enabled !== true) slice.enabled = false;
    next[key] = slice;
  }
  return { adapters: next, blockedEnable, flag };
}

/** Mask secrets for GET responses. */
export function maskImChannelAdapters(
  adapters: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of IM_CHAT_CHANNEL_KEYS) {
    const cur = adapters?.[key];
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) {
      out[key] = { enabled: false };
      continue;
    }
    const slice = { ...(cur as AdapterSlice) };
    if (typeof slice.token === "string" && slice.token.trim()) {
      slice.token = MASK;
      slice.hasToken = true;
    } else {
      slice.hasToken = false;
    }
    if (typeof slice.apiKey === "string" && slice.apiKey.trim()) {
      slice.apiKey = MASK;
      slice.hasApiKey = true;
    }
    if (slice.extra && typeof slice.extra === "object") {
      const extra: Record<string, unknown> = { ...slice.extra };
      for (const [ek, ev] of Object.entries(extra)) {
        if (
          typeof ev === "string"
          && ev.trim()
          && /(secret|token|password|key)/i.test(ek)
        ) {
          extra[ek] = MASK;
          extra[`has_${ek}`] = true;
        }
      }
      slice.extra = extra;
    }
    slice.enabled = slice.enabled === true;
    out[key] = slice;
  }
  return out;
}

/**
 * Merge PUT body into previous adapters; preserve secrets when masked.
 */
export function mergeImChannelPut(
  previous: Record<string, unknown> | undefined,
  body: AdaptersPatch,
  env: NodeJS.ProcessEnv = process.env,
): { adapters: Record<string, unknown>; blockedEnable: string[]; flag: string } {
  const merged: Record<string, unknown> = { ...(previous || {}) };
  for (const key of IM_CHAT_CHANNEL_KEYS) {
    const patch = body[key];
    if (patch === undefined) continue;
    const prev = (merged[key] && typeof merged[key] === "object"
      ? { ...(merged[key] as AdapterSlice) }
      : { enabled: false }) as AdapterSlice;
    const next: AdapterSlice = { ...prev, ...patch };
    if (isMaskedSecret(patch.token)) next.token = prev.token;
    if (isMaskedSecret(patch.apiKey)) next.apiKey = prev.apiKey;
    if (patch.extra && typeof patch.extra === "object") {
      const prevExtra = (prev.extra && typeof prev.extra === "object"
        ? prev.extra
        : {}) as Record<string, unknown>;
      const nextExtra: Record<string, unknown> = { ...prevExtra };
      for (const [ek, ev] of Object.entries(patch.extra)) {
        if (isMaskedSecret(ev)) continue;
        nextExtra[ek] = ev;
      }
      next.extra = nextExtra;
    }
    merged[key] = next;
  }
  return applyImChannelEnableGate(merged, env);
}
