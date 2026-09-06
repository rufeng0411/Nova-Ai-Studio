// PD-SAAS-FORK: model pool redundancy — up to 4 API keys per provider

export const MAX_PROVIDER_API_KEYS = 4;
export const MAX_STANDBY_MODEL_SLOTS = 4;
export const MAX_TOOL_CAPABILITY_FALLBACKS = 2;

export function normalizeProviderApiKeySlots(raw: {
  apiKey?: unknown;
  apiKeys?: unknown;
}): string[] {
  const primary = typeof raw.apiKey === "string" ? raw.apiKey.trim() : "";
  const extras = Array.isArray(raw.apiKeys)
    ? raw.apiKeys
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
  const merged = [primary, ...extras].filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const key of merged) {
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    if (out.length >= MAX_PROVIDER_API_KEYS) break;
  }
  return out;
}

/** Billing/account errors on key A may succeed on a backup key tied to another account. */
const API_KEY_ROTATION_MESSAGE_PATTERN =
  /Arrearage|overdue-payment|account is in good standing|账户.*欠费|欠费|InsufficientBalance|insufficient.?balance|insufficient.?quota/i;

export function isApiKeyRotationEligible(
  status: number | undefined,
  code: string | undefined,
  message?: string,
): boolean {
  if (status === 401 || status === 403 || status === 429) return true;
  if (code && /Arrearage|InsufficientBalance|insufficient.?quota/i.test(code)) return true;
  if (message && API_KEY_ROTATION_MESSAGE_PATTERN.test(message)) return true;
  if (!code) return false;
  return /auth|unauthorized|api.?key|rate.?limit|quota|throttl/i.test(code);
}

export function getProviderApiKeyChain(provider: {
  apiKey: string;
  alternateApiKeys?: string[];
}): string[] {
  const primary = provider.apiKey.trim();
  const extras = (provider.alternateApiKeys ?? []).map((key) => key.trim()).filter(Boolean);
  return normalizeProviderApiKeySlots({ apiKey: primary, apiKeys: extras });
}
