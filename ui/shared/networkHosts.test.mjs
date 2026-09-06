import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getConnectableHost, normalizeLoopbackHost } from './networkHosts.js';

describe('networkHosts', () => {
  it('normalizeLoopbackHost maps loopback aliases to localhost', () => {
    assert.equal(normalizeLoopbackHost('127.0.0.1'), 'localhost');
    assert.equal(normalizeLoopbackHost('::1'), 'localhost');
    assert.equal(normalizeLoopbackHost('[::1]'), 'localhost');
    assert.equal(normalizeLoopbackHost('0.0.0.0'), '0.0.0.0');
    assert.equal(normalizeLoopbackHost('192.168.2.5'), '192.168.2.5');
  });

  it('getConnectableHost returns localhost for bind-all and loopback hosts', () => {
    assert.equal(getConnectableHost('0.0.0.0'), 'localhost');
    assert.equal(getConnectableHost('::'), 'localhost');
    assert.equal(getConnectableHost('[::1]'), 'localhost');
    assert.equal(getConnectableHost('10.0.0.8'), '10.0.0.8');
  });

  it('getConnectableHost defaults empty host to localhost', () => {
    assert.equal(getConnectableHost(undefined), 'localhost');
    assert.equal(getConnectableHost(''), 'localhost');
  });
});
