/**

 * PD-SAAS-FORK: dedupe + serialize deliverable validate fetches so N message rows

 * do not stampede Bridge and wedge the dev stack.

 */

import type { DeliverableItem } from './collectDeliverables';

import { normalizeHintDir } from '../../shared/deliverablePathResolve.mjs';

import {

  validateDeliverablesClient,

  type ValidatedDeliverable,

} from './validateDeliverables';



/** Pending-only cache entries expire so late-arriving files can re-validate. */

/** PD-SAAS-FORK fd7c166c: short pending TTL so Bridge pending does not stick「校验中」for 12s. */
export const DELIVERABLE_PENDING_CACHE_TTL_MS = 4_000;

/** PD-SAAS-FORK ES9 P1: minimum gap between Bridge validate calls. */
export const DELIVERABLE_VALIDATE_BACKPRESSURE_MS = 300;



/** Verified/delivered results may be cached longer within a session. */

export const DELIVERABLE_VERIFIED_CACHE_TTL_MS = 5 * 60_000;



type CacheEntry = {

  result: ValidatedDeliverable[];

  expiresAt: number;

};



export function buildDeliverableValidationCacheKey(

  projectName: string,

  items: DeliverableItem[],

  hintDir?: string,

): string {

  const paths = items

    .map((item) => `${item.apiPath || item.path}|${item.source}|${item.kind}`)

    .sort()

    .join('\n');

  const hint = normalizeHintDir(hintDir) ?? '';

  return `${projectName}\0${hint}\0${paths}`;

}



function isFullyVerified(result: ValidatedDeliverable[]): boolean {

  return result.length > 0 && result.every(

    (item) => item.validationStatus === 'verified'

      || item.validationStatus === 'softVerified'

      || (item.validationStatus === 'pending' && Boolean(item.resolvedPath)),

  );

}



function cacheTtlForResult(result: ValidatedDeliverable[]): number {

  if (isFullyVerified(result)) {

    return DELIVERABLE_VERIFIED_CACHE_TTL_MS;

  }

  const allPendingWithoutResolve = result.every(

    (item) => item.validationStatus === 'pending' && !item.resolvedPath,

  );

  if (allPendingWithoutResolve) {

    return DELIVERABLE_PENDING_CACHE_TTL_MS;

  }

  return DELIVERABLE_PENDING_CACHE_TTL_MS;

}



const resultCache = new Map<string, CacheEntry>();

const inflightByKey = new Map<string, Promise<ValidatedDeliverable[]>>();



let validateQueue: Promise<unknown> = Promise.resolve();

let lastValidateStartedAt = 0;



function enqueueValidate<T>(task: () => Promise<T>): Promise<T> {

  const run = async () => {

    const now = Date.now();

    const waitMs = Math.max(

      0,

      DELIVERABLE_VALIDATE_BACKPRESSURE_MS - (now - lastValidateStartedAt),

    );

    if (waitMs > 0) {

      await new Promise((resolve) => setTimeout(resolve, waitMs));

    }

    lastValidateStartedAt = Date.now();

    return task();

  };

  const next = validateQueue.then(run, run);

  validateQueue = next.catch(() => undefined);

  return next;

}



function readFreshCacheEntry(cacheKey: string): ValidatedDeliverable[] | undefined {

  const entry = resultCache.get(cacheKey);

  if (!entry) return undefined;

  if (Date.now() > entry.expiresAt) {

    resultCache.delete(cacheKey);

    return undefined;

  }

  return entry.result;

}



export function readCachedDeliverableValidation(

  cacheKey: string,

): ValidatedDeliverable[] | undefined {

  return readFreshCacheEntry(cacheKey);

}



export function fetchDeliverableValidationCached(

  projectName: string,

  items: DeliverableItem[],

  hintDir?: string,

): Promise<ValidatedDeliverable[]> {

  const cacheKey = buildDeliverableValidationCacheKey(projectName, items, hintDir);

  const cached = readFreshCacheEntry(cacheKey);

  if (cached) {

    return Promise.resolve(cached);

  }



  const inflight = inflightByKey.get(cacheKey);

  if (inflight) {

    return inflight;

  }



  const pending = enqueueValidate(() =>

    validateDeliverablesClient(projectName, items, { hintDir, hidePhantom: false }),

  )

    .then((result) => {

      const ttl = cacheTtlForResult(result);

      resultCache.set(cacheKey, {

        result,

        expiresAt: Date.now() + ttl,

      });

      inflightByKey.delete(cacheKey);

      return result;

    })

    .catch((error) => {

      inflightByKey.delete(cacheKey);

      throw error;

    });



  inflightByKey.set(cacheKey, pending);

  return pending;

}



/** Invalidate validation cache entries for a project (e.g. after HF re-render). */
export function invalidateDeliverableValidationForProject(projectName: string): void {
  const prefix = `${projectName}\0`;
  for (const key of resultCache.keys()) {
    if (key.startsWith(prefix)) {
      resultCache.delete(key);
      inflightByKey.delete(key);
    }
  }
}

/** Test-only */

export function clearDeliverableValidationCacheForTests(): void {

  resultCache.clear();

  inflightByKey.clear();

  validateQueue = Promise.resolve();

}


