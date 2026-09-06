/**
 * PD-SAAS-FORK: gateway-side tenant path resolution.
 *
 * Lives in `src/saas/` (fork-only) so the single line we touch in core
 * (`createLocalGateway.ts`) just calls into here — keeping upstream merges
 * conflict-free. Pure path logic, no runtime deps.
 *
 * Tenant data lives under `DATA_ROOT/tenants/<id>/` (mirrors
 * `ui/server/saas/tenant/paths.js`). A project root belongs to a tenant iff it
 * is nested there. In single-host mode no path lives under that tree, so every
 * helper returns `undefined`/fallback and core behavior is unchanged.
 */
import os from "node:os";
import path from "node:path";

/**
 * The platform-admin tenant. It represents the legacy/global data (single-host
 * continuity + super-admin's own workspace), so it is intentionally NOT
 * isolated: admin keeps reading the legacy global memory/always-on tree.
 * Only registered tenants (`tenant-<user>`) get their own isolated tree.
 */
export const DEFAULT_TENANT_ID = "default";

export function isSaasMode(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = String(env.PILOTDECK_SAAS_MODE ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
}

export function getSaasDataRoot(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = env.DATA_ROOT?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(os.homedir(), ".pilotdeck-saas");
}

export function resolveTenantHomeForProjectRoot(
  projectRoot: string | undefined | null,
  env: NodeJS.ProcessEnv = process.env,
): { tenantId: string; tenantHome: string } | undefined {
  if (!projectRoot) return undefined;
  const tenantsRoot = path.join(getSaasDataRoot(env), "tenants");
  const rel = path.relative(tenantsRoot, path.resolve(projectRoot));
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return undefined;
  const segments = rel.split(/[\\/]/).filter(Boolean);
  if (segments.length === 0) return undefined;
  const tenantId = segments[0];
  // Default (admin) tenant is the legacy/global tree — treat as non-isolated.
  if (tenantId === DEFAULT_TENANT_ID) return undefined;
  return { tenantId, tenantHome: path.join(tenantsRoot, tenantId) };
}

/**
 * Resolve the effective EdgeClaw memory rootDir for a project.
 * In SaaS, tenant projects get an isolated `tenantHome/memory` root (so the
 * shared `global` user-profile scope is per-tenant). Everything else keeps the
 * configured/fallback root.
 */
export function resolveTenantMemoryRoot(
  projectRoot: string | undefined | null,
  fallbackRootDir: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (!isSaasMode(env)) return fallbackRootDir;
  const tenant = resolveTenantHomeForProjectRoot(projectRoot, env);
  if (tenant) return path.join(tenant.tenantHome, "memory");
  return fallbackRootDir;
}

export type MemoryRootScope = {
  projectRoot?: string | null;
  fallbackRoot?: string;
  tenantPilotHome?: string | null;
  tenantId?: string | null;
};

/**
 * PD-SAAS-FORK: unified memory root for gateway capture + UI memory panel.
 * SaaS tenant-* always uses tenantPilotHome/memory even for external project paths.
 */
export function resolveMemoryRootForScope(
  scope: MemoryRootScope,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const fallback = scope.fallbackRoot;
  if (!isSaasMode(env)) return fallback;
  const tenantId = scope.tenantId?.trim();
  const tenantHome = scope.tenantPilotHome?.trim();
  if (tenantId && tenantId !== DEFAULT_TENANT_ID && tenantHome) {
    return path.join(tenantHome, "memory");
  }
  const fromProject = resolveTenantHomeForProjectRoot(scope.projectRoot ?? null, env);
  if (fromProject) return path.join(fromProject.tenantHome, "memory");
  return fallback;
}

export function resolveTenantIdFromPilotHome(
  pilotHome: string | undefined | null,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (!pilotHome?.trim()) return undefined;
  const tenantsRoot = path.join(getSaasDataRoot(env), "tenants");
  const rel = path.relative(tenantsRoot, path.resolve(pilotHome.trim()));
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return undefined;
  const tenantId = rel.split(/[\\/]/).filter(Boolean)[0];
  return tenantId || undefined;
}
