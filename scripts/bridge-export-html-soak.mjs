#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Bridge export/HTML soak — 10 sequential ready probes (503 gate).
 * Requires dev stack on SERVER_URL (Launcher Bridge 7990).
 */
const SERVER_URL = (process.env.SERVER_URL || process.env.PLAYWRIGHT_SERVER_URL || 'http://127.0.0.1:7990').replace(/\/$/, '');
const ITERATIONS = Number(process.env.BRIDGE_EXPORT_SOAK_ITERATIONS || 10);

async function probeOnce(i) {
  const url = `${SERVER_URL}/api/saas/health/ready`;
  const started = Date.now();
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const elapsed = Date.now() - started;
  const body = await res.text().catch(() => '');
  return { i, status: res.status, elapsed, ok: res.status !== 503, body: body.slice(0, 120) };
}

async function main() {
  const results = [];
  for (let i = 1; i <= ITERATIONS; i += 1) {
    try {
      results.push(await probeOnce(i));
    } catch (err) {
      results.push({ i, status: 0, elapsed: 0, ok: false, body: String(err?.message ?? err) });
    }
  }
  const failures = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ server: SERVER_URL, iterations: ITERATIONS, results, failures: failures.length }, null, 2));
  if (failures.length > 0) {
    console.error(`[bridge-export-html-soak] FAIL: ${failures.length}/${ITERATIONS} returned 503 or error`);
    process.exit(1);
  }
  console.log(`[bridge-export-html-soak] PASS: ${ITERATIONS}/${ITERATIONS} no 503`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
