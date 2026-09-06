/** Timeout / retry / circuit / idempotency for outbound notify. */

const DEFAULT_TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;
const CIRCUIT_FAILS = 3;
const COOLDOWN_MS = 60_000;
const IDEMPOTENCY_CAP = 256;

/** @type {Map<string, { fails: number, openUntil: number }>} */
const circuits = new Map();
/** @type {Map<string, { ok: boolean, at: number, result?: unknown }>} */
const idempotency = new Map();

export function resetResilienceForTests() {
  circuits.clear();
  idempotency.clear();
}

export function getTimeoutMs() {
  const n = Number(process.env.IM_NOTIFY_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
}

/**
 * @param {string} channel
 */
export function assertCircuitClosed(channel) {
  const state = circuits.get(channel);
  if (!state) return;
  if (Date.now() < state.openUntil) {
    const err = new Error(`通道 ${channel} 暂时熔断，请稍后重试`);
    err.code = 'circuit_open';
    err.retryable = true;
    throw err;
  }
}

/**
 * @param {string} channel
 * @param {boolean} hardFail
 */
export function recordCircuitOutcome(channel, hardFail) {
  if (!hardFail) {
    circuits.delete(channel);
    return;
  }
  const prev = circuits.get(channel) || { fails: 0, openUntil: 0 };
  const fails = prev.fails + 1;
  if (fails >= CIRCUIT_FAILS) {
    circuits.set(channel, { fails, openUntil: Date.now() + COOLDOWN_MS });
  } else {
    circuits.set(channel, { fails, openUntil: 0 });
  }
}

/**
 * @param {string | undefined} key
 * @returns {{ hit: boolean, result?: unknown }}
 */
export function idempotencyLookup(key) {
  if (!key) return { hit: false };
  const hit = idempotency.get(key);
  if (!hit) return { hit: false };
  return { hit: true, result: hit.result };
}

/**
 * @param {string | undefined} key
 * @param {unknown} result
 */
export function idempotencyStore(key, result) {
  if (!key) return;
  if (idempotency.size >= IDEMPOTENCY_CAP) {
    const first = idempotency.keys().next().value;
    if (first) idempotency.delete(first);
  }
  idempotency.set(key, { ok: true, at: Date.now(), result });
}

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ channel: string, retryable?: (err: unknown) => boolean }} opts
 */
export async function withRetry(fn, opts) {
  const { channel, retryable = defaultRetryable } = opts;
  assertCircuitClosed(channel);
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await fn();
      recordCircuitOutcome(channel, false);
      return result;
    } catch (err) {
      lastErr = err;
      const canRetry = retryable(err) && attempt < MAX_RETRIES;
      if (!canRetry) {
        const hard = !retryable(err);
        recordCircuitOutcome(channel, hard);
        throw err;
      }
      await sleep(200 * 2 ** attempt);
    }
  }
  recordCircuitOutcome(channel, true);
  throw lastErr;
}

/**
 * @param {string} url
 * @param {RequestInit} init
 * @param {number} [timeoutMs]
 */
export async function fetchWithTimeout(url, init = {}, timeoutMs = getTimeoutMs()) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } catch (err) {
    if (err?.name === 'AbortError') {
      const e = new Error('请求超时');
      e.code = 'timeout';
      e.retryable = true;
      throw e;
    }
    const e = err instanceof Error ? err : new Error(String(err));
    e.retryable = true;
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function defaultRetryable(err) {
  if (!err) return false;
  if (err.retryable === true) return true;
  if (err.code === 'timeout' || err.code === 'circuit_open') return true;
  const status = err.status ?? err.statusCode;
  if (typeof status === 'number') return status === 429 || status >= 500;
  return false;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
