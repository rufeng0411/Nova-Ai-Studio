// PD-SAAS-FORK
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInviteCode, validateCollectPayload, validateContactPayload } from './validate.js';

describe('validateContactPayload', () => {
  const good = {
    displayName: '张三',
    email: 'a@b.com',
    phone: '13800000000',
    company: 'Acme',
    message: '试用',
    captchaId: 'id',
    captchaAnswer: 'ab12',
  };

  it('accepts valid payload', () => {
    const r = validateContactPayload(good);
    assert.equal(r.ok, true);
    assert.equal(r.honeypot, false);
  });

  it('honeypot short-circuits', () => {
    const r = validateContactPayload({ ...good, website: 'http://spam' });
    assert.equal(r.ok, true);
    assert.equal(r.honeypot, true);
  });

  it('rejects missing fields', () => {
    assert.equal(validateContactPayload({ ...good, email: '' }).ok, false);
    assert.equal(validateContactPayload({ ...good, captchaAnswer: '' }).ok, false);
  });
});

describe('validateCollectPayload', () => {
  it('accepts path', () => {
    const r = validateCollectPayload({ path: '/docs/', referrer: 'https://x.com' });
    assert.equal(r.ok, true);
    assert.equal(r.value.path, '/docs/');
  });

  it('rejects traversal', () => {
    assert.equal(validateCollectPayload({ path: '/../etc' }).ok, false);
  });
});

describe('normalizeInviteCode', () => {
  it('keeps four digits only', () => {
    assert.equal(normalizeInviteCode(' 68a9b8x '), '6898');
    assert.equal(normalizeInviteCode('12'), '12');
  });
});

describe('default invite', () => {
  it('defaults to 6898', async () => {
    const { getDefaultInviteCode, isDefaultInviteCode } = await import('./validate.js');
    assert.equal(getDefaultInviteCode({}), '6898');
    assert.equal(isDefaultInviteCode('6898', {}), true);
    assert.equal(getDefaultInviteCode({ PILOTDECK_MARKETING_DEFAULT_INVITE: '0420' }), '0420');
  });
});
