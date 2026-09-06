#!/usr/bin/env node
/**
 * PD-SAAS-FORK: 上线前全面稳定性跑测（多用户 / 全功能 / Skills 多角度）
 *
 * Usage:
 *   node scripts/run-prelaunch-stability-full.mjs
 *   node scripts/run-prelaunch-stability-full.mjs --skip-browser
 *   node scripts/run-prelaunch-stability-full.mjs --browser-only
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'prelaunch-stability');
const REPORT_MD = path.join(REPO_ROOT, 'docs', `prelaunch-stability-report-${new Date().toISOString().slice(0, 10)}.md`);

const skipBrowser = process.argv.includes('--skip-browser');
const browserOnly = process.argv.includes('--browser-only');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npm';

const steps = [];

function log(name, ok, detail = '', ms = 0) {
  steps.push({ name, ok, detail, ms, at: new Date().toISOString() });
  console.log(`\n[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}${ms ? ` (${Math.round(ms / 1000)}s)` : ''}`);
}

function run(cmd, args, extraEnv = {}) {
  const useShell =
    process.platform === 'win32' &&
    (String(cmd).endsWith('.cmd') || String(cmd).endsWith('.bat') || cmd === 'npm' || cmd === 'npx');
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const child = spawn(cmd, args, {
      cwd: REPO_ROOT,
      env: { ...process.env, ...extraEnv },
      stdio: 'inherit',
      shell: useShell,
      windowsHide: true,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      const ms = Date.now() - t0;
      if (code === 0) resolve(ms);
      else reject(Object.assign(new Error(`exit ${code}`), { code, ms }));
    });
  });
}

async function step(name, fn) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    log(name, true, typeof detail === 'string' ? detail : '', Date.now() - t0);
    return true;
  } catch (e) {
    log(name, false, e?.message || String(e), Date.now() - t0);
    return false;
  }
}

function writeReport() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const passed = steps.filter((s) => s.ok).length;
  const failed = steps.filter((s) => !s.ok);
  const summary = { passed, failed: failed.length, total: steps.length, steps };
  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));

  const lines = [
    `# 上线前全面稳定性跑测报告`,
    ``,
    `生成时间：${new Date().toISOString()}`,
    `通过：**${passed}/${steps.length}**`,
    ``,
    `## 明细`,
    ``,
    `| 项 | 结果 | 说明 |`,
    `|----|------|------|`,
    ...steps.map((s) => `| ${s.name} | ${s.ok ? '✅' : '❌'} | ${(s.detail || '').replace(/\|/g, '\\|')} |`),
    ``,
    failed.length
      ? `## 失败项\n\n${failed.map((f) => `- **${f.name}**: ${f.detail}`).join('\n')}`
      : `## 结论\n\n全部通过，可进入发版流程（仍需人工抽测 Skills 实跑与 HTTPS）。`,
  ];
  fs.writeFileSync(REPORT_MD, `${lines.join('\n')}\n`);
  console.log(`\n[stability] 报告 → ${REPORT_MD}`);
}

function pickPrelaunchPorts() {
  const vite = 5200 + Math.floor(Math.random() * 80);
  return {
    PRELAUNCH_VITE_PORT: String(vite),
    PRELAUNCH_SERVER_PORT: String(vite + 2000),
    PRELAUNCH_GATEWAY_PORT: String(vite + 13000),
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`[stability] skipBrowser=${skipBrowser} browserOnly=${browserOnly}`);

  if (!browserOnly) {
    await step('build', () => run(npmCmd, ['run', 'build']));
    await step('test:saas:deep', () => run(npmCmd, ['run', 'test:saas:deep']));
    await step('smoke:saas-isolation', () => run(npmCmd, ['run', 'smoke:saas-isolation']));
    await step('smoke:resilience', () => run(npmCmd, ['run', 'smoke:resilience']));
    await step('smoke:project-memory', () => run(npmCmd, ['run', 'smoke:project-memory']));
    await step('smoke:capability-hub', () => run(npmCmd, ['run', 'smoke:capability-hub']));
    await step('smoke:capability-try-prompts', () => run(npmCmd, ['run', 'smoke:capability-try-prompts']));
    await step('smoke:templates', () => run(npmCmd, ['run', 'smoke:templates']));
    await step('smoke:skill-risk', () => run(npmCmd, ['run', 'smoke:skill-risk']));
    await step('smoke:document-export', () => run(npmCmd, ['run', 'smoke:document-export']));
    await step('test:saas:storage', () => run(process.execPath, ['scripts/integration-saas-storage-comprehensive.mjs']));
    await step('test:saas:folder', () => run(process.execPath, ['scripts/integration-saas-folder-scenarios.mjs']));
    await step('check:saas-fork', () => run(npmCmd, ['run', 'check:saas-fork']));
    await step('brand:check', () => run(npmCmd, ['run', 'brand:check']));
    await step('vitest-capability-binding', () =>
      run(npxCmd, ['tsx', '--test', 'src/saas/capabilityBindingPrompt.test.ts']),
    );
    await step('vitest-ui-skills', () =>
      run(npxCmd, [
        'vitest',
        'run',
        'src/shared/capabilityTryPrompt.test.ts',
        'src/shared/capabilityTryBridge.test.ts',
        'src/components/chat/hooks/slashCommandAutoExecute.test.ts',
        'src/components/chat/hooks/useChatComposerState.test.ts',
        'src/shared/pendingElicitation.test.ts',
        'src/shared/elicitationDisplay.test.ts',
      ], { cwd: path.join(REPO_ROOT, 'ui') }),
    );
    await step('pack:preflight', () => run(npmCmd, ['run', 'pack:preflight']));
    await step('prelaunch-skill-live', () =>
      run(process.execPath, ['scripts/integration-prelaunch-skill-live.mjs', '--with-playwright']),
    );
    const prelaunchPorts = pickPrelaunchPorts();
    await step('prelaunch-quick-full', () =>
      run(
        process.execPath,
        [
          'scripts/integration-prelaunch-quick.mjs',
          ...(skipBrowser ? ['--skip-browser'] : []),
        ],
        prelaunchPorts,
      ),
    );
  }

  if (browserOnly) {
    await step('prelaunch-quick-browser', () =>
      run(process.execPath, ['scripts/integration-prelaunch-quick.mjs', '--browser-only']),
    );
  }

  writeReport();
  const failed = steps.filter((s) => !s.ok).length;
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  writeReport();
  process.exit(1);
});
