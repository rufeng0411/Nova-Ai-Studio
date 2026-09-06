#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  loadOdTemplateRegistry,
  registryHubVisibleAllowed,
  resolveOdTemplateRegistryMode,
} from './lib/odTemplateRegistry.mjs';

assert.equal(resolveOdTemplateRegistryMode({}), 'shadow');
assert.equal(resolveOdTemplateRegistryMode({ PILOTDECK_OD_TEMPLATE_REGISTRY: 'off' }), 'off');
assert.equal(resolveOdTemplateRegistryMode({ PILOTDECK_OD_TEMPLATE_REGISTRY: '1' }), 'enforce');
assert.equal(registryHubVisibleAllowed(), false);

const reg = loadOdTemplateRegistry();
assert.ok(reg, 'registry json missing — run npm run od:template-registry:gen');
assert.equal(reg.hubVisibleDefault, false);
assert.ok(reg.counts.total >= 15, `expected >=15 templates, got ${reg.counts.total}`);
assert.ok(reg.counts.ported >= 13, `expected >=13 ported, got ${reg.counts.ported}`);
const badHub = (reg.templates || []).filter((t) => t.hubVisible === true);
assert.equal(badHub.length, 0, 'registry templates must not set hubVisible=true');

console.log(`od-template-registry OK (total=${reg.counts.total}, ported=${reg.counts.ported}, mode-default=shadow)`);
