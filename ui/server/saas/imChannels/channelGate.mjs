/**
 * PD-SAAS-FORK: IM chat adapter enable gate + secret mask/merge (Bridge-side).
 */

export const IM_CHAT_CHANNEL_KEYS = ['wecom', 'dingtalk', 'whatsapp'];
const MASK = '••••';

export function resolveImChannelsFlag(env = process.env) {
  const raw = String(env.PILOTDECK_IM_CHANNELS || 'off').trim().toLowerCase();
  if (raw === '1' || raw === 'true' || raw === 'enforce') return 'enforce';
  if (raw === 'shadow') return 'shadow';
  return 'off';
}

export function canEnableImChannels(env = process.env) {
  return resolveImChannelsFlag(env) !== 'off';
}

export function isMaskedSecret(value) {
  if (typeof value !== 'string') return false;
  const s = value.trim();
  return s === MASK || s === '********' || s.includes('••••');
}

export function applyImChannelEnableGate(adapters, env = process.env) {
  const flag = resolveImChannelsFlag(env);
  const next = { ...(adapters || {}) };
  const blockedEnable = [];
  const allow = canEnableImChannels(env);

  for (const key of IM_CHAT_CHANNEL_KEYS) {
    const cur = next[key];
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) {
      next[key] = { enabled: false };
      continue;
    }
    const slice = { ...cur };
    if (slice.enabled === true && !allow) {
      blockedEnable.push(key);
      slice.enabled = false;
    }
    if (slice.enabled !== true) slice.enabled = false;
    next[key] = slice;
  }
  return { adapters: next, blockedEnable, flag };
}

export function maskImChannelAdapters(adapters) {
  const out = {};
  for (const key of IM_CHAT_CHANNEL_KEYS) {
    const cur = adapters?.[key];
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) {
      out[key] = { enabled: false, hasToken: false };
      continue;
    }
    const slice = { ...cur };
    if (typeof slice.token === 'string' && slice.token.trim()) {
      slice.token = MASK;
      slice.hasToken = true;
    } else {
      slice.hasToken = false;
    }
    if (typeof slice.apiKey === 'string' && slice.apiKey.trim()) {
      slice.apiKey = MASK;
      slice.hasApiKey = true;
    }
    if (slice.extra && typeof slice.extra === 'object') {
      const extra = { ...slice.extra };
      for (const [ek, ev] of Object.entries(extra)) {
        if (typeof ev === 'string' && ev.trim() && /(secret|token|password|key)/i.test(ek)) {
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

export function mergeImChannelPut(previous, body, env = process.env) {
  const merged = { ...(previous || {}) };
  for (const key of IM_CHAT_CHANNEL_KEYS) {
    const patch = body?.[key];
    if (patch === undefined) continue;
    const prev = merged[key] && typeof merged[key] === 'object'
      ? { ...merged[key] }
      : { enabled: false };
    const next = { ...prev, ...patch };
    if (isMaskedSecret(patch.token)) next.token = prev.token;
    if (isMaskedSecret(patch.apiKey)) next.apiKey = prev.apiKey;
    if (patch.extra && typeof patch.extra === 'object') {
      const prevExtra = prev.extra && typeof prev.extra === 'object' ? prev.extra : {};
      const nextExtra = { ...prevExtra };
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
