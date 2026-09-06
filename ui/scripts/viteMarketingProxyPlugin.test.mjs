import assert from 'node:assert/strict';
import { shouldProxyMarketingPath } from './viteMarketingProxyPlugin.mjs';

assert.equal(shouldProxyMarketingPath('/', true), true);
assert.equal(shouldProxyMarketingPath('/docs/', true), true);
assert.equal(shouldProxyMarketingPath('/faq/', true), true);
assert.equal(shouldProxyMarketingPath('/compare/', true), true);
assert.equal(shouldProxyMarketingPath('/claims/', true), true);
assert.equal(shouldProxyMarketingPath('/about/', true), true);
assert.equal(shouldProxyMarketingPath('/copyright/', true), true);
assert.equal(shouldProxyMarketingPath('/en/about/', true), true);
assert.equal(shouldProxyMarketingPath('/showcase/', true), true);
assert.equal(shouldProxyMarketingPath('/showcase/shared/catalog.js', true), true);
assert.equal(shouldProxyMarketingPath('/en/', true), true);
assert.equal(shouldProxyMarketingPath('/en/showcase/', true), true);
assert.equal(shouldProxyMarketingPath('/shared/site.js', true), true);
assert.equal(shouldProxyMarketingPath('/shared/tokens.css?v=12', true), true);
assert.equal(shouldProxyMarketingPath('/shared/content.css', true), true);
assert.equal(shouldProxyMarketingPath('/shared/legalModal.js', true), true);
assert.equal(shouldProxyMarketingPath('/shared/legalModal.css?v=4', true), true);
assert.equal(shouldProxyMarketingPath('/pages/about.json', true), true);
// ui/shared app modules must NOT be proxied to marketing HTML
assert.equal(shouldProxyMarketingPath('/shared/deliverablePathResolve.mjs', true), false);
assert.equal(shouldProxyMarketingPath('/login?from=site', true), false);
assert.equal(shouldProxyMarketingPath('/src/main.jsx', true), false);
assert.equal(shouldProxyMarketingPath('/src/App.tsx', true), false);
assert.equal(shouldProxyMarketingPath('/node_modules/react/index.js', true), false);
assert.equal(shouldProxyMarketingPath('/', false), false);
console.log('viteMarketingProxyPlugin.test.mjs PASS');
