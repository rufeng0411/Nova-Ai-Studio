#!/usr/bin/env node
/**
 * PD-SAAS-FORK: fixture gate for engine verified paths vs UI display paths.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function normalizeList(values) {
  return [...new Set((values ?? []).map((value) => String(value || '').replace(/\\/g, '/')).filter(Boolean))];
}

function assertAcceptanceMeta(row) {
  assert.equal(row.type, 'turn_acceptance_meta');
  const verified = normalizeList(row.verifiedPaths);
  const display = normalizeList(row.displayPaths);
  const hidden = new Set(normalizeList(row.hiddenByPolicyPaths));
  const displaySet = new Set(display);
  const verifiedUserFacing = verified.filter((filePath) => !hidden.has(filePath));

  for (const filePath of display) {
    assert.ok(verified.includes(filePath), `Display contains unverified path: ${filePath}`);
    assert.ok(row.resolvedPathMap?.[filePath], `Display path missing resolvedPathMap: ${filePath}`);
  }
  for (const filePath of verifiedUserFacing) {
    assert.ok(displaySet.has(filePath), `Verified user-facing path missing from Display: ${filePath}`);
  }
  assert.equal(display.length, verifiedUserFacing.length, 'Display count must equal verified user-facing count');
  if (row.missingPaths?.length || row.brokenPaths?.length) {
    assert.notEqual(row.acceptanceStatus, 'passed', 'Missing/broken paths must not be marked passed');
  }
  for (const filePath of [...normalizeList(row.verifiedPaths), ...normalizeList(row.displayPaths)]) {
    assert.ok(!/artifacts\/geo\/docs\/(?:troubleshooting-guide|execution-standard|api-guide)\.md$/i.test(filePath), `Internal GEO doc leaked as deliverable: ${filePath}`);
  }
}

function assertNoLegacyOcrNotice(text) {
  assert.ok(
    !/文档 OCR（或对应模型池）/.test(String(text ?? '')),
    'Legacy OCR notice copy must not be generated for new turns',
  );
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pd-display-engine-'));
const fixture = path.join(tmpDir, 'session.jsonl');
const row = {
  type: 'turn_acceptance_meta',
  sessionId: 'fixture-session',
  turnId: 'fixture-turn',
  userGoalHash: 'fixture',
  expectedManifest: [
    { id: 'brief_docx', kind: 'docx', required: true },
    { id: 'campaign_html', kind: 'html', required: true },
  ],
  verifiedPaths: [
    'artifacts/campaign/demo/brief.docx',
    'artifacts/campaign/demo/index.html',
    'artifacts/campaign/demo/create.py',
  ],
  missingPaths: [],
  brokenPaths: [],
  displayPaths: [
    'artifacts/campaign/demo/brief.docx',
    'artifacts/campaign/demo/index.html',
  ],
  hiddenByPolicyPaths: [
    'artifacts/campaign/demo/create.py',
  ],
  turnArtifactDir: 'artifacts/campaign/demo',
  resolvedPathMap: {
    'artifacts/campaign/demo/brief.docx': 'artifacts/campaign/demo/brief.docx',
    'artifacts/campaign/demo/index.html': 'artifacts/campaign/demo/index.html',
  },
  acceptanceStatus: 'passed',
  continuationOwner: 'none',
};
fs.writeFileSync(fixture, `${JSON.stringify(row)}\n`, 'utf8');

const needsRepairRow = {
  ...row,
  turnId: 'fixture-turn-needs-repair',
  verifiedPaths: ['artifacts/social-matrix/brief.md'],
  missingPaths: ['external:xiaohongshu-draft'],
  displayPaths: ['artifacts/social-matrix/brief.md'],
  resolvedPathMap: {
    'artifacts/social-matrix/brief.md': 'artifacts/social-matrix/brief.md',
  },
  acceptanceStatus: 'needs_repair',
};
fs.appendFileSync(fixture, `${JSON.stringify(needsRepairRow)}\n`, 'utf8');

const rows = fs.readFileSync(fixture, 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line));

for (const entry of rows.filter((entry) => entry.type === 'turn_acceptance_meta')) {
  assertAcceptanceMeta(entry);
}
assertNoLegacyOcrNotice('已尝试 3 种方式，仍缺少 API 的 API Key，无法继续导出。打开 设置 → 能力接入 → 生图 API');

console.log('[display-engine-alignment] PASS');
