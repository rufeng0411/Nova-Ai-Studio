import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Multi-tenant mixed-scenario isolation for the gateway projectKey guard.
 *
 * Reproduces the cross-talk root cause: the shared gateway keys transcripts by
 * projectKey alone, so without a tenant boundary any account could read/write
 * another tenant's — or the single-user install's — sessions. These tests run
 * several tenants through the guard concurrently and assert no key escapes its
 * owner.
 */
describe('SaaS tenant projectKey guard (multi-tenant mixed)', () => {
  let dataRoot;
  let previousEnv;

  function tenantHome(tenantId) {
    return path.join(dataRoot, 'tenants', tenantId);
  }

  function registerProject(tenantId, cwd) {
    const id = cwd.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
    const dir = path.join(tenantHome(tenantId), 'projects', id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '.cwd'), cwd, 'utf8');
  }

  beforeEach(() => {
    previousEnv = { ...process.env };
    dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'saas-guard-'));
    process.env.PILOTDECK_SAAS_MODE = '1';
    process.env.DATA_ROOT = dataRoot;
  });

  afterEach(() => {
    process.env = previousEnv;
    fs.rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  });

  async function runAs(tenantId, fn) {
    const { saasRequestStore } = await import('../context.js');
    return saasRequestStore.run(
      { tenantId, tenantPilotHome: tenantHome(tenantId) },
      fn,
    );
  }

  it('allows a tenant its own general home and registered projects', async () => {
    const { resolveTenantSafeProjectKey } = await import('./projectGuard.js');
    registerProject('tenant-alice', 'D:\\work\\alice-shop');

    await runAs('tenant-alice', async () => {
      const general = await resolveTenantSafeProjectKey('');
      expect(general.allowed).toBe(true);
      expect(general.projectKey).toBe(tenantHome('tenant-alice'));

      const own = await resolveTenantSafeProjectKey('D:\\work\\alice-shop');
      expect(own.allowed).toBe(true);
      expect(own.clamped).toBe(false);
    });
  });

  it('blocks reading the single-user install path from a tenant', async () => {
    const { resolveTenantSafeProjectKey } = await import('./projectGuard.js');
    await runAs('default', async () => {
      const leak = await resolveTenantSafeProjectKey('F:\\Ai-pilotdeck');
      expect(leak.allowed).toBe(false);
    });
  });

  it('blocks cross-tenant access between two concurrent tenants', async () => {
    const { resolveTenantSafeProjectKey } = await import('./projectGuard.js');
    registerProject('tenant-alice', 'D:\\work\\alice-only');
    registerProject('tenant-bob', 'D:\\work\\bob-only');

    // Interleave two tenants to mimic concurrent requests sharing the process.
    const [aliceReadsBob, bobReadsAlice] = await Promise.all([
      runAs('tenant-alice', () => resolveTenantSafeProjectKey('D:\\work\\bob-only')),
      runAs('tenant-bob', () => resolveTenantSafeProjectKey('D:\\work\\alice-only')),
    ]);
    expect(aliceReadsBob.allowed).toBe(false);
    expect(bobReadsAlice.allowed).toBe(false);

    const [aliceOwn, bobOwn] = await Promise.all([
      runAs('tenant-alice', () => resolveTenantSafeProjectKey('D:\\work\\alice-only')),
      runAs('tenant-bob', () => resolveTenantSafeProjectKey('D:\\work\\bob-only')),
    ]);
    expect(aliceOwn.allowed).toBe(true);
    expect(bobOwn.allowed).toBe(true);
  });

  it('clamps an out-of-tenant write to the tenant general home', async () => {
    const { resolveTenantSafeProjectKey } = await import('./projectGuard.js');
    await runAs('default', async () => {
      const clamped = await resolveTenantSafeProjectKey('F:\\Ai-pilotdeck', {
        fallbackToGeneral: true,
      });
      expect(clamped.allowed).toBe(false);
      expect(clamped.clamped).toBe(true);
      expect(clamped.projectKey).toBe(tenantHome('default'));
    });
  });

  it('is a pass-through outside SaaS mode (single-user unchanged)', async () => {
    process.env.PILOTDECK_SAAS_MODE = '0';
    const { resolveTenantSafeProjectKey } = await import('./projectGuard.js');
    const result = await resolveTenantSafeProjectKey('F:\\Ai-pilotdeck');
    expect(result.allowed).toBe(true);
    expect(result.projectKey).toBe('F:\\Ai-pilotdeck');
  });

  it('treats path casing/separators consistently', async () => {
    const { resolveTenantSafeProjectKey } = await import('./projectGuard.js');
    registerProject('tenant-alice', 'D:\\Work\\Alice-Shop');
    await runAs('tenant-alice', async () => {
      const mixed = await resolveTenantSafeProjectKey('d:\\work\\alice-shop');
      expect(mixed.allowed).toBe(true);
    });
  });
});
