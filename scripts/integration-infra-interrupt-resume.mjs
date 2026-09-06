#!/usr/bin/env node
/**
 * PD-SAAS-FORK: infra interrupt classification smoke (offline).
 */
import assert from 'node:assert/strict';

function isInfraInterruptError(error) {
  if (!error) return false;
  if (error instanceof Error && error.code === 'turn_stream_idle_timeout') return true;
  const msg = String(error instanceof Error ? error.message : error).toLowerCase();
  return (
    msg.includes('websocket closed')
    || msg.includes('econnreset')
    || msg.includes('gateway connect failed')
  );
}

assert.equal(isInfraInterruptError(new Error('Gateway WebSocket closed')), true);
assert.equal(isInfraInterruptError(Object.assign(new Error('idle'), { code: 'turn_stream_idle_timeout' })), true);
assert.equal(isInfraInterruptError(new Error('permission denied')), false);

console.log('[integration-infra-interrupt-resume] ok');
