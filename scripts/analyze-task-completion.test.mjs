import assert from 'node:assert/strict';
import test from 'node:test';

import {
  evaluateTaskCompletionGate,
  TASK_COMPLETION_GATE_THRESHOLDS,
} from './analyze-task-completion.mjs';

test('task completion gate passes phase1 baseline thresholds', () => {
  const gate = evaluateTaskCompletionGate({
    deliverableInterventionRate: 0.20,
    pptCompletionRate: 0.10,
    recoveryEmptySpinRate: 0.10,
  }, 'phase1');

  assert.equal(gate.ok, true);
  assert.equal(gate.thresholds, TASK_COMPLETION_GATE_THRESHOLDS.phase1);
});

test('task completion gate fails with actionable threshold reasons', () => {
  const gate = evaluateTaskCompletionGate({
    deliverableInterventionRate: 0.30,
    pptCompletionRate: 0.01,
    recoveryEmptySpinRate: 0.30,
  }, 'phase1');

  assert.equal(gate.ok, false);
  assert.equal(gate.failures.length, 3);
  assert.match(gate.failures.join('\n'), /deliverableInterventionRate/);
  assert.match(gate.failures.join('\n'), /pptCompletionRate/);
  assert.match(gate.failures.join('\n'), /recoveryEmptySpinRate/);
});
