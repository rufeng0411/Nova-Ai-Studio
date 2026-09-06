import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSessionReadAccessDecision } from './sessionReadAccess.js';

describe('sessionReadAccess', () => {
  it('soft-deleted session → 403', () => {
    const r = evaluateSessionReadAccessDecision({
      deleted: true,
      catalogRow: { sessionId: 'web-s_x' },
      transcriptAbsPath: '/tmp/x.jsonl',
    });
    assert.equal(r.allowed, false);
    assert.equal(r.status, 403);
  });

  it('unknown session (no catalog, no transcript) → 404', () => {
    const r = evaluateSessionReadAccessDecision({
      deleted: false,
      catalogRow: null,
      transcriptAbsPath: null,
    });
    assert.equal(r.allowed, false);
    assert.equal(r.status, 404);
    assert.match(r.error, /not found/i);
  });

  it('idle catalog without transcript → 410 conversation_orphan', () => {
    const r = evaluateSessionReadAccessDecision({
      deleted: false,
      catalogRow: { sessionId: 'web-s_pending', status: 'pending', executionStatus: 'idle' },
      transcriptAbsPath: null,
    });
    assert.equal(r.allowed, false);
    assert.equal(r.status, 410);
  });

  it('queued catalog without transcript → allowed', () => {
    const r = evaluateSessionReadAccessDecision({
      deleted: false,
      catalogRow: { sessionId: 'web-s_pending', status: 'pending', executionStatus: 'queued' },
      transcriptAbsPath: null,
    });
    assert.equal(r.allowed, true);
  });

  it('transcript on disk without catalog → allowed', () => {
    const r = evaluateSessionReadAccessDecision({
      deleted: false,
      catalogRow: null,
      transcriptAbsPath: '/data/projects/general/chats/web-s_legacy.jsonl',
    });
    assert.equal(r.allowed, true);
  });

  it('tombstoned orphan transcript → 403', () => {
    const r = evaluateSessionReadAccessDecision({
      deleted: false,
      tombstoned: true,
      catalogRow: null,
      transcriptAbsPath: '/data/projects/general/chats/web-s_orphan.jsonl',
    });
    assert.equal(r.allowed, false);
    assert.equal(r.status, 403);
  });
});
