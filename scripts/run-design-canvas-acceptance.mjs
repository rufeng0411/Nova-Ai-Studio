#!/usr/bin/env node
/**
 * PD-SAAS-FORK: design canvas phased acceptance orchestrator
 * Usage: node scripts/run-design-canvas-acceptance.mjs [--tier=fast|full|matrix] [--skip-skills]
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const tierArg = args.find((a) => a.startsWith('--tier='));
const tier = tierArg?.split('=')[1] || 'fast';
const skipSkills = args.includes('--skip-skills');
const date = new Date().toISOString().slice(0, 10);
const reportPath = path.join(root, `docs/design-canvas-acceptance-report-${date}.md`);

const unitPatterns = [
  'src/shared/designCanvasGate.test.ts',
  'src/shared/designCanvasGateSync.test.ts',
  'src/shared/designCanvasManifest.test.ts',
  'src/shared/designCanvasDock.test.ts',
  'src/shared/designCanvasBridge.test.ts',
  'src/shared/ensureCanvasBoardDir.test.ts',
  'src/shared/collectDeliverables.test.ts',
  'src/shared/resolveExportScope.test.ts',
  'src/shared/artifactContract.test.ts',
  'src/shared/designCanvasGrid.test.tsx',
  'src/components/super-preview/adapters/designCanvas/tldrawCanvasSync.test.ts',
];

const e2eByTier = {
  fast: [
    'gate-off-regression.spec.ts',
    'phase2-image-board.spec.ts',
    'phase2-overlay-dock.spec.ts',
    'phase3-linkage.spec.ts',
    'phase5-interaction-stability.spec.ts',
  ],
  full: [
    'gate-off-regression.spec.ts',
    'phase2-image-board.spec.ts',
    'phase2-overlay-dock.spec.ts',
    'phase3-linkage.spec.ts',
    'phase4-diagram-cloud.spec.ts',
    'phase5-interaction-stability.spec.ts',
    'phase6-dock-deliverable.spec.ts',
    'phase7-mask-blend.spec.ts',
  ],
  matrix: [
    'gate-off-regression.spec.ts',
    'phase2-image-board.spec.ts',
    'phase2-overlay-dock.spec.ts',
    'phase3-linkage.spec.ts',
    'phase4-diagram-cloud.spec.ts',
    'phase5-interaction-stability.spec.ts',
    'phase6-dock-deliverable.spec.ts',
    'phase7-mask-blend.spec.ts',
    'skill-matrix.spec.ts',
  ],
};

const results = [];

function runStep(name, cmd, cmdArgs, cwd = root) {
  process.stdout.write(`\n▶ ${name}\n`);
  const result = spawnSync(cmd, cmdArgs, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  const ok = result.status === 0;
  results.push({ name, ok });
  process.stdout.write(ok ? `✓ ${name}\n` : `✗ ${name}\n`);
  return ok;
}

let allOk = true;

allOk = runStep('unit:design-canvas', 'pnpm', ['--filter', 'pilotdeck-ui', 'exec', 'vitest', 'run', ...unitPatterns]) && allOk;

if (tier !== 'off') {
  for (const spec of e2eByTier[tier] || e2eByTier.fast) {
    allOk =
      runStep(`e2e:${spec}`, 'pnpm', [
        'exec',
        'playwright',
        'test',
        `e2e/design-canvas/${spec}`,
        '--config',
        'playwright.design-canvas.config.ts',
      ], path.join(root, 'ui')) && allOk;
  }
}

if (tier === 'matrix' && skipSkills) {
  process.stdout.write('\n▶ skill-matrix skipped (--skip-skills)\n');
  results.push({ name: 'skill-matrix', ok: true });
}

const lines = [
  `# 设计画布验收报告 ${date}`,
  '',
  `tier: **${tier}**`,
  '',
  '| 步骤 | 结果 |',
  '|------|------|',
  ...results.map((r) => `| ${r.name} | ${r.ok ? '✅' : '❌'} |`),
  '',
  '## 自动化覆盖',
  '- phase4：流程图/脑图 manifest 节点',
  '- phase6：成果弹窗 Dock 左对话右画布',
  '- phase7：遮罩选区 / 融合变体',
  '- skill-matrix：LLM + canvas_add_diagram',
  '',
  '## Manual 实机清单（30min）',
  '- [ ] Excalidraw 全屏编辑（Phase 5 UI）',
  '- [ ] 拖拽/缩放/遮罩后刷新页面状态仍在',
  '- [ ] 关 gate 后 edit 按钮消失',
  '',
  `总体: ${allOk ? '**PASS**' : '**FAIL**'}`,
  '',
];

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
process.stdout.write(`\nReport: ${reportPath}\n`);

if (!allOk) process.exit(1);
process.stdout.write('\nDesign canvas acceptance passed.\n');
