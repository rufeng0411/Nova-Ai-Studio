import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyWuyutaiRunResult,
  collectWuyutaiGatewayFrame,
} from './integration-recovery-wuyutai-run.mjs';

test('classifies a timeout with tool progress as partial_timeout failure', () => {
  const result = classifyWuyutaiRunResult({
    ok: false,
    timeout: true,
    turnCompleted: false,
    toolCalls: {
      generate_image: 3,
      write_file: 1,
    },
  });

  assert.equal(result.kind, 'partial_timeout');
  assert.equal(result.pass, false);
});

test('classifies a completed successful run as pass', () => {
  const result = classifyWuyutaiRunResult({
    ok: true,
    timeout: false,
    turnCompleted: true,
    toolCalls: {
      generate_image: 3,
      write_file: 1,
    },
  });

  assert.equal(result.kind, 'completed');
  assert.equal(result.pass, true);
});

test('resolves submit_turn on final gateway event instead of waiting for response frame', () => {
  const metrics = {
    recoveryAttempts: 0,
    toolCalls: {},
    turnCompleted: false,
  };

  const result = collectWuyutaiGatewayFrame(metrics, {
    type: 'event',
    id: 'run-1',
    final: true,
    event: {
      type: 'turn_completed',
      usage: {},
      finishReason: 'completed',
    },
  }, 'run-1');

  assert.equal(metrics.turnCompleted, true);
  assert.equal(result.done, true);
  assert.equal(result.ok, true);
});
