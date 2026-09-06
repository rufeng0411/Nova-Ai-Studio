import test from 'node:test';
import assert from 'node:assert/strict';
import { isRepairEligiblePath, filterRepairEligiblePaths } from './repairEligiblePath.mjs';

test('RE-01: half-chain markdown pollution extracts artifacts path', () => {
  assert.equal(
    isRepairEligiblePath('ROG-2026-deck.pptx](artifacts/campaign/presentation.pptx)'),
    true,
  );
});

test('RE-04: pptx half-chain is repair-eligible', () => {
  const paths = filterRepairEligiblePaths([
    'file.pptx](artifacts/deck/file.pptx)',
  ]);
  assert.equal(paths.length, 1);
  assert.equal(
    isRepairEligiblePath('file.pptx](artifacts/deck/file.pptx)'),
    true,
  );
});

test('RE-02: extracts path from markdown link form', () => {
  const paths = filterRepairEligiblePaths([
    '[报告](artifacts/campaign/report.md)',
  ], { allowPathHints: ['report.md'] });
  assert.equal(paths.length, 1);
  assert.ok(paths[0].includes('artifacts/campaign/report.md'));
});

test('RE-03: chinese prefixed bare file still rejected', () => {
  assert.equal(isRepairEligiblePath('好，campaign-plan.md'), false);
});
