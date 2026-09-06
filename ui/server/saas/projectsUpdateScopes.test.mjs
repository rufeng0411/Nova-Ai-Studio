import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getProjectUpdateScope,
  groupProjectUpdateClients,
} from './projectsUpdateScopes.js';

test('SaaS project update scopes ignore clients without tenant context', () => {
  assert.equal(getProjectUpdateScope({ readyState: 1, __pilotdeckUserId: 1 }), null);
  assert.equal(getProjectUpdateScope({ readyState: 3, __pilotdeckTenantId: 'tenant-a', __pilotdeckUserId: 1 }), null);
});

test('SaaS project update scopes group clients by tenant and user', () => {
  const a1 = { readyState: 1, __pilotdeckTenantId: 'tenant-a', __pilotdeckUserId: 1, __pilotdeckRole: 'admin' };
  const a2 = { readyState: 1, __pilotdeckTenantId: 'tenant-a', __pilotdeckUserId: 1, __pilotdeckRole: 'admin' };
  const b = { readyState: 1, __pilotdeckTenantId: 'tenant-b', __pilotdeckUserId: 1, __pilotdeckRole: 'admin' };
  const anonymous = { readyState: 1 };

  const groups = groupProjectUpdateClients([a1, a2, b, anonymous]);

  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((group) => group.scope.tenantId).sort(), ['tenant-a', 'tenant-b']);
  assert.equal(groups.find((group) => group.scope.tenantId === 'tenant-a')?.clients.length, 2);
  assert.equal(groups.find((group) => group.scope.tenantId === 'tenant-b')?.clients.length, 1);
});
