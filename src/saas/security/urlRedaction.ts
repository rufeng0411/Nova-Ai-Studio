// PD-SAAS-FORK P0-3: unified URL redaction at durable persistence boundaries.

const URL_IN_TEXT = /\bhttps?:\/\/[^\s<>"'`]+/giu;

const SENSITIVE_QUERY_KEYS = new Set([
  "access_token",
  "accesstoken",
  "api_key",
  "apikey",
  "auth",
  "authorization",
  "awsaccesskeyid",
  "credential",
  "expires",
  "googleaccessid",
  "jwt",
  "key",
  "key-pair-id",
  "password",
  "passwd",
  "policy",
  "sas",
  "se",
  "secret",
  "sig",
  "signature",
  "sp",
  "sr",
  "sv",
  "token",
]);

function isSensitiveQueryKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    SENSITIVE_QUERY_KEYS.has(normalized)
    || normalized.startsWith("x-amz-")
    || normalized.startsWith("x-goog-")
    || normalized.endsWith("signature")
    || normalized.endsWith("_token")
    || normalized.endsWith("-token")
    || normalized.endsWith("_secret")
    || normalized.endsWith("-secret")
    || normalized.endsWith("_credential")
    || normalized.endsWith("-credential")
  );
}

function splitTrailingPunctuation(value: string): {
  candidate: string;
  trailing: string;
} {
  const match = value.match(/[),.;!?]+$/u);
  if (!match) return { candidate: value, trailing: "" };
  return {
    candidate: value.slice(0, -match[0].length),
    trailing: match[0],
  };
}

export function redactSensitiveUrl(value: string): string {
  const { candidate, trailing } = splitTrailingPunctuation(value);
  try {
    const parsed = new URL(candidate);
    parsed.username = "";
    parsed.password = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (isSensitiveQueryKey(key)) {
        parsed.searchParams.delete(key);
      }
    }
    return `${parsed.toString()}${trailing}`;
  } catch {
    const withoutCredentials = candidate.replace(
      /^(https?:\/\/)[^/@\s]+@/iu,
      "$1",
    );
    return `${withoutCredentials}${trailing}`;
  }
}

export function canonicalizeUrlForModel(value: string): string {
  const redacted = redactSensitiveUrl(value);
  try {
    const parsed = new URL(redacted);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return redacted;
  }
}

export function redactUrlsInText(value: string): string {
  if (!value.includes("://")) return value;
  return value.replace(URL_IN_TEXT, (url) => redactSensitiveUrl(url));
}

function sanitizeUnknown(
  value: unknown,
  seen: WeakMap<object, unknown>,
): unknown {
  if (typeof value === "string") return redactUrlsInText(value);
  if (
    value === null
    || typeof value !== "object"
    || value instanceof Date
    || value instanceof Uint8Array
  ) {
    return value;
  }
  const prior = seen.get(value);
  if (prior !== undefined) return prior;
  if (Array.isArray(value)) {
    const output: unknown[] = [];
    seen.set(value, output);
    for (const item of value) {
      output.push(sanitizeUnknown(item, seen));
    }
    return output;
  }

  const output: Record<string, unknown> = {};
  seen.set(value, output);
  for (const [key, nested] of Object.entries(value)) {
    output[key] = sanitizeUnknown(nested, seen);
  }
  return output;
}

export function sanitizeUrlsForPersistence<T>(value: T): T {
  return sanitizeUnknown(value, new WeakMap()) as T;
}

export function stringifySanitizedForPersistence(value: unknown): string {
  return JSON.stringify(sanitizeUrlsForPersistence(value));
}
