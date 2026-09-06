#!/usr/bin/env node
/**
 * PD-SAAS-FORK: L2 gateway-side MCP feature gate (offline — no spawn)
 * Asserts filter drops batch1 servers when env=off.
 */
import assert from 'node:assert/strict';
import {
  filterMcpServersByFeatures,
  isHubSlugMcpFeatureAllowed,
} from './lib/mcpFeatureFlags.mjs';

const BATCH1_SERVERS = {
  erp: { command: 'python', args: ['-m', 'erp_mcp.server'] },
  kingdee: { command: 'npx', args: ['-y', 'kingdee-k3cloud-mcp'] },
  'yonyou-fin': { command: 'npx' },
  'tax-invoice': { url: 'https://example.invalid/mcp' },
  'notion-collab': { command: 'npx' },
  postgres: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://u:p@h/db'] },
  firecrawl: { command: 'npx', args: ['-y', 'firecrawl-mcp'] },
};

process.env.PILOTDECK_MCP_CN_ERP = 'off';
process.env.PILOTDECK_MCP_KINGDEE = 'off';
process.env.PILOTDECK_MCP_YONYOU_FIN = 'off';
process.env.PILOTDECK_MCP_TAX_INVOICE = 'off';
process.env.PILOTDECK_MCP_NOTION = 'off';
process.env.PILOTDECK_MCP_POSTGRES = 'off';

const { servers, dropped } = filterMcpServersByFeatures(BATCH1_SERVERS);
assert.ok(!servers.erp, 'erp must be dropped when off');
assert.ok(!servers.kingdee, 'kingdee must be dropped when off');
assert.ok(!servers['notion-collab'], 'notion-collab must be dropped when off');
assert.ok(servers.firecrawl, 'legacy firecrawl must remain (shadow default)');
assert.ok(dropped.includes('erp'), 'dropped includes erp');

for (const slug of [
  'mcp-cn-erp',
  'mcp-kingdee-k3',
  'mcp-yonyou-fin',
  'mcp-tax-invoice',
  'mcp-notion-collab',
  'mcp-postgres-readonly',
]) {
  assert.equal(isHubSlugMcpFeatureAllowed(slug), false, `${slug} hub blocked when off`);
}

// shadow + fixture must not throw
process.env.PILOTDECK_MCP_CN_ERP = 'shadow';
const shadow = filterMcpServersByFeatures({ erp: BATCH1_SERVERS.erp, firecrawl: BATCH1_SERVERS.firecrawl });
assert.ok(shadow.servers.erp, 'erp kept in shadow');

console.log('[test:mcp-features:gateway] OK — off drops batch1; legacy kept; shadow keeps erp');
