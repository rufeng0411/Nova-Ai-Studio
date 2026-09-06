#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Ensure native Redis + optional Docker PostgreSQL.
 *
 *   npm run dev:infra
 *   npm run dev:infra:down
 */
import {
  DEV_PG_URL,
  DEV_REDIS_URL,
  ensureDevInfra,
  isPgReachable,
  isRedisReachable,
  resolveDevPgUrl,
  runPgComposeDown,
} from './lib/devInfra.mjs';

const down = process.argv.includes('--down');

async function main() {
  if (down) {
    const ok = runPgComposeDown();
    process.exit(ok ? 0 : 1);
  }

  const status = await ensureDevInfra();
  const redis = status.redis || (await isRedisReachable());
  const postgres = status.postgres || (await isPgReachable());
  const pgUrl = postgres ? await resolveDevPgUrl() : DEV_PG_URL;

  console.log('[dev-infra] Redis:     ', redis ? `OK (${DEV_REDIS_URL})` : 'unavailable');
  console.log('[dev-infra] PostgreSQL:', postgres ? `OK (${pgUrl})` : 'unavailable');

  if (!redis) {
    process.exit(1);
  }
  if (!postgres && process.env.DEV_PG_REQUIRED === '1') {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[dev-infra] FAIL:', error instanceof Error ? error.message : error);
  process.exit(1);
});
