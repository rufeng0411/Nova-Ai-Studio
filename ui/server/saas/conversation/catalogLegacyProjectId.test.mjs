import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createProjectId } from '../../utils/pilotPaths.js';
import { resolveCatalogLegacyProjectId } from './catalogLegacyProjectId.js';
import { saasRequestStore } from '../context.js';

test('resolveCatalogLegacyProjectId maps general to tenant pilot-home slug', () => {
  const tenantPilotHome = path.join('F:', 'Ai-pilotdeck', '.saas-dev-data', 'tenants', 'default');
  const slug = createProjectId(tenantPilotHome);
  const resolved = saasRequestStore.run(
    { tenantId: 'default', tenantPilotHome, userId: 1 },
    () => resolveCatalogLegacyProjectId('general'),
  );
  assert.equal(resolved, slug);
  assert.notEqual(resolved, 'general');
});

test('resolveCatalogLegacyProjectId keeps workspace ids unchanged', () => {
  const resolved = saasRequestStore.run(
    { tenantId: 'default', tenantPilotHome: '/tmp/tenant', userId: 1 },
    () => resolveCatalogLegacyProjectId('workspaces-0616'),
  );
  assert.equal(resolved, 'workspaces-0616');
});
