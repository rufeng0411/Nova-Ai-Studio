/**
 * PD-SAAS-FORK: JS mirror of src/saas/tenantPaths.ts resolveMemoryRootForScope.
 */
import path from 'path';
import { getDataRoot } from './paths.js';
import { isSaasMode } from '../mode.js';
import { getSaasRequestContext } from '../context.js';

export const DEFAULT_TENANT_ID = 'default';

export function resolveMemoryRootForScope({
  projectRoot = null,
  fallbackRoot,
  tenantPilotHome = null,
  tenantId = null,
} = {}) {
  if (!isSaasMode()) return fallbackRoot;
  const tid = tenantId?.trim?.() || getSaasRequestContext()?.tenantId?.trim?.();
  const home = tenantPilotHome?.trim?.() || getSaasRequestContext()?.tenantPilotHome?.trim?.();
  if (tid && tid !== DEFAULT_TENANT_ID && home) {
    return path.join(home, 'memory');
  }
  if (projectRoot) {
    const tenantsRoot = path.join(getDataRoot(), 'tenants');
    const rel = path.relative(tenantsRoot, path.resolve(projectRoot));
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
      const seg = rel.split(/[\\/]/).filter(Boolean)[0];
      if (seg && seg !== DEFAULT_TENANT_ID) {
        return path.join(tenantsRoot, seg, 'memory');
      }
    }
  }
  return fallbackRoot;
}
