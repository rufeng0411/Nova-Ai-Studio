#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Offline replay for G700 visual-binding eight-case fixtures.
 * Uses runDeliverableVisualBindingAudit — expectRepair=true => audit fails (needs_repair).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';

process.env.PILOTDECK_VISUAL_ASSET_PLATFORM = process.env.PILOTDECK_VISUAL_ASSET_PLATFORM || 'shadow';
process.env.PILOTDECK_VISUAL_BINDING_AUDIT = 'enforce';

const { G700_VISUAL_BINDING_EIGHT_CASES } = await import('../tests/fixtures/g700-visual-binding-eight-cases.ts');
const { runDeliverableVisualBindingAudit } = await import('../src/saas/media/visualAssetPlatform/deliverableVisualBindingAudit.ts');

const gate = process.argv.includes('--gate');

function buildManifest(row) {
  return {
    version: 1,
    sessionId: 'replay-eight',
    taskArtifactDir: row.taskArtifactDir,
    goalVersion: 1,
    sourceUrls: [],
    updatedAt: new Date().toISOString(),
    assets: row.manifestAssets.map((asset, index) => ({
      assetId: `va_${index}`,
      recommendedTier: 'none',
      role: 'product_hero',
      provenance: {},
      processingStatus: 'ok',
      source: asset.source,
      rawPath: asset.rawPath,
      ...(asset.preparedPath ? { preparedPath: asset.preparedPath } : {}),
    })),
    slotBindings: {},
    phase: 'phase_b',
    autoDiscoverTriggered: true,
    errors: [],
  };
}

async function replayCase(row) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'vap-eight-'));
  for (const relPath of row.verifiedPaths) {
    const absPath = path.join(root, relPath);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    const ext = path.extname(relPath).toLowerCase();
    if (ext === '.html' || ext === '.htm' || ext === '.md' || ext === '.markdown') {
      await fs.writeFile(absPath, row.htmlContent || '', 'utf8');
    } else {
      await fs.writeFile(absPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    }
  }

  const audit = await runDeliverableVisualBindingAudit({
    cwd: root,
    verifiedPaths: row.verifiedPaths,
    taskArtifactDir: row.taskArtifactDir,
    officialMediaRequired: true,
    manifest: buildManifest(row),
  });

  if (!audit) {
    return { pass: false, needsRepair: false, skipped: false, failures: [], reason: 'audit_null' };
  }

  const needsRepair = !audit.passed && audit.officialAssetCount > 0;
  const skipped = audit.officialAssetCount === 0;
  const pass = row.expectRepair ? needsRepair : (skipped || audit.passed);
  return { pass, needsRepair, skipped, failures: audit.failures, reason: pass ? 'ok' : 'mismatch' };
}

let passCount = 0;
for (const row of G700_VISUAL_BINDING_EIGHT_CASES) {
  const result = await replayCase(row);
  if (result.pass) passCount += 1;
  console.log(
    `[visual-binding-eight] ${result.pass ? 'PASS' : 'FAIL'} ${row.id} `
    + `expectRepair=${row.expectRepair} needsRepair=${result.needsRepair} `
    + `failures=${result.failures.length} reason=${result.reason}`,
  );
}

console.log(`[visual-binding-eight] ${passCount}/${G700_VISUAL_BINDING_EIGHT_CASES.length}`);
if (gate && passCount !== G700_VISUAL_BINDING_EIGHT_CASES.length) process.exit(1);
