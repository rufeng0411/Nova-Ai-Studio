import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapPorts } from './devPortSync.mjs';

describe('devPortSync.mapPorts', () => {
  it('reads explicit env ports', () => {
    const mapped = mapPorts({
      SERVER_PORT: '3010',
      PILOTDECK_GATEWAY_PORT: '18800',
      VITE_PORT: '5180',
      PILOTDECK_GATEWAY_URL: 'ws://127.0.0.1:18800/ws',
    });
    assert.deepEqual(mapped, {
      serverPort: 3010,
      gatewayPort: 18800,
      vitePort: 5180,
      gatewayUrl: 'ws://127.0.0.1:18800/ws',
    });
  });

  it('falls back to project defaults', () => {
    const mapped = mapPorts({});
    assert.equal(mapped.serverPort, 3001);
    assert.equal(mapped.gatewayPort, 18789);
    assert.equal(mapped.vitePort, 5173);
    assert.equal(mapped.gatewayUrl, 'ws://127.0.0.1:18789/ws');
  });
});
