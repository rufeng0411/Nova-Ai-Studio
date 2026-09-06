#!/usr/bin/env node
/** PD-SAAS-FORK (ROG Phase 8-2): 0707-2 fixture replay — video env, template exec, SDM reanchor. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  reanchorCampaignSlotPaths,
  markCampaignStageSatisfied,
} from '../src/saas/deliverables/reconcileDeliverableFacts.ts';
import { resolveProfile } from '../src/saas/deliverableCapabilityProfiles.ts';
import { resolveMediaStrategy } from '../src/saas/media/mediaStrategyResolver.ts';
import {
  detectBattlecardFullTurn,
  detectGeoBrandFullTurn,
  detectResearchReportTurn,
} from '../src/saas/processTemplateExecutionPrompt.ts';
import { applyGatewayMediaEnv } from '../src/saas/media/applyGatewayMediaEnv.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = path.join(root, 'tests', 'fixtures', 'task-recovery');
const gate = process.argv.includes('--gate');

let failed = 0;

function fail(msg) {
  console.error(`[fail] ${msg}`);
  failed += 1;
}

// Video 10s ad goal
const videoFx = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'rog-xiaoguan-video-10s.json'), 'utf8'));
const profile = resolveProfile(videoFx.capabilitySlug, undefined, videoFx.userGoal);
if (profile.id !== videoFx.expectedProfileId) {
  fail(`video profile ${profile.id} !== ${videoFx.expectedProfileId}`);
}
const strategy = resolveMediaStrategy(videoFx.userGoal, videoFx.capabilitySlug, videoFx.env);
if (strategy !== videoFx.expectMediaStrategy) {
  fail(`video strategy ${strategy} !== ${videoFx.expectMediaStrategy}`);
}

const env = { ...process.env };
applyGatewayMediaEnv(env, { video: { provider: 'qwen', apiKey: 'sk-test', model: 'wanx-v1' } }, env);
if (env.PILOTDECK_MEDIA_STRATEGY_RESOLVER !== '1') {
  fail('applyGatewayMediaEnv missing PILOTDECK_MEDIA_STRATEGY_RESOLVER');
}
if (!env.DASHSCOPE_API_KEY) {
  fail('applyGatewayMediaEnv missing DASHSCOPE_API_KEY');
}

// Battlecard / GEO detection
const battleGoal = '竞品 battlecard 三步：intel.md、battlecard.md、talk-track.md';
if (!detectBattlecardFullTurn(battleGoal)) fail('detectBattlecardFullTurn');
const geoGoal = '品牌 GEO 全案竞品分析与可见度优化';
if (!detectGeoBrandFullTurn(geoGoal)) fail('detectGeoBrandFullTurn');
const researchGoal = '冷泡茶正式调研报告，含图表与 docx';
if (!detectResearchReportTurn(researchGoal)) fail('detectResearchReportTurn');

// SDM reanchor
const campaignGoal = '品牌整合营销 Campaign 全案 8 阶段';
const reanchored = reanchorCampaignSlotPaths({
  missing: ['brief.md'],
  verified: ['artifacts/campaign-0707/campaign-plan.docx'],
  userGoal: campaignGoal,
});
if (!Array.isArray(reanchored) || reanchored.length !== 1) {
  fail(`reanchorCampaignSlotPaths ${JSON.stringify(reanchored)}`);
}
const stagePass = markCampaignStageSatisfied({
  userGoal: campaignGoal,
  verified: ['artifacts/campaign-0707/stage-plan.html'],
  missing: ['artifacts/campaign-0707/stage_plan_html/index.html'],
  broken: [],
});
if (!Array.isArray(stagePass.missing) || !Array.isArray(stagePass.broken)) {
  fail('markCampaignStageSatisfied return shape');
}

// UI kernel unit via vitest spawn
import { spawnSync } from 'node:child_process';
const vitest = spawnSync('npx', [
  'vitest', 'run',
  'ui/src/shared/deriveDeliverablesDockState.test.ts',
  'ui/src/shared/deliverableDockPolicy.test.ts',
  'ui/src/shared/deliverableQualityHints.test.ts',
], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
if (vitest.status !== 0) failed += 1;

if (failed > 0 && gate) process.exit(1);
console.log(`[ok] Phase 8-2 integration (${failed} failures)`);
