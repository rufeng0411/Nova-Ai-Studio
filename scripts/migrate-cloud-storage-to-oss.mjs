#!/usr/bin/env node
/**
 * PD-SAAS-FORK: one-shot mirror of SaaS cloud-storage trees to Alibaba OSS.
 *
 * Usage (ECS):
 *   SAAS_OSS_ENABLED=1 SAAS_OSS_BUCKET=nova-2-oss-0622 ... node scripts/migrate-cloud-storage-to-oss.mjs
 */
import { existsSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

process.chdir(REPO_ROOT);

const { getDataRoot } = await import('../ui/server/saas/tenant/paths.js');
const { isSaasOssConfigured, readSaasOssConfig } = await import('../ui/server/saas/storage/ossConfig.js');
const { mirrorDirectoryToOss } = await import('../ui/server/saas/storage/ossObjectStorage.js');

async function main() {
  if (!isSaasOssConfigured()) {
    console.error('[oss-migrate] 缺少 SAAS_OSS_BUCKET / ACCESS_KEY，请先配置 .env');
    process.exit(1);
  }
  const cfg = readSaasOssConfig();
  const dataRoot = getDataRoot();
  const tenantsDir = path.join(dataRoot, 'tenants');
  if (!existsSync(tenantsDir)) {
    console.error(`[oss-migrate] 未找到 tenants 目录: ${tenantsDir}`);
    process.exit(1);
  }

  let totalUploaded = 0;
  let totalSkipped = 0;
  /** @type {Array<{ path: string; error: string }>} */
  const allErrors = [];

  for (const tenantEntry of await readdir(tenantsDir, { withFileTypes: true })) {
    if (!tenantEntry.isDirectory()) continue;
    const cloudRoot = path.join(tenantsDir, tenantEntry.name, 'cloud-storage');
    if (!existsSync(cloudRoot)) continue;
    const tenantStat = await stat(cloudRoot);
    if (!tenantStat.isDirectory()) continue;
    console.log(`[oss-migrate] 同步 ${cloudRoot} → oss://${cfg.bucket}/${cfg.prefix}/...`);
    const result = await mirrorDirectoryToOss(cloudRoot);
    totalUploaded += result.uploaded ?? 0;
    totalSkipped += result.skipped ?? 0;
    if (result.errors?.length) allErrors.push(...result.errors);
  }

  console.log(`[oss-migrate] 完成 uploaded=${totalUploaded} skipped=${totalSkipped} errors=${allErrors.length}`);
  if (allErrors.length > 0) {
    for (const item of allErrors.slice(0, 20)) {
      console.error(`  - ${item.path}: ${item.error}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[oss-migrate] fatal:', error);
  process.exit(1);
});
