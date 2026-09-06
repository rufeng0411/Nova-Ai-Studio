#!/usr/bin/env node
// PD-SAAS-FORK: lightweight live HTTP checks for public markdown share (Bridge)
import assert from 'node:assert/strict';

const base = (process.env.SERVER_URL || process.env.PLAYWRIGHT_SERVER_URL || 'http://127.0.0.1:7990').replace(/\/$/, '');
const gate = process.argv.includes('--gate');

async function main() {
  const flagsRes = await fetch(`${base}/api/runtime/public-flags`);
  assert.equal(flagsRes.ok, true, 'public-flags should be reachable');
  const flags = await flagsRes.json();
  console.log('public-flags.PILOTDECK_PUBLIC_MD_SHARE=', flags.PILOTDECK_PUBLIC_MD_SHARE);

  const missing = await fetch(`${base}/s/not-a-real-share-id-xxxxxxxx`);
  const missingText = await missing.text();
  assert.ok(missing.status === 404 || missing.status === 410, `expected 404/410 got ${missing.status}`);
  assert.doesNotMatch(missingText, /id=\"root\"/, 'must not return SPA shell');
  assert.match(missingText, /Nova Ai Studio|暂不可用|链接失效|未开启/i);

  const legacy = await fetch(`${base}/share/doc/general/artifacts/demo.md`);
  // may be 401 without token — still must not be SPA workbench
  const legacyText = await legacy.text();
  assert.doesNotMatch(legacyText, /AppShell|workspace-sync/i);
  console.log('legacy /share/doc status=', legacy.status);

  console.log('run-markdown-share-live: OK', { base });
}

main().catch((error) => {
  console.error(error);
  if (gate) process.exit(1);
  process.exit(1);
});
