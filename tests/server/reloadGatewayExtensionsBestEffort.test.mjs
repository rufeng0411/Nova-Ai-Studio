import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { reloadGatewayExtensionsBestEffort } from '../../ui/server/utils/reloadGatewayExtensionsBestEffort.js';

describe('reloadGatewayExtensionsBestEffort', () => {
  it('returns quickly when reloadExtensions never resolves', async () => {
    const started = Date.now();
    const result = await reloadGatewayExtensionsBestEffort({
      timeoutMs: 40,
      getIfReady: async () => ({
        reloadExtensions: () => new Promise(() => {}),
      }),
      input: { reason: 'test' },
    });
    const elapsed = Date.now() - started;
    assert.equal(result.reloaded, false);
    assert.match(String(result.warning), /重载|Gateway/);
    assert.ok(elapsed < 400, `elapsed ${elapsed}ms`);
  });

  it('does not await gateway connect when the socket is not ready', async () => {
    let kicked = false;
    const started = Date.now();
    const result = await reloadGatewayExtensionsBestEffort({
      timeoutMs: 40,
      getIfReady: async () => null,
      kickConnect: async () => {
        kicked = true;
        await new Promise(() => {});
        return { reloadExtensions: async () => ({ reloaded: true }) };
      },
      input: {},
    });
    const elapsed = Date.now() - started;
    assert.equal(result.reloaded, false);
    assert.equal(kicked, true);
    assert.ok(result.warning);
    assert.ok(elapsed < 400, `elapsed ${elapsed}ms`);
  });

  it('returns reloaded when gateway answers in time', async () => {
    const result = await reloadGatewayExtensionsBestEffort({
      getIfReady: async () => ({
        reloadExtensions: async () => ({ reloaded: true, changedPaths: [] }),
      }),
      input: { reason: 'ok' },
    });
    assert.equal(result.reloaded, true);
    assert.equal(result.warning, null);
  });
});
