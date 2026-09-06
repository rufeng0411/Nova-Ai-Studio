import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getPublicMdShareMode,
  isPublicMdShareEnforce,
  isPublicMdShareWritable,
} from './publicMdShareFlag.js';

describe('publicMdShareFlag', () => {
  it('fail-closed when unset', () => {
    assert.equal(getPublicMdShareMode({}), 'off');
    assert.equal(isPublicMdShareWritable({}), false);
  });

  it('parses off shadow enforce', () => {
    assert.equal(getPublicMdShareMode({ PILOTDECK_PUBLIC_MD_SHARE: 'off' }), 'off');
    assert.equal(getPublicMdShareMode({ PILOTDECK_PUBLIC_MD_SHARE: 'shadow' }), 'shadow');
    assert.equal(getPublicMdShareMode({ PILOTDECK_PUBLIC_MD_SHARE: 'enforce' }), 'enforce');
    assert.equal(getPublicMdShareMode({ PILOTDECK_PUBLIC_MD_SHARE: '1' }), 'enforce');
    assert.equal(getPublicMdShareMode({ PILOTDECK_PUBLIC_MD_SHARE: 'weird' }), 'off');
  });

  it('writable and enforce helpers', () => {
    assert.equal(isPublicMdShareWritable({ PILOTDECK_PUBLIC_MD_SHARE: 'shadow' }), true);
    assert.equal(isPublicMdShareEnforce({ PILOTDECK_PUBLIC_MD_SHARE: 'shadow' }), false);
    assert.equal(isPublicMdShareEnforce({ PILOTDECK_PUBLIC_MD_SHARE: 'enforce' }), true);
  });
});
