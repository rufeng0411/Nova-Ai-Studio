import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONVERSATION_ORPHAN_ERROR,
  isActiveExecutionStatus,
  isOrphanCatalogSession,
} from './orphanCatalogSessions.js';
import { evaluateSessionReadAccessDecision } from './sessionReadAccess.js';

describe('orphanCatalogSessions', () => {
  it('isActiveExecutionStatus recognizes queue lifecycle states', () => {
    assert.equal(isActiveExecutionStatus('queued'), true);
    assert.equal(isActiveExecutionStatus('running'), true);
    assert.equal(isActiveExecutionStatus('paused'), true);
    assert.equal(isActiveExecutionStatus('idle'), false);
  });

  it('orphan when catalog exists without transcript and idle execution', () => {
    assert.equal(
      isOrphanCatalogSession({
        catalogRow: { sessionId: 'web-s_x', executionStatus: 'idle' },
        transcriptAbsPath: null,
      }),
      true,
    );
  });

  it('not orphan when transcript exists', () => {
    assert.equal(
      isOrphanCatalogSession({
        catalogRow: { sessionId: 'web-s_x' },
        transcriptAbsPath: '/tmp/x.jsonl',
      }),
      false,
    );
  });

  it('not orphan when turn is queued without transcript yet', () => {
    assert.equal(
      isOrphanCatalogSession({
        catalogRow: { sessionId: 'web-s_x', executionStatus: 'queued' },
        transcriptAbsPath: null,
      }),
      false,
    );
  });
});

describe('sessionReadAccess orphan', () => {
  it('idle catalog without transcript → 410 conversation_orphan', () => {
    const r = evaluateSessionReadAccessDecision({
      deleted: false,
      catalogRow: { sessionId: 'web-s_orphan', executionStatus: 'idle', status: 'pending' },
      transcriptAbsPath: null,
    });
    assert.equal(r.allowed, false);
    assert.equal(r.status, 410);
    assert.equal(r.error, CONVERSATION_ORPHAN_ERROR);
  });

  it('queued catalog without transcript → allowed', () => {
    const r = evaluateSessionReadAccessDecision({
      deleted: false,
      catalogRow: { sessionId: 'web-s_pending', executionStatus: 'queued' },
      transcriptAbsPath: null,
    });
    assert.equal(r.allowed, true);
  });
});
