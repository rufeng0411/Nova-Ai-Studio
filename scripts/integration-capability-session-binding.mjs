#!/usr/bin/env node
/** PD-SAAS-FORK: offline capability session binding check */
import assert from 'node:assert/strict';

function resolveBinding(pending, stored) {
  if (pending?.slug) return pending;
  return stored ?? null;
}

assert.deepEqual(
  resolveBinding({ slug: 'anth-pptx' }, { slug: 'old' }),
  { slug: 'anth-pptx' },
);
assert.deepEqual(resolveBinding(null, { slug: 'stored' }), { slug: 'stored' });
console.log('[integration-capability-session-binding] ok');
