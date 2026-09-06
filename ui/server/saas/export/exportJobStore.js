// PD-SAAS-FORK: async document export job storage (Redis + memory fallback)
import { cacheDel, cacheGet, cacheSet } from '../cache/redisClient.js';

const JOB_TTL_SEC = 3600;

/**
 * @param {string} tenantId
 * @param {string} userId
 * @param {string} jobId
 */
export function exportJobKey(tenantId, userId, jobId) {
  const t = tenantId || 'default';
  const u = userId || '0';
  return `nova:export:t:${t}:u:${u}:job:${jobId}`;
}

/**
 * @param {string} key
 * @param {Record<string, unknown>} job
 */
export async function saveExportJob(key, job) {
  await cacheSet(key, job, JOB_TTL_SEC);
}

/**
 * @param {string} key
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function loadExportJob(key) {
  const raw = await cacheGet(key);
  return raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : null;
}

/**
 * @param {string} key
 */
export async function deleteExportJob(key) {
  await cacheDel(key);
}

/** Serial export queue — Playwright / OCR should not run in parallel */
let exportChain = Promise.resolve();

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export function enqueueExportJob(fn) {
  const run = exportChain.then(fn, fn);
  exportChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function resetExportQueueForTests() {
  exportChain = Promise.resolve();
}
