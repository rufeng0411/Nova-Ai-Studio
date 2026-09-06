#!/usr/bin/env node
/** PD-SAAS-FORK (ROG Phase 8): fixture replay — Phase 8 reconcile + video + ack. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  sanitizeMalformedRepairPaths,
  filterPptIntermediateBroken,
  campaignPhaseCompletePass,
} from '../src/saas/deliverables/reconcileDeliverableFacts.ts';
import { resolveProfile } from '../src/saas/deliverableCapabilityProfiles.ts';
import { detectUserDeliverableAcknowledgment } from '../src/saas/deliverables/userDeliverableAcknowledgment.ts';
import { resolveMediaStrategy } from '../src/saas/media/mediaStrategyResolver.ts';
import {
  detectBrandCampaignFullTurn,
  detectSocialMatrixTurn,
} from '../src/saas/processTemplateExecutionPrompt.ts';
import { resolveVideoModelFallbackChain } from '../src/saas/media/videoModelRegistry.ts';
import { classifyAutoRecoverySideEffectRisk } from '../src/saas/autoRecoverySideEffectPolicy.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = path.join(root, 'tests', 'fixtures', 'task-recovery');
const files = fs.readdirSync(fixtureDir).filter((f) => f.startsWith('rog-') && f.endsWith('.json'));

let failed = 0;

for (const file of files) {
  const fx = JSON.parse(fs.readFileSync(path.join(fixtureDir, file), 'utf8'));
  if (!file.includes('433ce25a') && !file.includes('706c4514') && !file.includes('4a9605af')
    && !file.includes('f8795d13') && !file.includes('3f1fe8e2')) {
    continue;
  }

  if (fx.expectedProfileId) {
    const profile = resolveProfile(fx.capabilitySlug, undefined, fx.userGoal);
    if (profile.id !== fx.expectedProfileId) {
      console.error(`[fail] ${file}: profile ${profile.id} !== ${fx.expectedProfileId}`);
      failed += 1;
    }
  }

  if (fx.expectMalformedSanitizedMissing) {
    const out = sanitizeMalformedRepairPaths(fx.missingPaths ?? []);
    if (JSON.stringify(out) !== JSON.stringify(fx.expectMalformedSanitizedMissing)) {
      console.error(`[fail] ${file}: malformed sanitize ${JSON.stringify(out)}`);
      failed += 1;
    }
  }

  if (fx.expectUserAck) {
    if (!detectUserDeliverableAcknowledgment(fx.lastUserMessage ?? '')) {
      console.error(`[fail] ${file}: user ack not detected`);
      failed += 1;
    }
  }

  if (fx.expectBrokenAfterPptFilter !== undefined) {
    const broken = filterPptIntermediateBroken({
      broken: fx.brokenPaths ?? [],
      verified: fx.verifiedPaths ?? [],
      profileId: fx.expectedProfileId,
      capabilitySlug: fx.capabilitySlug,
      userGoal: fx.userGoal,
    });
    if (JSON.stringify(broken) !== JSON.stringify(fx.expectBrokenAfterPptFilter)) {
      console.error(`[fail] ${file}: ppt broken filter ${JSON.stringify(broken)}`);
      failed += 1;
    }
  }

  if (fx.expectCampaignPhasePass) {
    const pass = campaignPhaseCompletePass({
      userGoal: fx.userGoal,
      verified: fx.verifiedPaths ?? [],
      missing: fx.missingPaths ?? [],
      broken: fx.brokenPaths ?? [],
    });
    if (pass.missing.length > 0 || pass.broken.length > 0) {
      console.error(`[fail] ${file}: campaign phase pass gaps remain missing=${pass.missing.length} broken=${pass.broken.length}`);
      failed += 1;
    }
  }

  if (fx.expectMediaStrategy) {
    process.env.PILOTDECK_VIDEO_API_READY = '1';
    const strategy = resolveMediaStrategy(fx.userGoal, fx.capabilitySlug, process.env);
    if (strategy !== fx.expectMediaStrategy) {
      console.error(`[fail] ${file}: media strategy ${strategy} !== ${fx.expectMediaStrategy}`);
      failed += 1;
    }
  }
}

const chain = resolveVideoModelFallbackChain('happyhorse-1.0-t2v');
if (!chain.includes('happyhorse-1.0-t2v')) {
  console.error('[fail] video registry missing happyhorse-1.0-t2v');
  failed += 1;
}

const draftRisk = classifyAutoRecoverySideEffectRisk({
  userGoal: 'campaign 全案，草稿不公开发布，蚁小二存草稿',
});
if (draftRisk.requiresUserConfirmation) {
  console.error('[fail] draft campaign should not require publish confirmation');
  failed += 1;
}

if (!detectBrandCampaignFullTurn('帮吴裕泰做 campaign 全案，各阶段一次规划')) {
  console.error('[fail] brand campaign turn not detected');
  failed += 1;
}

if (!detectSocialMatrixTurn('帮我把吴裕泰做成国内社媒矩阵')) {
  console.error('[fail] social matrix turn not detected');
  failed += 1;
}

if (failed > 0) {
  console.error(`\n[fail] Phase 8 integration: ${failed} failures`);
  process.exit(1);
}
console.log('[ok] Phase 8 integration passed');
