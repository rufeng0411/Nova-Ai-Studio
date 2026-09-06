import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  enqueueTurn,
  dequeueTurn,
  peekQueuedTurn,
  cancelQueuedTurn,
  getQueueLength,
  hydrateQueueFromCatalogRows,
  listQueuedTurns,
  listQueuedTurnsForPump,
  resolveQueuePosition,
  compareQueueItemsForPump,
  markQueuedTurnFailed,
  markQueuedTurnHardFailed,
  resetTurnQueueForTests,
} from '../../ui/server/saas/concurrency/turnQueueManager.js';

describe('turnQueueManager', () => {
  beforeEach(() => {
    resetTurnQueueForTests();
  });

  it('dequeues FIFO', () => {
    const scope = { tenantId: 't1', userId: 1 };
    enqueueTurn({
      sessionKey: 'a',
      tenantId: 't1',
      userId: 1,
      command: 'one',
      options: {},
      providerHint: 'pilotdeck',
      enqueuedAt: 1,
    });
    enqueueTurn({
      sessionKey: 'b',
      tenantId: 't1',
      userId: 1,
      command: 'two',
      options: {},
      providerHint: 'pilotdeck',
      enqueuedAt: 2,
    });
    assert.equal(peekQueuedTurn(scope)?.sessionKey, 'a');
    assert.equal(dequeueTurn(scope)?.sessionKey, 'a');
    assert.equal(dequeueTurn(scope)?.sessionKey, 'b');
    assert.equal(dequeueTurn(scope), null);
  });

  it('cancels queued session', () => {
    enqueueTurn({
      sessionKey: 'queued-1',
      tenantId: 't1',
      userId: 2,
      command: 'x',
      options: {},
      providerHint: 'pilotdeck',
      enqueuedAt: 1,
    });
    assert.equal(cancelQueuedTurn({ tenantId: 't1', userId: 2, sessionKey: 'queued-1' }), true);
    assert.equal(peekQueuedTurn({ tenantId: 't1', userId: 2 }), null);
  });

  it('cancels queued session when catalog uses web-s_ and queue holds web:s_', () => {
    enqueueTurn({
      sessionKey: 'web:s_queued-variant',
      tenantId: 't1',
      userId: 22,
      command: 'x',
      options: {},
      providerHint: 'pilotdeck',
      enqueuedAt: 1,
    });
    assert.equal(cancelQueuedTurn({
      tenantId: 't1',
      userId: 22,
      sessionKey: 'web-s_queued-variant',
    }), true);
    assert.equal(peekQueuedTurn({ tenantId: 't1', userId: 22 }), null);
  });

  it('keeps two distinct inputs for one session in FIFO order', () => {
    const scope = { tenantId: 't1', userId: 3 };
    enqueueTurn({
      itemId: 'item-1',
      sessionKey: 'same-session',
      tenantId: 't1',
      userId: 3,
      command: 'first',
      options: {},
      providerHint: 'pilotdeck',
      enqueuedAt: 1,
    });
    enqueueTurn({
      itemId: 'item-2',
      sessionKey: 'same-session',
      tenantId: 't1',
      userId: 3,
      command: 'second',
      options: {},
      providerHint: 'pilotdeck',
      enqueuedAt: 2,
    });

    assert.equal(getQueueLength(scope), 2);
    assert.equal(dequeueTurn(scope)?.itemId, 'item-1');
    assert.equal(dequeueTurn(scope)?.itemId, 'item-2');
  });

  it('treats the same stable item id as an idempotent enqueue retry', () => {
    const scope = { tenantId: 't1', userId: 4 };
    const item = {
      itemId: 'stable-ref-entry',
      sessionKey: 'same-session',
      tenantId: 't1',
      userId: 4,
      command: 'same',
      options: {},
      providerHint: 'pilotdeck',
      enqueuedAt: 1,
    };
    enqueueTurn(item);
    enqueueTurn({ ...item, enqueuedAt: 2 });
    assert.equal(getQueueLength(scope), 1);
    assert.equal(dequeueTurn(scope)?.itemId, 'stable-ref-entry');
  });

  it('skips malformed durable rows and continues hydrating later valid queue items', () => {
    const stats = hydrateQueueFromCatalogRows([
      {
        tenantId: 't1',
        userId: 5,
        sessionId: 'bad-json',
        executionStatus: 'queued',
        queuedPayloadJson: '{not-json',
      },
      {
        tenantId: 't1',
        userId: 5,
        sessionId: 'bad-schema',
        executionStatus: 'queued',
        queuedPayloadJson: JSON.stringify({ command: 42, options: 'nope' }),
      },
      {
        tenantId: 't1',
        userId: 5,
        sessionId: 'legacy-no-ref',
        executionStatus: 'queued',
        queuedPayloadJson: JSON.stringify({
          command: 'legacy',
          options: {},
          providerHint: 'pilotdeck',
        }),
      },
      {
        tenantId: 't1',
        userId: 5,
        sessionId: 'valid-after-bad',
        executionStatus: 'queued',
        queuedPayloadJson: JSON.stringify({
          itemId: 'valid-item',
          command: 'valid',
          options: {},
          providerHint: 'pilotdeck',
          acceptedInputRef: {
            entryId: 'entry-1',
            turnId: 'turn-1',
            sequence: 1,
            createdAt: '2026-07-18T00:00:00.000Z',
          },
        }),
      },
    ]);

    assert.deepEqual(stats, { hydrated: 2, invalid: 2, skipped: 0 });
    assert.equal(dequeueTurn({ tenantId: 't1', userId: 5 })?.command, 'legacy');
    assert.equal(dequeueTurn({ tenantId: 't1', userId: 5 })?.itemId, 'valid-item');
  });

  it('restores every FIFO item from a running session envelope after restart', () => {
    const items = ['first', 'second'].map((command, index) => ({
      itemId: `item-${index + 1}`,
      command,
      options: {},
      providerHint: 'pilotdeck',
      enqueuedAt: index + 1,
    }));
    const stats = hydrateQueueFromCatalogRows([{
      tenantId: 't1',
      userId: 6,
      sessionId: 'same-session',
      executionStatus: 'running',
      queuedPayloadJson: JSON.stringify({ version: 2, items }),
    }]);

    assert.deepEqual(stats, { hydrated: 2, invalid: 0, skipped: 0 });
    assert.equal(dequeueTurn({ tenantId: 't1', userId: 6 })?.command, 'first');
    assert.equal(dequeueTurn({ tenantId: 't1', userId: 6 })?.command, 'second');
  });

  it('rebuilds nested options from an allowlist and trusts catalog row identity/path only', () => {
    const acceptedInputRef = {
      entryId: 'entry-safe',
      turnId: 'turn-1',
      sequence: 1,
      createdAt: '2026-07-18T00:00:00.000Z',
    };
    const stats = hydrateQueueFromCatalogRows([{
      tenantId: 't1',
      userId: 7,
      sessionId: 'authoritative-session',
      transcriptRelPath: 'projects/general/chats/authoritative-session.jsonl',
      executionStatus: 'queued',
      queuedPayloadJson: JSON.stringify({
        version: 2,
        items: [{
          itemId: 'safe-item',
          command: 'safe command',
          options: {
            sessionId: 'attacker-session',
            sessionKey: 'attacker-session',
            transcriptRelPath: 'projects/evil/chats/other.jsonl',
            acceptedInputRef: { ...acceptedInputRef, injected: true },
            queueItemId: 'attacker-item',
            projectPath: 'F:/safe-project',
            projectName: 'safe-project',
            permissionMode: 'default',
            untrustedNestedOption: 'drop-me',
          },
          transcriptRelPath: 'projects/evil/chats/other.jsonl',
          acceptedInputRef,
          providerHint: 'pilotdeck',
          enqueuedAt: 1,
        }],
      }),
    }]);

    assert.deepEqual(stats, { hydrated: 1, invalid: 0, skipped: 0 });
    const [item] = listQueuedTurns({ tenantId: 't1', userId: 7 });
    assert.equal(item.sessionKey, 'authoritative-session');
    assert.equal(item.transcriptRelPath, 'projects/general/chats/authoritative-session.jsonl');
    assert.deepEqual(item.acceptedInputRef, acceptedInputRef);
    assert.deepEqual(item.options, {
      sessionId: 'authoritative-session',
      sessionKey: 'authoritative-session',
      projectPath: 'F:/safe-project',
      projectName: 'safe-project',
      permissionMode: 'default',
    });
  });

  it('marks hard failures as immediately exhausted without retry schedule', () => {
    enqueueTurn({
      itemId: 'hard-fail',
      sessionKey: 'sess-hard',
      tenantId: 't1',
      userId: 8,
      command: 'fail',
      options: {},
      providerHint: 'pilotdeck',
      enqueuedAt: 1,
    });
    const failed = markQueuedTurnHardFailed({ tenantId: 't1', userId: 8, itemId: 'hard-fail' });
    assert.equal(failed?.retryExhausted, true);
    assert.equal(failed?.hardFailed, true);
    assert.equal(failed?.retryAvailableAt, undefined);
  });

  it('pumps older conversations before newer ones regardless of enqueue order', () => {
    const scope = { tenantId: 't1', userId: 9 };
    enqueueTurn({
      itemId: 'newer-session',
      sessionKey: 'web:s_new',
      tenantId: 't1',
      userId: 9,
      command: 'new dialog',
      options: {},
      providerHint: 'pilotdeck',
      enqueuedAt: 100,
      sessionCreatedAtMs: 2_000,
    });
    enqueueTurn({
      itemId: 'older-session',
      sessionKey: 'web:s_old',
      tenantId: 't1',
      userId: 9,
      command: 'old dialog',
      options: {},
      providerHint: 'pilotdeck',
      enqueuedAt: 50,
      sessionCreatedAtMs: 1_000,
    });

    const pumpOrder = listQueuedTurnsForPump(scope).map((item) => item.itemId);
    assert.deepEqual(pumpOrder, ['older-session', 'newer-session']);
    assert.equal(resolveQueuePosition(scope, 'older-session'), 1);
    assert.equal(resolveQueuePosition(scope, 'newer-session'), 2);
  });

  it('keeps FIFO within the same conversation after session created_at', () => {
    const a = {
      itemId: 'a-2',
      sessionKey: 'web:s_same',
      sessionCreatedAtMs: 500,
      enqueuedAt: 20,
    };
    const b = {
      itemId: 'a-1',
      sessionKey: 'web:s_same',
      sessionCreatedAtMs: 500,
      enqueuedAt: 10,
    };
    assert.ok(compareQueueItemsForPump(b, a) < 0);
    assert.ok(compareQueueItemsForPump(a, b) > 0);
  });
});
