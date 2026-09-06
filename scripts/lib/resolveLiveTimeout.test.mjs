import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLiveTimeout } from './resolveLiveTimeout.mjs';

describe('resolveLiveTimeout', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    delete process.env.LIVE_0717_VIDEO_TIMEOUT_MS;
    delete process.env.LIVE_0717_SLIDES_TIMEOUT_MS;
    delete process.env.LIVE_ES9_FOUR_FORMAT_TIMEOUT_MS;
    delete process.env.LIVE_TIMEOUT_NOVA_SLIDE_DECK_TIMEOUT_MS;
  });

  afterEach(() => {
    process.env = { ...saved };
  });

  it('maps video-3-step to 2400s default', () => {
    const r = resolveLiveTimeout({ caseId: 'video-3-step' });
    assert.equal(r.timeoutMs, 2_400_000);
    assert.equal(r.maxTurns, 18);
    assert.equal(r.profileId, 'video-mp4');
  });

  it('maps 10-page-slides to 3600s default', () => {
    const r = resolveLiveTimeout({ caseId: '10-page-slides' });
    assert.equal(r.timeoutMs, 3_600_000);
    assert.equal(r.maxTurns, 16);
  });

  it('maps case3-four-format-vap to md-html-office-pack', () => {
    const r = resolveLiveTimeout({ caseId: 'case3-four-format-vap' });
    assert.equal(r.timeoutMs, 2_400_000);
    assert.equal(r.profileId, 'md-html-office-pack');
  });

  it('env LIVE_0717_VIDEO_TIMEOUT_MS overrides case default', () => {
    process.env.LIVE_0717_VIDEO_TIMEOUT_MS = '500000';
    const r = resolveLiveTimeout({ caseId: 'video-3-step' });
    assert.equal(r.timeoutMs, 500_000);
  });

  it('profileId nova-slide-deck resolves without caseId', () => {
    const r = resolveLiveTimeout({ profileId: 'nova-slide-deck' });
    assert.equal(r.timeoutMs, 3_600_000);
    assert.equal(r.maxTurns, 16);
  });

  it('maps blackcloak-matrix to 900s default', () => {
    const r = resolveLiveTimeout({ caseId: 'blackcloak-matrix' });
    assert.equal(r.timeoutMs, 900_000);
    assert.equal(r.maxTurns, 16);
  });

  it('maps geo-brand-full to 1800s default', () => {
    const r = resolveLiveTimeout({ caseId: 'geo-brand-full' });
    assert.equal(r.timeoutMs, 1_800_000);
    assert.equal(r.maxTurns, 24);
  });

  it('maps spongebob-us-research to 600s default', () => {
    const r = resolveLiveTimeout({ caseId: 'spongebob-us-research' });
    assert.equal(r.timeoutMs, 600_000);
    assert.equal(r.maxTurns, 12);
  });
});
