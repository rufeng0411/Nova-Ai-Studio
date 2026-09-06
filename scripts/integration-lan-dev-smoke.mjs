#!/usr/bin/env node
/**
 * LAN dev smoke: validate port map + optional live HTTP probe against Vite.
 */
import { mapPorts } from './lib/devPortSync.mjs';
import { formatLanUrls } from './lib/lanHosts.mjs';
import { getConnectableHost } from '../ui/shared/networkHosts.js';

const ports = mapPorts();
const host = getConnectableHost(process.env.HOST || '0.0.0.0');
const baseUrl = process.env.PLAYWRIGHT_BASE_URL || process.env.VITE_URL || `http://${host}:${ports.vitePort}`;

function fail(message) {
  console.error(`[lan-dev-smoke] FAIL: ${message}`);
  process.exit(1);
}

async function probe(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    return response.status > 0 && response.status < 500;
  } catch {
    return false;
  }
}

console.log('[lan-dev-smoke] port map:', ports);
console.log('[lan-dev-smoke] candidate URLs:');
for (const entry of formatLanUrls({
  vitePort: ports.vitePort,
  serverPort: ports.serverPort,
  host: process.env.HOST,
})) {
  console.log(`  ${entry.label}: ${entry.vite}`);
}

if (process.env.PILOTDECK_LAN_SMOKE_SKIP_PROBE === '1') {
  console.log('[lan-dev-smoke] OK (probe skipped via PILOTDECK_LAN_SMOKE_SKIP_PROBE=1)');
  process.exit(0);
}

const viteOk = await probe(baseUrl);
if (!viteOk) {
  console.warn(`[lan-dev-smoke] WARN: ${baseUrl} not reachable — start dev first or set PILOTDECK_LAN_SMOKE_SKIP_PROBE=1`);
  process.exit(0);
}

const serverUrl = `http://${host}:${ports.serverPort}/api/projects`;
const serverOk = await probe(serverUrl);
if (!serverOk) {
  fail(`server probe failed: ${serverUrl}`);
}

console.log(`[lan-dev-smoke] OK vite=${baseUrl} server=${serverUrl}`);
