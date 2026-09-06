import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  getCanonicalHubRoot,
  listFilesystemWorkspaceHubsForUser,
  pathContainsUserSegment,
  resolveFileRootFromWorkspace,
  resolveSessionProjectKeyFromWorkspace,
} from './paths.js';

const tenantId = 'tenant-demo';
const userId = 42;
const uuid = 'abc-123';
const canonical = getCanonicalHubRoot(tenantId, userId, uuid);

assert.ok(pathContainsUserSegment(canonical, userId));
assert.equal(pathContainsUserSegment(canonical, 99), false);

const baseRow = {
  storageKind: 'cloud',
  syncEnabled: true,
  canonicalProjectKey: canonical,
  localRootPath: null,
  originDeviceId: null,
};

assert.equal(resolveFileRootFromWorkspace(baseRow, null), canonical);
assert.equal(resolveFileRootFromWorkspace(baseRow, 'any-device'), canonical);
assert.equal(resolveSessionProjectKeyFromWorkspace(baseRow), canonical);

const tmpTenant = mkdtempSync(path.join(os.tmpdir(), 'pd-paths-tenant-'));
process.env.DATA_ROOT = tmpTenant;
const fsTenantId = 'default';
const fsUserId = 7;
const hubA = getCanonicalHubRoot(fsTenantId, fsUserId, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
const hubB = getCanonicalHubRoot(fsTenantId, fsUserId, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
mkdirSync(path.dirname(hubA), { recursive: true });
mkdirSync(hubA, { recursive: true });
mkdirSync(hubB, { recursive: true });
writeFileSync(path.join(hubB, 'orphan.txt'), 'ok');
const hubs = listFilesystemWorkspaceHubsForUser(fsTenantId, fsUserId);
assert.equal(hubs.length, 2);
assert.ok(hubs.some((h) => path.resolve(h) === path.resolve(hubB)));

console.log('paths.test.mjs: ok');
