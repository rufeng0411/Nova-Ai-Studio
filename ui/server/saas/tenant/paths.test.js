import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_TENANT_ID,
  ensureTenantProjectsDir,
  getDataRoot,
  getTenantPilotHome,
  getTenantProjectsRoot,
  tenantIdForUsername,
} from './paths.js';

const tempRoots = [];

function tempDataRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saas-paths-'));
  tempRoots.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('tenant paths', () => {
  it('resolves DATA_ROOT and tenant project tree', () => {
    const dataRoot = tempDataRoot();
    const env = { DATA_ROOT: dataRoot };
    expect(getDataRoot(env)).toBe(path.resolve(dataRoot));
    expect(getTenantProjectsRoot(DEFAULT_TENANT_ID, env)).toBe(
      path.join(dataRoot, 'tenants', DEFAULT_TENANT_ID, 'projects'),
    );
    expect(getTenantPilotHome('acme', env)).toBe(path.join(dataRoot, 'tenants', 'acme'));
  });

  it('maps username to stable tenant id', () => {
    expect(tenantIdForUsername('Alice.Wang')).toBe('tenant-alice.wang');
    expect(tenantIdForUsername('  bob  ')).toBe('tenant-bob');
  });

  it('creates tenant projects directory', () => {
    const dataRoot = tempDataRoot();
    const env = { DATA_ROOT: dataRoot };
    const projectsRoot = ensureTenantProjectsDir('team-a', env);
    expect(fs.existsSync(projectsRoot)).toBe(true);
    expect(projectsRoot).toBe(getTenantProjectsRoot('team-a', env));
  });
});
