#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Benchmark getProjects / catalog list latency.
 */
import { performance } from 'node:perf_hooks';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');

process.env.PILOTDECK_SAAS_MODE = '1';

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return Number(sorted[idx] ?? 0);
}

async function main() {
  const { openControlDatabase, closeControlDatabase } = await import('../ui/server/saas/db/control.js');
  const { catalogStore } = await import('../ui/server/saas/conversation/CatalogStore.js');
  const { bootstrapSaasControlPlane } = await import('../ui/server/saas/auth/bootstrap.js');

  const dataRoot = fs.mkdtempSync(path.join(process.env.TEMP || '/tmp', 'catalog-bench-'));
  process.env.DATA_ROOT = dataRoot;
  await bootstrapSaasControlPlane({ log: () => {} });
  const db = await openControlDatabase();
  const user = await db.queryOne('SELECT id, tenant_id FROM users WHERE username = ?', ['admin']);
  if (!user) throw new Error('admin user missing');

  for (let i = 0; i < 100; i += 1) {
    await catalogStore.upsert({
      tenantId: user.tenant_id,
      userId: user.id,
      sessionId: `web-s_bench-${String(i).padStart(4, '0')}`,
      legacyProjectId: 'general',
      transcriptRelPath: `projects/general/chats/web-s_bench-${String(i).padStart(4, '0')}.jsonl`,
      summary: `Bench session ${i}`,
      lastActivityAt: new Date().toISOString(),
    });
  }

  const samples = [];
  for (let i = 0; i < 20; i += 1) {
    const t0 = performance.now();
    await catalogStore.listByProject({
      tenantId: user.tenant_id,
      userId: user.id,
      legacyProjectId: 'general',
      limit: 5,
      offset: 0,
    });
    samples.push(performance.now() - t0);
  }

  if (samples.length === 0) {
    throw new Error('no benchmark samples collected');
  }

  const p50 = percentile(samples, 50);
  const p95 = percentile(samples, 95);
  const report = `# Conversation catalog performance baseline

- Samples: ${samples.length}
- listByProject p50: ${p50.toFixed(2)} ms
- listByProject p95: ${p95.toFixed(2)} ms
- At: ${new Date().toISOString()}
`;
  const out = path.join(REPO, 'docs', `conversation-catalog-perf-baseline-${new Date().toISOString().slice(0, 10)}.md`);
  fs.writeFileSync(out, report, 'utf8');
  console.log(report);
  console.log(`[benchmark] wrote ${out}`);

  await closeControlDatabase();
  fs.rmSync(dataRoot, { recursive: true, force: true });
}

main().catch((error) => {
  console.error('[benchmark] FAIL:', error);
  process.exit(1);
});
