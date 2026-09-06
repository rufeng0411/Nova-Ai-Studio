/**
 * PD-SAAS-FORK: Vite http-proxy prefixes must not steal app modules
 * (`/s`→`/src/**`, `/share`→`/shared/**`) → Bridge SPA HTML → MIME white-screen.
 */
import assert from 'node:assert/strict';

/** Mirror vite.config.js `/s/` key. */
const PUBLIC_SHARE_PREFIX = '/s/';

function wouldProxyPublicShare(urlPath) {
  const p = String(urlPath || '').split('?')[0] || '/';
  return p === PUBLIC_SHARE_PREFIX || p.startsWith(PUBLIC_SHARE_PREFIX);
}

/** Mirror vite.config.js `/share` bypass — only `/share/doc` hits Bridge. */
function wouldProxyAuthShare(urlPath) {
  const p = String(urlPath || '').split('?')[0] || '/';
  return p === '/share/doc' || p.startsWith('/share/doc/');
}

assert.equal(wouldProxyPublicShare('/s/abc123'), true);
assert.equal(wouldProxyPublicShare('/s/abc123/asset/x.png'), true);
assert.equal(wouldProxyPublicShare('/src/main.jsx'), false);
assert.equal(wouldProxyAuthShare('/share/doc/proj/a.md'), true);
assert.equal(wouldProxyAuthShare('/share/markdown'), false);
assert.equal(wouldProxyAuthShare('/shared/deliverablePathResolve.mjs'), false);
assert.equal(wouldProxyPublicShare('/shell'), false);
// Legacy bare prefixes incorrectly steal Vite modules:
assert.equal('/src/main.jsx'.startsWith('/s'), true);
assert.equal('/shared/x.mjs'.startsWith('/share'), true);
console.log('viteShareProxyPath.test.mjs PASS');
