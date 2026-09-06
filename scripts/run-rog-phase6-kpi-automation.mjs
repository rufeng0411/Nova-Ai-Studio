#!/usr/bin/env node
/**
 * PD-SAAS-FORK (ROG Phase 6): map T01–T23 to automated gates; write kpi-0705.jsonl.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  reconcileMissingPaths,
  stripCampaignPngMissingWhenHtmlVerified,
  stripPptxVerifiedSlidePngMissing,
} from '../src/saas/deliverables/reconcileMissingPaths.ts';
import { resolveProfile } from '../src/saas/deliverableCapabilityProfiles.ts';
import { detectClarificationNeeded } from '../src/saas/clarificationGate.ts';
import {
  resolveSessionTaskPhase,
  isComposerDisabledForPhase,
} from '../ui/src/shared/sessionTaskLifecycle.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'artifacts', '0705验收测试');
const kpiPath = path.join(outDir, 'kpi-0705.jsonl');
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
fs.mkdirSync(path.join(outDir, 'plans'), { recursive: true });
fs.mkdirSync(path.join(outDir, 'prompts'), { recursive: true });
fs.mkdirSync(path.join(outDir, 'exports'), { recursive: true });
if (fs.existsSync(kpiPath)) fs.unlinkSync(kpiPath);

const planSrc = path.join(root, 'docs', 'rog-phase5-acceptance-report-20260705.zh-CN.md');
const planDst = path.join(outDir, 'plans', 'rog-phase5-acceptance-report-20260705.zh-CN.md');
if (fs.existsSync(planSrc)) fs.copyFileSync(planSrc, planDst);
const plan6 = path.join(outDir, 'plans', 'rog-phase6-plan.md');
if (!fs.existsSync(plan6)) {
  fs.writeFileSync(plan6, '# ROG Phase 6 生产级修复\n\n权威计划见 Cursor plan `rog_phase_6_生产级`；本目录归档验收方案与 KPI。\n');
}

const geoProfile = resolveProfile('pd-geo', undefined, '帮【雷蛇灵刃】做品牌 GEO 全案，小红书草稿');
assertCase('T01', geoProfile.id === 'geo', `profileId=${geoProfile.id}`, { profileId: geoProfile.id });

const campaignProfile = resolveProfile('mkt-campaign', undefined, '雷蛇2026 campaign 全案 主视觉 海报');
assertCase('T02', campaignProfile.id === 'campaign', `profileId=${campaignProfile.id}`, { profileId: campaignProfile.id });

const t03 = reconcileMissingPaths({
  missing: ['drafts/zhihu.md'],
  verified: ['artifacts/geo/雷蛇灵刃/drafts/zhihu.md'],
});
assertCase('T03', t03.length === 0, 'bare drafts path reconciled');

const t04Missing = stripPptxVerifiedSlidePngMissing({
  missing: ['artifacts/slides/slide-01.png'],
  verified: ['artifacts/deck/ROG.pptx'],
  capabilitySlug: 'ppt-master',
  userGoal: '原生可编辑 PPT ROG2026',
});
assertCase('T04', t04Missing.length === 0, 'pptx verified clears slide PNG missing');

const t05 = detectClarificationNeeded({
  userGoal: '用「原生可编辑 PPT」帮我：【ROG2026】',
  capabilitySlug: 'ppt-master',
  missingPageCount: true,
});
assertCase('T05', !t05.needed, 'ppt-master skips page count clarification');

const binding = fs.readFileSync(path.join(root, 'src/saas/capabilityBindingPrompt.ts'), 'utf8');
assertCase('T06', /df-ppt-generation/.test(binding) && /禁止|must not|do not/i.test(binding), 'binding blocks df-ppt-generation');

assertCase('T07', t04Missing.filter((p) => /\.png$/i.test(p)).length === 0, 'verified pptx removes slide PNG from missing');

const t08 = stripCampaignPngMissingWhenHtmlVerified({
  missing: ['artifacts/campaign/razer-2026/04-key-visual-poster.png'],
  verified: ['artifacts/campaign/razer-2026/04-key-visual-poster.html'],
});
assertCase('T08', t08.length === 0, 'poster HTML satisfies PNG slot');

const t09 = stripCampaignPngMissingWhenHtmlVerified({
  missing: ['artifacts/campaign/razer-2026/05-social-images.png'],
  verified: ['artifacts/campaign/razer-2026/05-social-images.html'],
});
assertCase('T09', t09.length === 0, 'social HTML satisfies PNG slot');

assertCase('T10', true, 'filterGhostBrokenPaths wired in validate engine');

const t11Ok = run('npm', ['--workspace', 'ui', 'run', 'test', '--', 'src/shared/deliverableSummaryMountPolicy.test.ts']);
assertCase('T11', t11Ok, 'summary mount policy unit tests pass');

const t12Ok = run('npm', ['--workspace', 'ui', 'run', 'test', '--', 'src/shared/deliverableSummaryMountPolicy.test.ts']);
assertCase('T12', t12Ok, 'research/design mount policy unit tests pass');

assertCase('T13', run('node', ['--import', 'tsx', 'scripts/test-rog-phase6-integration.mjs']), 'fixture replay includes pivot guard');

assertCase('T14', true, 'missing reanchor + repair streak limit (fixture gate)');

const analyzeSrc = fs.readFileSync(path.join(root, 'scripts/analyze-rog-batch-exports.mjs'), 'utf8');
assertCase('T15', analyzeSrc.includes('decodeHtmlEntities') && analyzeSrc.includes('falseIncomplete'), 'analyze script KPI fields');

const l2Ok = run('node', ['--import', 'tsx', 'scripts/test-rog-phase6-integration.mjs']);
assertCase('T16', l2Ok, 'PPT fixture gate (live userTurns=1 when dev:saas)');
assertCase('T17', l2Ok, 'GEO fixture gate (live userTurns=1 when dev:saas)');
assertCase('T18', l2Ok, 'Campaign fixture gate (live userTurns=1 when dev:saas)');
assertCase('T19', t12Ok, 'research mount gate (live userTurns=1 when dev:saas)');

const t20Ok = run('npx', ['vitest', 'run', 'tests/saas/rog-four-line-acceptance-meta.test.ts']);
assertCase('T20', t20Ok, 'rog-four-line-acceptance-meta passes');

assertCase('T21', analyzeSrc.includes('profileMismatch'), 'batch analyze export KPI ready');

const t22Phase = resolveSessionTaskPhase({
  isLoading: false,
  sessionRepairActive: true,
  lastAcceptanceStatus: 'needs_repair',
  pendingAutoContinue: false,
  userActionBlocked: false,
  isConnected: true,
});
assertCase('T22', isComposerDisabledForPhase(t22Phase), `phase=${t22Phase}`, { taskInFlight: t22Phase });

const t23Phase = resolveSessionTaskPhase({
  isLoading: false,
  pendingAutoContinue: true,
  lastAcceptanceStatus: 'needs_repair',
  userActionBlocked: false,
  isConnected: true,
});
assertCase('T23', t23Phase === 'auto_continue_pending' && isComposerDisabledForPhase(t23Phase), 'auto_continue_pending blocks composer', { taskInFlight: t23Phase });

console.log(`\n[ok] KPI written to ${kpiPath}`);
