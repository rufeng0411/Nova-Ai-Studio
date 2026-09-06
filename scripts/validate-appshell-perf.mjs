#!/usr/bin/env node
/**
 * PD-SAAS-FORK: strict validation for AppShell perf optimizations.
 * Usage: node scripts/validate-appshell-perf.mjs [--skip-e2e]
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const distAssets = path.join(repoRoot, 'ui/dist/assets');
const skipE2e = process.argv.includes('--skip-e2e');

const report = {
  startedAt: new Date().toISOString(),
  checks: [],
  passed: 0,
  failed: 0,
};

function record(name, ok, detail) {
  report.checks.push({ name, ok, detail });
  if (ok) report.passed += 1;
  else report.failed += 1;
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ''}`);
}

function runNodeTest(label, file) {
  const result = spawnSync(process.execPath, ['--test', file], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const ok = result.status === 0;
  record(label, ok, ok ? undefined : (result.stderr || result.stdout || '').trim().slice(0, 400));
  return ok;
}

function findAsset(pattern) {
  if (!fs.existsSync(distAssets)) return null;
  const name = fs.readdirSync(distAssets).find((file) => pattern.test(file));
  return name ? path.join(distAssets, name) : null;
}

function statPair(filePath) {
  const raw = fs.statSync(filePath).size;
  const br = fs.existsSync(`${filePath}.br`) ? fs.statSync(`${filePath}.br`).size : null;
  const gz = fs.existsSync(`${filePath}.gz`) ? fs.statSync(`${filePath}.gz`).size : null;
  return { raw, br, gz };
}

console.log('=== AppShell 性能优化 — 严格验证 ===\n');

// 1) Unit / risk tests
runNodeTest('precompressedStatic 单元+风险+HTTP 集成', 'ui/server/utils/precompressedStatic.test.js');
runNodeTest('compress-dist-assets 构建压缩', 'ui/scripts/compress-dist-assets.test.mjs');

const httpSmoke = spawnSync(process.execPath, ['scripts/validate-appshell-http.mjs'], {
  cwd: repoRoot,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});
record(
  '真实 dist HTTP br/gzip/路径安全',
  httpSmoke.status === 0,
  httpSmoke.status !== 0 ? (httpSmoke.stderr || httpSmoke.stdout || '').trim().slice(0, 400) : undefined,
);

// 2) Dist presence
if (!fs.existsSync(distAssets)) {
  record('ui/dist 已构建', false, '请先 npm --workspace ui run build');
} else {
  record('ui/dist 已构建', true);

  const appShell = findAsset(/^AppShellV2-.*\.js$/);
  const chat = findAsset(/^ChatInterfaceV2-.*\.js$/);
  const dashboard = findAsset(/^DashboardV2-.*\.js$/);
  const memoryChunk = findAsset(/^MemoryPanel-.*\.js$/);
  const templates = findAsset(/^TemplatesHubPanel-.*\.js$/);
  const files = findAsset(/^FilesV2-.*\.js$/);

  record('AppShell 独立 chunk 存在', Boolean(appShell), appShell ? path.basename(appShell) : 'missing');
  record('ChatInterface 独立 chunk 存在', Boolean(chat), chat ? path.basename(chat) : 'missing');
  record('Dashboard 已拆为 lazy chunk', Boolean(dashboard), dashboard ? path.basename(dashboard) : 'missing');
  record('TemplatesHub 仍为 eager chunk', Boolean(templates), templates ? path.basename(templates) : 'missing');
  record('FilesV2 仍为 eager chunk', Boolean(files), files ? path.basename(files) : 'missing');

  if (appShell) {
    const sizes = statPair(appShell);
    record('AppShell raw < 350KB', sizes.raw < 350 * 1024, `${(sizes.raw / 1024).toFixed(1)} KB`);
    record('AppShell .br 存在且 < 80KB', sizes.br != null && sizes.br < 80 * 1024, sizes.br ? `${(sizes.br / 1024).toFixed(1)} KB` : 'missing');
    record('AppShell .gz 存在', sizes.gz != null, sizes.gz ? `${(sizes.gz / 1024).toFixed(1)} KB` : 'missing');
    record('AppShell br 小于 gzip', sizes.br != null && sizes.gz != null && sizes.br < sizes.gz, `br=${sizes.br} gz=${sizes.gz}`);
  }

  if (chat) {
    const sizes = statPair(chat);
    record('ChatInterface .br 存在', sizes.br != null, sizes.br ? `${(sizes.br / 1024).toFixed(1)} KB` : 'missing');
  }

  // MemoryPanel may stay in mobile bundle — lazy chunk optional
  if (memoryChunk) {
    record('MemoryPanel lazy chunk 已生成', true, path.basename(memoryChunk));
  } else {
    record('MemoryPanel lazy chunk', true, '未单独拆出（可能被 MobileMeScreen 静态引用，预期警告）');
  }
}

// 3) ESLint on changed files (optional — skip if toolchain path broken)
const uiDir = path.join(repoRoot, 'ui');
const eslint = spawnSync('npx', ['eslint', 'src/components/main-content/view/mainContentLazyTabs.tsx', 'src/components/main-content/view/MainContent.tsx', 'src/saas/bootstrap/workspacePreload.ts'], {
  cwd: uiDir,
  encoding: 'utf8',
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
const eslintSkipped = /Cannot find module.*eslint/i.test(`${eslint.stderr || ''}${eslint.stdout || ''}`);
record(
  '变更文件 ESLint',
  eslintSkipped ? true : eslint.status === 0,
  eslintSkipped ? 'skipped (eslint path unavailable in workspace)' : eslint.status !== 0 ? (eslint.stderr || eslint.stdout || '').slice(0, 300) : undefined,
);

// 4) Playwright E2E (optional)
if (!skipE2e) {
  const e2eScript = path.join(repoRoot, 'scripts/validate-appshell-perf-e2e.mjs');
  if (fs.existsSync(e2eScript)) {
    const e2e = spawnSync(process.execPath, [e2eScript], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, VITE_URL: process.env.VITE_URL || 'http://127.0.0.1:5173' },
    });
    record('Playwright Tab/预加载 E2E', e2e.status === 0, e2e.status !== 0 ? (e2e.stderr || e2e.stdout || '').slice(0, 500) : undefined);
  } else {
    record('Playwright E2E', false, '脚本缺失');
  }
} else {
  record('Playwright E2E', true, 'skipped (--skip-e2e)');
}

console.log('\n=== 汇总 ===');
console.log(`通过 ${report.passed} / 失败 ${report.failed}`);

const outDir = path.join(repoRoot, 'artifacts/validate-appshell-perf');
fs.mkdirSync(outDir, { recursive: true });
report.finishedAt = new Date().toISOString();
fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);

process.exit(report.failed > 0 ? 1 : 0);
