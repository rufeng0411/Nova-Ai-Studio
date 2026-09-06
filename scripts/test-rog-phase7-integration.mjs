#!/usr/bin/env node
/** PD-SAAS-FORK (ROG Phase 7): fixture replay — reconcile pipeline + profile + circuit breaker. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  reconcileMissingPaths,
  stripCampaignPngMissingWhenHtmlVerified,
} from '../src/saas/deliverables/reconcileMissingPaths.ts';
import {
  satisfyPresentationPptxAlias,
  dedupeVerifiedBrokenOverlap,
  novaDeckCompletePass,
} from '../src/saas/deliverables/reconcileDeliverableFacts.ts';
import { resolveProfile } from '../src/saas/deliverableCapabilityProfiles.ts';
import { recordSessionRepairGap } from '../src/saas/deliverables/sessionRepairCircuitBreaker.ts';
import { sanitizeSessionGoalAnchor } from '../src/saas/taskState/sessionDeliverableManifest.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = path.join(root, 'tests', 'fixtures', 'task-recovery');
const files = fs.readdirSync(fixtureDir).filter((f) => f.startsWith('rog-') && f.endsWith('.json'));

let failed = 0;

async function writeNovaDeckFixture(deckDir, pageCount) {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'rog-fixture-'));
  const manifestPath = `${deckDir}/slide-manifest.json`;
  const pages = Array.from({ length: pageCount }, (_, i) => ({
    image_path: `slide-${String(i + 1).padStart(2, '0')}.png`,
  }));
  await fs.promises.mkdir(path.join(tmp, deckDir), { recursive: true });
  await fs.promises.writeFile(
    path.join(tmp, manifestPath),
    JSON.stringify({ pages, aspect_ratio: '16:9' }),
  );
  for (const page of pages) {
    await fs.promises.writeFile(
      path.join(tmp, deckDir, page.image_path),
      Buffer.alloc(256, 1),
    );
  }
  return { tmp, manifestPath, pages, deckDir };
}

for (const file of files) {
  const fx = JSON.parse(fs.readFileSync(path.join(fixtureDir, file), 'utf8'));

  if (fx.expectedProfileId) {
    const profile = resolveProfile(fx.capabilitySlug, undefined, fx.userGoal);
    if (profile.id !== fx.expectedProfileId) {
      console.error(`[fail] ${file}: profile ${profile.id} !== ${fx.expectedProfileId}`);
      failed += 1;
    }
  }

  if (fx.missingPaths && fx.verifiedPaths && fx.expectMissingAfterReconcile !== undefined) {
    let reconciled = reconcileMissingPaths({
      missing: fx.missingPaths,
      verified: fx.verifiedPaths,
    });
    reconciled = satisfyPresentationPptxAlias({ missing: reconciled, verified: fx.verifiedPaths });
    if (fx.expectCampaignPngDegrade) {
      reconciled = stripCampaignPngMissingWhenHtmlVerified({
        missing: reconciled,
        verified: fx.verifiedPaths,
      });
    }
    const expected = fx.expectMissingAfterReconcile ?? [];
    if (JSON.stringify(reconciled) !== JSON.stringify(expected)) {
      console.error(`[fail] ${file}: missing reconcile ${JSON.stringify(reconciled)} !== ${JSON.stringify(expected)}`);
      failed += 1;
    }
  }

  if (fx.expectPptxAliasSatisfied) {
    const after = satisfyPresentationPptxAlias({
      missing: fx.missingPaths ?? [],
      verified: fx.verifiedPaths ?? [],
    });
    if (after.length !== 0) {
      console.error(`[fail] ${file}: pptx alias not satisfied`);
      failed += 1;
    }
  }

  if (fx.expectBrokenAfterDedupeOnDisk && fx.verifiedPaths && fx.brokenPaths) {
    const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'rog-dedupe-fix-'));
    for (const rel of fx.verifiedPaths) {
      if (!/\.png$/i.test(rel)) continue;
      const abs = path.join(tmp, rel);
      await fs.promises.mkdir(path.dirname(abs), { recursive: true });
      await fs.promises.writeFile(abs, Buffer.alloc(128, 1));
    }
    const broken = await dedupeVerifiedBrokenOverlap({
      cwd: tmp,
      verified: fx.verifiedPaths,
      broken: fx.brokenPaths,
    });
    if (broken.length !== 0) {
      console.error(`[fail] ${file}: broken dedupe ${JSON.stringify(broken)}`);
      failed += 1;
    }
  }

  if (fx.deckFixture) {
    const { tmp, manifestPath, pages, deckDir } = await writeNovaDeckFixture(
      fx.deckFixture.deckDir,
      fx.deckFixture.pageCount,
    );
    const verified = [manifestPath, ...pages.map((p) => `${deckDir}/${p.image_path}`)];
    const novaPass = await novaDeckCompletePass({
      cwd: tmp,
      userGoal: fx.userGoal,
      capabilitySlug: fx.capabilitySlug,
      verified,
      missing: [],
      broken: verified.filter((p) => /\.png$/i.test(p)),
    });
    if (novaPass.broken.length !== 0 || !novaPass.failuresDropped) {
      console.error(`[fail] ${file}: novaDeckCompletePass did not clear deck`);
      failed += 1;
    }
  }

  if (fx.expectedGapRecordsBeforeTrip) {
    let manifest = { manifestVersion: 2, goalVersion: 1, sessionGoalAnchor: fx.userGoal ?? 'ppt' };
    let tripped = false;
    for (let i = 0; i < fx.expectedGapRecordsBeforeTrip; i += 1) {
      const result = recordSessionRepairGap({
        manifest,
        missing: fx.missingPaths ?? [],
        broken: fx.brokenPaths ?? [],
        verified: fx.verifiedPaths ?? [],
      });
      manifest = { ...manifest, repairCircuit: result.circuit };
      tripped = result.tripped;
    }
    if (fx.expectedAcceptance === 'passed' && !tripped) {
      console.error(`[fail] ${file}: circuit breaker did not trip`);
      failed += 1;
    }
  }

  if (fx.anchorPollutionSample) {
    const sanitized = sanitizeSessionGoalAnchor(fx.anchorPollutionSample);
    if (sanitized.includes('是本任务的吗')) {
      console.error(`[fail] ${file}: anchor pollution not sanitized`);
      failed += 1;
    }
  }
}

if (failed > 0) {
  console.error(`\n${failed} fixture(s) failed`);
  process.exit(1);
}
console.log(`[ok] ${files.length} ROG Phase 7 fixtures passed`);
