import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('requireSaasConfigWrite', () => {
  it('passes through when not in SaaS mode', async () => {
    const prev = process.env.PILOTDECK_SAAS_MODE;
    delete process.env.PILOTDECK_SAAS_MODE;
    const { requireSaasConfigWrite } = await import('./requireSaasConfigWrite.js');
    let called = false;
    requireSaasConfigWrite({ user: { role: 'member' } }, {}, () => {
      called = true;
    });
    assert.equal(called, true);
    if (prev) process.env.PILOTDECK_SAAS_MODE = prev;
  });

  it('blocks non-admin in SaaS mode', async () => {
    process.env.PILOTDECK_SAAS_MODE = '1';
    const { requireSaasConfigWrite } = await import('./requireSaasConfigWrite.js');
    let status = null;
    requireSaasConfigWrite(
      { user: { role: 'member' } },
      {
        status(code) {
          status = code;
          return this;
        },
        json() {},
      },
      () => assert.fail('should not call next'),
    );
    assert.equal(status, 403);
    delete process.env.PILOTDECK_SAAS_MODE;
  });
});
