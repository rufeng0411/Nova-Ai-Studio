#!/usr/bin/env node
/**
 * Phase 5 orchestrator: unit tests + Playwright smoke + manual checklist.
 * Usage: node scripts/run-process-timeline-acceptance.mjs [--skip-playwright]
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skipPlaywright = process.argv.includes('--skip-playwright');

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...opts,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('\n=== Process Timeline UX Acceptance ===\n');

console.log('Step 1/3: npm run test:process-ux:full');
run('npm', ['run', 'test:process-ux:full']);

if (!skipPlaywright) {
  console.log('\nStep 2/3: Playwright process-ux-live (requires dev:saas on :5173)');
  run('npm', ['--workspace', 'ui', 'exec', 'playwright', 'test', 'e2e/saas/process-ux-live.spec.ts'], {
    env: { ...process.env, PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173' },
  });
} else {
  console.log('\nStep 2/3: skipped (--skip-playwright)');
}

console.log(`
Step 3/3: Manual device checklist (mark in docs/process-timeline-ux-acceptance-report-*.md)

  G1  策略 A 单点 Timeline — 长任务录屏，process-timeline count ≤ 1
  G2  左轨 12px muted 与完成后一致
  G3  默认最近 5 步，可展开全部
  G4  无 tool_recovery 泄漏
  G5  思考中文优先（普通 + 英语教学各一条）
  G6  Copy Voice recovery 弱提示
  G7  完成后 InformalProcessStack → MessageRowV2 展开链
  G8  ProcessActivitySummary 折叠条
  G9  PhaseRail 弱化
  G10 ClueStrip live 下线
  G11 成果预览未退化
  G12 欢迎态无过程残留

  S1–S12 稳定性矩阵见 docs/process-timeline-ux-spec.zh-CN.md

Screenshots: artifacts/process-timeline-acceptance/
`);

console.log('Done.\n');
