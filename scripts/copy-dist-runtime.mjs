#!/usr/bin/env node
/**
 * PD-SAAS-FORK: dist/src/cli/*.js 通过 ../../scripts/ 引用运行时脚本，
 * 解析到 dist/scripts/ 而非仓库根 scripts/ — 构建后须同步到 dist/scripts/lib/。
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const repoRoot = process.cwd();
const copies = [
  ['scripts/lib/patchHiddenConsole.mjs', 'dist/scripts/lib/patchHiddenConsole.mjs'],
  // PD-SAAS-FORK: Gateway mcpFeatureFlags.ts → ../../../scripts/lib → dist/scripts/lib/
  ['scripts/lib/mcpFeatureFlags.mjs', 'dist/scripts/lib/mcpFeatureFlags.mjs'],
  ['ui/shared/htmlDeliverableRules.mjs', 'dist/ui/shared/htmlDeliverableRules.mjs'],
  ['ui/shared/deliverableBinaryRules.mjs', 'dist/ui/shared/deliverableBinaryRules.mjs'],
  ['ui/shared/deliverableSessionGoal.mjs', 'dist/ui/shared/deliverableSessionGoal.mjs'],
  ['ui/shared/repairEligiblePath.mjs', 'dist/ui/shared/repairEligiblePath.mjs'],
];

for (const [fromRel, toRel] of copies) {
  const src = join(repoRoot, fromRel);
  const dest = join(repoRoot, toRel);
  if (!existsSync(src)) {
    console.error(`[copy-dist-runtime] 缺少源文件 ${fromRel}`);
    process.exit(1);
  }
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest);
}

console.log(`[copy-dist-runtime] synced ${copies.length} runtime asset(s)`);

// Gateway dist/src/saas/*.js 通过 ../../ui/shared/*.mjs 解析到 dist/ui/shared/
try {
  await import('../dist/src/saas/deliverableSessionGoal.js');
  await import('../dist/src/saas/deliverables/acceptanceChecks.js');
  await import('../dist/src/saas/mcp/mcpFeatureFlags.js');
  console.log('[copy-dist-runtime] dist import smoke ok');
} catch (error) {
  console.error('[copy-dist-runtime] dist import smoke failed:', error?.message || error);
  process.exit(1);
}
