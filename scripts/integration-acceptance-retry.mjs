#!/usr/bin/env node
/**
 * PD-SAAS-FORK: offline final-acceptance retry fixture.
 */
import assert from 'node:assert/strict';
import { runFinalAcceptance, buildAcceptanceRepairPrompt } from '../src/saas/final-acceptance/finalAcceptance.js';

const invalid = await runFinalAcceptance({
  userGoal: '做 5 页官网落地页',
  assistantText: '已生成 output.html',
  candidates: [{
    path: 'output.html',
    kind: 'html',
    exists: true,
    sizeBytes: 128,
    textPreview: '} /* CONTINUE HERE */ nav{position:fixed;top:0;width:100%}',
  }],
});

assert.equal(invalid.status, 'needs_repair');
assert.ok(invalid.failures.some((failure) => failure.reason === 'invalid_html'));

const repairPrompt = buildAcceptanceRepairPrompt({
  userGoal: '做 5 页官网落地页',
  result: invalid,
});
assert.match(repairPrompt, /不要询问用户/);
assert.match(repairPrompt, /output\.html/);

const repaired = await runFinalAcceptance({
  userGoal: '做 5 页官网落地页',
  assistantText: '已修复 output.html',
  candidates: [{
    path: 'output.html',
    kind: 'html',
    exists: true,
    sizeBytes: 4096,
    textPreview: '<!doctype html><html><body><section>1</section><section>2</section><section>3</section><section>4</section><section>5</section></body></html>',
  }],
});

assert.equal(repaired.status, 'passed');
console.log('[acceptance-retry] PASS invalid -> repair prompt -> passed');
