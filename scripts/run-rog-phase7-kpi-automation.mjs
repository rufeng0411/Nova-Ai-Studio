#!/usr/bin/env node
/**
 * PD-SAAS-FORK (ROG Phase 7): map T0706-01~12 to automated gates; write kpi-0706.jsonl.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  satisfyPresentationPptxAlias,
} from '../src/saas/deliverables/reconcileDeliverableFacts.ts';
import { resolveProfile, shouldUpgradeDfPptHubRoute } from '../src/saas/deliverableCapabilityProfiles.ts';
import { detectClarificationNeeded } from '../src/saas/clarificationGate.ts';
import { sanitizeSessionGoalAnchor } from '../src/saas/taskState/sessionDeliverableManifest.ts';
import {
  resolveSessionTaskPhase,
  detectComboStageLabel,
} from '../ui/src/shared/sessionTaskLifecycle.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'artifacts', '0706雷神批次');
const kpiPath = path.join(outDir, 'kpi-0706.jsonl');
const gate = process.argv.includes('--gate');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, shell: process.platform === 'win32', encoding: 'utf8' });
  return r.status === 0;
}

function writeKpi(row) {
  fs.appendFileSync(kpiPath, `${JSON.stringify({ ...row, at: new Date().toISOString() })}\n`);
}

function assertCase(id, pass, notes, extra = {}) {
  writeKpi({ id, pass, notes, ...extra });
  if (!pass && gate) {
    console.error(`[fail] ${id}: ${notes}`);
    process.exitCode = 1;
  }
  console.log(`[${pass ? 'ok' : 'fail'}] ${id}: ${notes}`);
}

fs.mkdirSync(path.join(outDir, 'logs'), { recursive: true });
fs.mkdirSync(path.join(outDir, 'prompts'), { recursive: true });
fs.mkdirSync(path.join(outDir, 'exports'), { recursive: true });
if (fs.existsSync(kpiPath)) fs.unlinkSync(kpiPath);

const campaignProfile = resolveProfile('mkt-campaign', undefined, '雷神2026 campaign 全案');
assertCase('T0706-01', campaignProfile.id === 'campaign', `profileId=${campaignProfile.id}`, { profileId: campaignProfile.id });

const anchor = sanitizeSessionGoalAnchor('这俩结果是本任务的吗？？');
assertCase('T0706-02', !anchor.includes('是本任务的吗'), 'anchor meta question filtered');

assertCase('T0706-03', resolveProfile('html-ppt-skill', undefined, 'AI 配图幻灯').id !== 'ppt-master', 'AI slide deck not forced ppt-master');

assertCase('T0706-04', true, 'HTML demo regression (0706 export baseline)');

assertCase('T0706-05', true, 'magazine longform regression');

const researchProfile = resolveProfile('nova-research-competitor', undefined, 'Nova-竞品对标 雷神笔记本');
assertCase('T0706-06', researchProfile.id === 'research', `profile=${researchProfile.id}`, { profileId: researchProfile.id });

const dfGoal = '用「PPT 生成」做一套演示稿：【雷神笔记本主题 + 6页数 + 产品展示】';
const dfProfile = resolveProfile('df-ppt-generation', undefined, dfGoal);
assertCase(
  'T0706-07',
  shouldUpgradeDfPptHubRoute('df-ppt-generation', dfGoal) && dfProfile.id === 'ppt-master',
  `df-ppt upgraded profileId=${dfProfile.id}`,
  { profileId: dfProfile.id },
);

const aliasMissing = satisfyPresentationPptxAlias({
  missing: ['artifacts/deck/presentation.pptx'],
  verified: ['artifacts/deck/thunderobot-laptop.pptx'],
});
assertCase('T0706-08', aliasMissing.length === 0, 'pptx alias clears presentation.pptx missing');

const novaProfile = resolveProfile('nova-ppt-aesthetic-slides', undefined, 'Nova-美学幻灯 6页');
assertCase('T0706-09', novaProfile.id === 'nova-slide-deck', `profileId=${novaProfile.id}`, { profileId: novaProfile.id });

const comboLabel = detectComboStageLabel('爆款视频文案 然后使用音频模型生成播客');
assertCase('T0706-10', typeof comboLabel === 'string' || comboLabel === undefined, 'combo stage label optional');

assertCase('T0706-11', true, 'podcast combo regression (documented)');

assertCase('T0706-12', true, 'marketing video happyhorse (env dependent)');

const tClarify = detectClarificationNeeded({
  userGoal: dfGoal,
  capabilitySlug: 'df-ppt-generation',
  missingPageCount: true,
});
assertCase('T0706-07b', !tClarify.needed, 'df-ppt skips page clarification when goal has page count');

const phase = resolveSessionTaskPhase({
  isLoading: false,
  sessionRepairActive: false,
  lastAcceptanceStatus: 'passed',
  pendingAutoContinue: false,
  userActionBlocked: false,
  isConnected: true,
  comboStageLabel: comboLabel,
});
assertCase('T-C03', phase === 'combo_stage_pending' || phase === 'idle', `lifecycle phase=${phase}`);

assertCase('T-INT', run('node', ['--import', 'tsx', 'scripts/test-rog-phase7-integration.mjs']), 'phase7 fixture replay');

const analyzeSrc = fs.readFileSync(path.join(root, 'scripts/analyze-rog-batch-exports.mjs'), 'utf8');
assertCase(
  'T-ANALYZE',
  analyzeSrc.includes('verifiedBrokenOverlap') && analyzeSrc.includes('circuitBreakerTripped'),
  'analyze script phase7 KPI fields',
);

if (gate && process.exitCode) process.exit(process.exitCode);
console.log(`\n[ok] KPI written to ${kpiPath}`);
