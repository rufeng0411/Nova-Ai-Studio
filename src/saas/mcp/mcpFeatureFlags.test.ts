// PD-SAAS-FORK: L0 unit tests for enterprise MCP feature flags
import { afterEach, describe, expect, it } from 'vitest';
import {
  filterMcpServersByFeatures,
  isHubSlugMcpFeatureAllowed,
  normalizeMcpFeaturesDoc,
  resolveMcpFeatureMode,
} from './mcpFeatureFlags.js';
import { assertPostgresMcpUrlAllowed } from './mcpPostgresGuard.js';
import { isMcpWriteToolBlocked } from './mcpWriteToolGate.js';

const ENV_KEYS = [
  'PILOTDECK_MCP_CN_ERP',
  'PILOTDECK_MCP_KINGDEE',
  'PILOTDECK_MCP_YONYOU_FIN',
  'PILOTDECK_MCP_TAX_INVOICE',
  'PILOTDECK_MCP_NOTION',
  'PILOTDECK_MCP_POSTGRES',
  'PILOTDECK_MCP_WRITE_TOOL_ALLOW',
] as const;

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe('mcpFeatureFlags', () => {
  it('defaults batch1 flags to off (env off)', () => {
    process.env.PILOTDECK_MCP_CN_ERP = 'off';
    expect(resolveMcpFeatureMode('cnErp')).toBe('off');
    expect(isHubSlugMcpFeatureAllowed('mcp-cn-erp')).toBe(false);
  });

  it('filters erp server when cnErp off', () => {
    process.env.PILOTDECK_MCP_CN_ERP = 'off';
    process.env.PILOTDECK_MCP_POSTGRES = 'off';
    const { servers, dropped } = filterMcpServersByFeatures({
      erp: { command: 'python' },
      firecrawl: { command: 'npx' },
    });
    expect(dropped).toContain('erp');
    expect(servers.erp).toBeUndefined();
    expect(servers.firecrawl).toBeTruthy();
  });

  it('keeps unregistered servers (fail-open)', () => {
    const { servers, unregistered } = filterMcpServersByFeatures({
      'custom-unknown': { command: 'node' },
    });
    expect(unregistered).toContain('custom-unknown');
    expect(servers['custom-unknown']).toBeTruthy();
  });

  it('mutual exclusion: cnErp + kingdee collapses kingdee', () => {
    const { features, warning } = normalizeMcpFeaturesDoc({
      cnErp: 'shadow',
      kingdee: 'enforce',
    });
    expect(features.cnErp).toBe('shadow');
    expect(features.kingdee).toBe('off');
    expect(warning).toMatch(/互斥|金蝶/);
  });

  it('shadow allows hub slug', () => {
    process.env.PILOTDECK_MCP_NOTION = 'shadow';
    expect(isHubSlugMcpFeatureAllowed('mcp-notion-collab')).toBe(true);
  });
});

describe('mcpPostgresGuard', () => {
  it('blocks same host+port+dbname as control plane', () => {
    const r = assertPostgresMcpUrlAllowed(
      'postgresql://u:p@127.0.0.1:5432/pilotdeck_saas',
      'postgresql://admin:x@127.0.0.1:5432/pilotdeck_saas',
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('control_plane_database_forbidden');
  });

  it('allows different database', () => {
    const r = assertPostgresMcpUrlAllowed(
      'postgresql://u:p@127.0.0.1:5432/business_db',
      'postgresql://admin:x@127.0.0.1:5432/pilotdeck_saas',
    );
    expect(r.ok).toBe(true);
  });
});

describe('mcpWriteToolGate', () => {
  it('blocks invoice create and bill audit by default', () => {
    expect(isMcpWriteToolBlocked('mcp__tax-invoice__create_invoice')).toBe(true);
    expect(isMcpWriteToolBlocked('mcp__kingdee__audit_bill')).toBe(true);
    expect(isMcpWriteToolBlocked('mcp__erp__erp_query_inventory')).toBe(false);
  });

  it('allowlist * opens writes', () => {
    process.env.PILOTDECK_MCP_WRITE_TOOL_ALLOW = '*';
    expect(isMcpWriteToolBlocked('mcp__kingdee__delete_bill')).toBe(false);
  });
});
