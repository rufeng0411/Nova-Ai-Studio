#!/usr/bin/env node
/**
 * PD-SAAS-FORK: replay goal-loop JSONL fixtures for offline regression.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readWebSessionMessages } from '../src/web/server/readSessionMessages.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureArg = process.argv[2];
const idsArg = process.argv.find((a) => a.startsWith('--ids='))?.split('=')[1];
const filterIds = idsArg ? new Set(idsArg.split(',').map((s) => s.trim()).filter(Boolean)) : null;

if (!fixtureArg) {
  console.error('Usage: node scripts/replay-goal-loop-fixture.mjs <fixture.jsonl> [--ids=id1,id2]');
  process.exit(1);
}

const fixturePath = path.isAbsolute(fixtureArg) ? fixtureArg : path.join(root, fixtureArg);
const fixtureName = path.basename(fixturePath, '.jsonl');
if (filterIds && !filterIds.has(fixtureName)) {
  console.log(`[replay-goal-loop] skip ${fixtureName} (not in --ids)`);
  process.exit(0);
}

const lines = fs.readFileSync(fixturePath, 'utf8').split('\n').filter(Boolean);
const entries = lines.map((line) => JSON.parse(line));

const result = await readWebSessionMessages(
  { sessionKey: `replay-${fixtureName}`, limit: 500 },
  {
    projectRoot: path.join(root, 'general'),
    pilotHome: path.join(root, '.saas-dev-data'),
    transcriptAbsPath: fixturePath,
    now: () => new Date('2026-07-02T00:00:00.000Z'),
  },
);

const bodyText = result.messages.map((m) => m.text ?? '').join('\n');
const leaks = [];
if (/<task-resume\b/i.test(bodyText)) leaks.push('task-resume');
if (/^(?:fetch failed|failed to fetch)[.!?…]*$/im.test(bodyText)) leaks.push('bare-fetch-failed');

if (fixtureName.includes('task-resume') && leaks.includes('task-resume')) {
  console.error('[replay-goal-loop] FAIL: task-resume leaked to messages API');
  process.exit(1);
}

if (fixtureName.includes('empty-table') && !bodyText.includes('交付')) {
  console.log('[replay-goal-loop] empty-table fixture loaded (acceptance meta present)');
}

console.log(`[replay-goal-loop] PASS ${fixtureName} messages=${result.messages.length}`);
if (leaks.length > 0) {
  console.log(`[replay-goal-loop] note: ${leaks.join(', ')}`);
}
