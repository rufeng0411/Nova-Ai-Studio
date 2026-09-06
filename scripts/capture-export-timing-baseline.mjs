#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Capture export_document timing baseline for full-chain-speed P1-5.
 * Writes artifacts/fullchain-speed/export-timing-baseline.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'fullchain-speed');
const OUT_FILE = path.join(OUT_DIR, 'export-timing-baseline.json');
const FIXTURES = path.join(REPO_ROOT, 'artifacts', 'document-export-fixtures');
const SOURCE = 'sample-report.md';

function runExport(format) {
  const source = path.join(FIXTURES, SOURCE);
  const output = path.join(OUT_DIR, `baseline-${format}.${format === 'docx' ? 'docx' : format}`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const started = Date.now();
  const script = `
import { routeExportDocument } from './dist/src/saas/document-export/router.js';
import { closePlaywrightPool } from './dist/src/saas/document-export/playwrightPool.js';
import { resolveDocumentExportConfig } from './dist/src/pilot/config/resolveDocumentToolConfig.js';
process.env.PILOTDECK_EXPORT_CLOSE_POOL = '1';
const result = await routeExportDocument({
  sourceAbsolutePath: ${JSON.stringify(source)},
  sourcePath: 'artifacts/document-export-fixtures/${SOURCE}',
  workspaceRoot: ${JSON.stringify(REPO_ROOT)},
  outputFormat: ${JSON.stringify(format)},
  outputAbsolutePath: ${JSON.stringify(output)},
  ctx: { cwd: ${JSON.stringify(REPO_ROOT)}, env: process.env, documentExport: resolveDocumentExportConfig(undefined, process.env) },
});
console.log(JSON.stringify({ ok: true, bytes: result?.bytes ?? 0 }));
await closePlaywrightPool();
`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 300_000,
  });
  const elapsedMs = Date.now() - started;
  if (result.status !== 0) {
    return { format, ok: false, elapsedMs, error: (result.stderr || result.stdout || '').slice(0, 400) };
  }
  return { format, ok: true, elapsedMs, output: path.relative(REPO_ROOT, output) };
}

function main() {
  const gen = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'generate-document-export-fixtures.mjs')], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (gen.status !== 0) {
    console.error(gen.stderr || gen.stdout);
    process.exit(1);
  }
  if (!fs.existsSync(path.join(REPO_ROOT, 'dist', 'src', 'saas', 'document-export', 'router.js'))) {
    const build = spawnSync('npm', ['run', 'build'], { cwd: REPO_ROOT, encoding: 'utf8', shell: true });
    if (build.status !== 0) process.exit(build.status ?? 1);
  }

  const serial = ['pdf', 'docx', 'pptx'].map(runExport);
  const okRows = serial.filter((r) => r.ok);
  const payload = {
    generatedAt: new Date().toISOString(),
    source: SOURCE,
    mode: 'serial',
    exports: serial,
    totalMs: serial.reduce((a, r) => a + r.elapsedMs, 0),
    medianMs: okRows.length
      ? okRows.map((r) => r.elapsedMs).sort((a, b) => a - b)[Math.floor(okRows.length / 2)]
      : null,
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`[export-timing-baseline] → ${path.relative(REPO_ROOT, OUT_FILE)} total=${payload.totalMs}ms median=${payload.medianMs}ms`);
  if (okRows.length < 3) process.exit(1);
}

main();
