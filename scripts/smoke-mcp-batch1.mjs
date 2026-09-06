#!/usr/bin/env node
/**
 * PD-SAAS-FORK: L1 smoke for enterprise MCP batch1
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BATCH1_MCP_FLAG_KEYS, isHubSlugMcpFeatureAllowed } from './lib/mcpFeatureFlags.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = path.join(ROOT, 'config', 'capabilities.catalog.json');
const EXAMPLE = path.join(ROOT, 'products', '_example', 'config', 'mcp.json.example');
const CAPS_DOC = path.join(ROOT, 'docs', 'enterprise-mcp-batch1-capabilities.zh-CN.md');
const PLATFORM = path.join(ROOT, 'config', 'platform-features.json');

const SLUGS = [
  'mcp-cn-erp',
  'mcp-kingdee-k3',
  'mcp-yonyou-fin',
  'mcp-tax-invoice',
  'mcp-notion-collab',
  'mcp-postgres-readonly',
];

const SERVER_KEYS = ['erp', 'kingdee', 'yonyou-fin', 'tax-invoice', 'notion-collab', 'postgres'];

const SECTION_MARKERS = [
  '## mcp-cn-erp',
  '## mcp-kingdee-k3',
  '## mcp-yonyou-fin',
  '## mcp-tax-invoice',
  '## mcp-notion-collab',
  '## mcp-postgres-readonly',
];

assert.ok(fs.existsSync(CAPS_DOC), 'missing capabilities doc');
const capsBody = fs.readFileSync(CAPS_DOC, 'utf8');
for (const h of SECTION_MARKERS) {
  assert.ok(capsBody.includes(h), `capabilities doc missing section ${h}`);
}

const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
const bySlug = new Map((catalog.skills || []).map((s) => [s.slug, s]));
for (const slug of SLUGS) {
  assert.ok(bySlug.has(slug), `catalog missing ${slug}`);
}

const example = JSON.parse(fs.readFileSync(EXAMPLE, 'utf8'));
const servers = example.mcpServers || {};
for (const key of SERVER_KEYS) {
  assert.ok(servers[key], `mcp.json.example missing ${key}`);
}

const platform = JSON.parse(fs.readFileSync(PLATFORM, 'utf8'));
for (const key of BATCH1_MCP_FLAG_KEYS) {
  assert.equal(platform.mcpFeatures?.[key], 'off', `platform-features ${key} must default off`);
}

// Default env in this process may be unset — resolve from platform json → off
process.env.PILOTDECK_MCP_CN_ERP = 'off';
process.env.PILOTDECK_MCP_KINGDEE = 'off';
process.env.PILOTDECK_MCP_YONYOU_FIN = 'off';
process.env.PILOTDECK_MCP_TAX_INVOICE = 'off';
process.env.PILOTDECK_MCP_NOTION = 'off';
process.env.PILOTDECK_MCP_POSTGRES = 'off';
for (const slug of SLUGS) {
  assert.equal(isHubSlugMcpFeatureAllowed(slug), false, `${slug} must be hidden when off`);
}

// Legacy still allowed (shadow)
assert.equal(isHubSlugMcpFeatureAllowed('mcp-firecrawl'), true, 'legacy firecrawl should remain visible');
assert.equal(isHubSlugMcpFeatureAllowed('mcp-figma'), true, 'legacy figma should remain visible');

console.log('[smoke:mcp-batch1] OK — catalog+example+doc+defaults');
