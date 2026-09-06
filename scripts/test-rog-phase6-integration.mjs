#!/usr/bin/env node
/** PD-SAAS-FORK (ROG Phase 6): fixture replay for profile + missing reanchor. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reconcileMissingPaths, stripCampaignPngMissingWhenHtmlVerified } from '../src/saas/deliverables/reconcileMissingPaths.ts';
import { satisfyPresentationPptxAlias } from '../src/saas/deliverables/reconcileDeliverableFacts.ts';
import { resolveProfile } from '../src/saas/deliverableCapabilityProfiles.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = path.join(root, 'tests', 'fixtures', 'task-recovery');
const files = fs.readdirSync(fixtureDir).filter((f) => f.startsWith('rog-') && f.endsWith('.json'));

let failed = 0;
for (const file of files) {
  const fx = JSON.parse(fs.readFileSync(path.join(fixtureDir, file), 'utf8'));
  const phase8Only = fx.expectMalformedSanitizedMissing
    || fx.expectCampaignPhasePass
    || fx.expectUserAck
    || fx.expectBrokenAfterPptFilter !== undefined
    || fx.expectMediaStrategy;
  if (phase8Only) continue;
  if (fx.expectedProfileId) {
    const profile = resolveProfile(fx.capabilitySlug, undefined, fx.userGoal);
    if (profile.id !== fx.expectedProfileId) {
      console.error(`[fail] ${file}: profile ${profile.id} !== ${fx.expectedProfileId}`);
      failed += 1;
    }
  }
  if (fx.missingPaths && fx.verifiedPaths) {
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
}

if (failed > 0) {
  console.error(`\n${failed} fixture(s) failed`);
  process.exit(1);
}
console.log(`[ok] ${files.length} ROG Phase 6 fixtures passed`);
