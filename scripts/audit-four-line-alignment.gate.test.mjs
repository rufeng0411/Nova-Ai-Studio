/**
 * PD-SAAS-FORK: audit-four-line gate rules (offline).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function gateAlignedPct(alignedPct, totalTurns, sessionCount, gateMode) {
  if (gateMode && sessionCount === 0) return { ok: false, code: 'G-4L0' };
  if (gateMode && totalTurns > 0 && alignedPct < 85) return { ok: false, code: 'G-4L2' };
  return { ok: true };
}

describe('audit-four-line gate', () => {
  it('G-4L0 fails when zero sessions in gate mode', () => {
    const r = gateAlignedPct(100, 0, 0, true);
    assert.equal(r.ok, false);
    assert.equal(r.code, 'G-4L0');
  });

  it('G-4L2 fails when aligned below 85%', () => {
    const r = gateAlignedPct(71.1, 154, 10, true);
    assert.equal(r.ok, false);
    assert.equal(r.code, 'G-4L2');
  });

  it('passes at 85% with sessions', () => {
    const r = gateAlignedPct(86, 100, 5, true);
    assert.equal(r.ok, true);
  });
});
