#!/usr/bin/env node
/**
 * PD-SAAS-FORK: 交付汇总表 SDM 回归 — 单元 + Playwright 离线 + 可选实机。
 * 实机：先 npm run dev，再 DELIVERABLE_SUMMARY_E2E=1 node scripts/run-deliverable-summary-regression.mjs --live
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const live = process.argv.includes('--live');
const reportPath = path.join(
  root,
  'docs',
  `deliverable-summary-regression-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.md`,
);

function run(label, cmd, args, extraEnv = {}) {
  console.log(`\n[deliverable-summary-regression] ${label}`);
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...extraEnv },
  });
  return { label, code: result.status ?? 1 };
}

const results = [];

results.push(run('modric-component-vitest', 'npx', [
  'vitest',
  'run',
  'ui/src/components/chat/deliverables/DeliverableSummaryTable.modric-regression.test.tsx',
  'ui/src/shared/buildDeliverableSummaryRows.test.ts',
  'ui/src/shared/resolveDeliverableSummaryExpectedManifest.test.ts',
  'ui/src/components/chat/deliverables/DeliverableSummaryTable.acceptance.test.tsx',
]));

results.push(run('sdm-unit', 'npm', ['run', 'test:sdm:unit']));

results.push(run('playwright-offline', 'npx', [
  'playwright',
  'test',
  '-c',
  'ui/playwright.config.ts',
  'ui/e2e/saas/deliverable-summary-sdm-regression.spec.ts',
  'ui/e2e/saas/sdm-session-manifest.spec.ts',
  '--grep-invert',
  'REG-0[5-9]',
], live ? { DELIVERABLE_SUMMARY_E2E: '' } : {}));

if (live) {
  const liveBase = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8082';
  results.push(run(
    'playwright-live',
    'npx',
    [
      'playwright',
      'test',
      '-c',
      'ui/playwright.config.ts',
      'ui/e2e/saas/deliverable-summary-sdm-regression.spec.ts',
      '--grep',
      'REG-0[5-9]',
    ],
    {
      DELIVERABLE_SUMMARY_E2E: '1',
      PLAYWRIGHT_BASE_URL: liveBase,
    },
  ));
}

const failed = results.filter((r) => r.code !== 0);
const lines = [
  '# 交付汇总表 SDM 回归报告',
  '',
  `时间：${new Date().toISOString()}`,
  `实机：${live ? '是' : '否（加 --live 启用 REG-05~09）'}`,
  '',
  '## 结果',
  '',
  ...results.map(({ label, code }) => `- ${label}: ${code === 0 ? 'PASS' : 'FAIL'}`),
  '',
  '## 覆盖场景',
  '',
  '- MOD-01 品牌官网 kind-only SDM → 已交付',
  '- MOD-02 Campaign 部分交付',
  '- MOD-03 受众画像 verifiedPaths',
  '- MOD-04 联名营销 acceptance 行',
  '- MOD-05 正文路径回退',
  '- REG-06~09 莫德里奇历史会话实机汇总表',
  '',
  '## 实机说明',
  '',
  '- REG-06/08：catalog 未收录磁盘 jsonl 时跳过（MOD-01/03 由组件单测覆盖）',
  '- REG-07 Campaign、REG-09 联名：须汇总表含「已交付」且非全「未完成」',
  '',
];

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
console.log(`\nReport: ${reportPath}`);

if (failed.length > 0) {
  console.error('[deliverable-summary-regression] failed:', failed.map((r) => r.label).join(', '));
  process.exit(1);
}
console.log('[deliverable-summary-regression] all passed');
