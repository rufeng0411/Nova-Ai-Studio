import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { requestBackpressure, resetBackpressureForTests } from '../../ui/server/middleware/requestBackpressure.js';

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    on(event, cb) {
      if (event === 'finish') this._finish = cb;
    },
  };
  return res;
}

describe('requestBackpressure', () => {
  beforeEach(() => {
    resetBackpressureForTests();
    process.env.PILOTDECK_REQUEST_BACKPRESSURE = '1';
  });

  it('returns 503 when validate limit exceeded', () => {
    process.env.PILOTDECK_BACKPRESSURE_VALIDATE = '1';
    const mw = requestBackpressure('validate');
    const req = { user: { tenant_id: 't1', id: 'u1' }, params: { projectName: 'general' } };
    const next = () => {};
    const res1 = mockRes();
    const res2 = mockRes();
    mw(req, res1, next);
    mw(req, res2, next);
    assert.equal(res1.statusCode, 200);
    assert.equal(res2.statusCode, 503);
    assert.equal(res2.body?.retryable, true);
  });

  it('isolates messages_export from live messages bucket', () => {
    process.env.PILOTDECK_BACKPRESSURE_MESSAGES = '1';
    process.env.PILOTDECK_BACKPRESSURE_MESSAGES_EXPORT = '1';
    const liveMw = requestBackpressure('messages');
    const exportMw = requestBackpressure('messages_export');
    const req = { user: { tenant_id: 't1', id: 'u1' }, params: {} };
    const next = () => {};
    const liveRes = mockRes();
    const exportRes = mockRes();
    liveMw(req, liveRes, next);
    exportMw(req, exportRes, next);
    assert.equal(liveRes.statusCode, 200);
    assert.equal(exportRes.statusCode, 200);
  });

  it('releases messages lease after timeout so slots cannot wedge forever', async () => {
    process.env.PILOTDECK_BACKPRESSURE_MESSAGES = '1';
    process.env.PILOTDECK_BACKPRESSURE_LEASE_MS = '50';
    const mw = requestBackpressure('messages');
    const req = { user: { tenant_id: 't1', id: 'u1' }, params: {} };
    const next = () => {};
    const hung = mockRes();
    mw(req, hung, next);
    const blocked = mockRes();
    mw(req, blocked, next);
    assert.equal(blocked.statusCode, 503);
    await new Promise((r) => setTimeout(r, 80));
    const afterLease = mockRes();
    mw(req, afterLease, next);
    assert.equal(afterLease.statusCode, 200);
  });
});
