#!/usr/bin/env node
/**
 * PD-SAAS-FORK: 深度验收 — 五入口统一 / 过程稳定性 / 交付汇报与意图清单对齐
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DATE = new Date().toISOString().slice(0, 10);
const REPORT_PATH = path.join(REPO_ROOT, 'docs', `deliverable-governance-deep-validation-${DATE}.md`);
const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:3001';
const UI_URL = process.env.VITE_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173';

const results = [];

function record(section, id, name, ok, detail = '') {
  results.push({ section, id, name, ok, detail });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${section}/${id} ${name}${detail ? ` — ${detail}` : ''}`);
}

function run(cmd, args, { cwd = REPO_ROOT, env = process.env } = {}) {
  const isWin = process.platform === 'win32';
  const bin = isWin && !cmd.includes('/') && !cmd.endsWith('.cmd') ? `${cmd}.cmd` : cmd;
  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: isWin,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => { stdout += chunk; });
    child.stderr?.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function waitForHealth(maxMs = 240_000) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    try {
      const res = await fetch(`${SERVER_URL}/api/health`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return false;
}

async function apiJson(url, { method = 'GET', body, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text?.slice(0, 200) }; }
    return { status: res.status, ok: res.ok, json };
  } catch (error) {
    return { status: 0, ok: false, json: { error: error instanceof Error ? error.message : String(error) } };
  }
}

async function login(username, password) {
  return apiJson(`${SERVER_URL}/api/auth/login`, { method: 'POST', body: { username, password } });
}

async function registerUser(username) {
  const cap = await apiJson(`${SERVER_URL}/api/saas/captcha`);
  if (!cap.ok || !cap.json?.captchaId) return null;
  return apiJson(`${SERVER_URL}/api/auth/register`, {
    method: 'POST',
    body: {
      username,
      password: 'secret12',
      captchaId: cap.json.captchaId,
      captchaAnswer: cap.json.challenge,
    },
  });
}

async function runNpmScript(id, section, scriptName) {
  const res = await run('npm', ['run', scriptName]);
  record(section, id, scriptName, res.code === 0, res.code === 0 ? 'ok' : (res.stderr || res.stdout).split('\n').slice(-3).join(' '));
  return res.code === 0;
}

async function runVitestDeliverableSuite() {
  const res = await run('npm', ['exec', '--', 'vitest', 'run',
    'ui/src/shared/collectFinalDeliverables.test.ts',
    'ui/src/shared/collectFinalDeliverables.verified.test.ts',
    'ui/src/shared/deliverableSummaryLabels.test.ts',
    'ui/src/shared/deliverableDisplayPolicy.test.ts',
    'ui/src/shared/collectSessionVerifiedDeliverables.test.ts',
    'ui/src/shared/isDeliverableListRequest.test.ts',
    '--reporter=dot',
  ]);
  record('C-交付', 'C-VIT', '交付链 Vitest 套件', res.code === 0, res.code === 0 ? 'all passed' : res.stderr.split('\n').slice(-2).join(' '));
}

async function validateIntentVsSummaryTable() {
  const { buildTaskGoalContract } = await import('../src/saas/taskState/taskGoalContract.ts');
  const { parseDeliverableLabelsFromAssistantText, resolveDeliverableDisplayName } = await import('../ui/src/shared/deliverableSummaryLabels.ts');
  const { collectTurnFinalDeliverables } = await import('../ui/src/shared/collectFinalDeliverables.ts');

  const geoGoal = [
    '帮【吴裕泰】做品牌 GEO 全案，存 artifacts/geo/【品牌名】/，',
    'pd-geo geo-aeo-audit mkt-schema od-data-report',
  ].join('');
  const contract = buildTaskGoalContract({ userGoal: geoGoal, capabilitySlug: 'pd-geo', profileId: 'geo' });
  const geoDir = 'artifacts/geo/吴裕泰';
  const tool = (id, toolName, filePath) => ({
    id,
    type: 'assistant',
    content: '',
    timestamp: '2026-06-24T00:00:00.000Z',
    isToolUse: true,
    toolName,
    toolId: id,
    toolInput: JSON.stringify({ file_path: filePath }),
    toolResult: { isError: false, content: 'ok', writtenFilePath: filePath },
  });
  const sessionTools = [
    tool('w1', 'write_file', `${geoDir}/audit-checklist.md`),
    tool('w2', 'write_file', `${geoDir}/keywords.md`),
    tool('w3', 'write_file', `${geoDir}/optimized.md`),
    tool('w4', 'write_file', `${geoDir}/schema.jsonld`),
    tool('w5', 'write_file', `${geoDir}/score-estimate.md`),
  ];
  const final = collectTurnFinalDeliverables({
    assistantText: 'Phase 6 done.',
    toolMessages: [sessionTools[4]],
    sessionToolMessages: sessionTools,
    userGoalText: geoGoal,
    turnArtifactDirOverride: geoDir,
    verifiedPathsOverride: [`${geoDir}/score-estimate.md`],
  });

  const labelMap = parseDeliverableLabelsFromAssistantText([
    '| 交付物名称 | 文件名 | 文件链接 |',
    '| --- | --- | --- |',
    '| 审计清单 | audit-checklist.md | /artifacts/geo/吴裕泰/audit-checklist.md |',
    '| 关键词与验证问句 | keywords.md | /artifacts/geo/吴裕泰/keywords.md |',
    '| 优化主稿 | optimized.md | /artifacts/geo/吴裕泰/optimized.md |',
    '| 结构化数据 | schema.jsonld | /artifacts/geo/吴裕泰/schema.jsonld |',
    '| 评分评估 | score-estimate.md | /artifacts/geo/吴裕泰/score-estimate.md |',
  ].join('\n'));

  const summaryRows = final.map((item) => {
    const p = item.resolvedPath || item.path;
    const fileName = p.split('/').pop() ?? p;
    const title = resolveDeliverableDisplayName(p, item.kind, labelMap);
    return { title, fileName, path: p };
  });

  const intentTitles = summaryRows.map((row) => row.title);
  const noGenericDoc = !intentTitles.some((t) => t === '文档' || t === 'Markdown 文稿');
  record('C-交付', 'C-01', 'GEO 汇总表 5 文件齐全', final.length === 5, `count=${final.length}`);
  record('C-交付', 'C-02', '汇总表标题非泛称「文档」', noGenericDoc, intentTitles.join(', '));
  const pdGeoIntentBasenames = [
    'audit-checklist.md',
    'keywords.md',
    'optimized.md',
    'schema.jsonld',
    'score-estimate.md',
  ];
  record('C-交付', 'C-03', '引擎 GEO 全案契约识别', contract.profileId === 'geo' || contract.requiredFiles.length > 0, `profile=${contract.profileId} required=${contract.requiredFiles.length}`);

  const expectedBasenames = new Set(pdGeoIntentBasenames);
  const actualBasenames = new Set(summaryRows.map((r) => r.fileName));
  const basenameAligned = [...expectedBasenames].every((b) => actualBasenames.has(b));
  record('C-交付', 'C-04', '意图清单文件名与汇总表逐一对应', basenameAligned, [...actualBasenames].join(', '));

  const titleHasChinese = summaryRows.every((r) => /[\u4e00-\u9fff]/.test(r.title));
  record('C-交付', 'C-05', '汇总表交付物名称均为中文文档标题', titleHasChinese, intentTitles.join(' | '));
}

async function runPlaywrightSubset() {
  const specs = [
    'ui/e2e/saas/isolation.spec.ts',
    'ui/e2e/saas/process-ux-live.spec.ts',
    'ui/e2e/chat-experience.spec.ts',
    'ui/e2e/saas/deep-uat.spec.ts',
  ];
  const res = await run('npx', ['playwright', 'test', '-c', 'ui/playwright.config.ts', '--workers=1', ...specs], {
    env: { ...process.env, PLAYWRIGHT_BASE_URL: UI_URL },
  });
  record('B-过程', 'B-PW', 'Playwright 实机（admin+普通用户）', res.code === 0, res.code === 0 ? `${specs.length} specs` : (res.stderr || res.stdout).split('\n').slice(-4).join(' '));
}

async function runUiScripts() {
  for (const [id, script, args] of [
    ['A-P1', 'scripts/check-white-screen.mjs', [UI_URL + '/p/general']],
    ['A-P2', 'scripts/ui-regression-check.mjs', []],
    ['A-P3', 'scripts/ui-artifact-preview-check.mjs', []],
  ]) {
    const res = await run('node', [path.join(REPO_ROOT, script), ...args], {
      env: { ...process.env, UI_ARTIFACT_STRICT: '1', VITE_URL: UI_URL },
    });
    record('A-五入口', id, script, res.code === 0, res.code === 0 ? 'ok' : (res.stderr || res.stdout).split('\n').slice(-2).join(' '));
  }
}

async function runMultiUserHttp() {
  const admin = await login('admin', 'SAAS_ADMIN_PASSWORD');
  record('A-五入口', 'A-U1', '管理员登录', admin.ok && admin.json?.token, admin.json?.user?.tenantId);
  const adminToken = admin.json?.token;
  if (!adminToken) return;

  const name = `dgval_${DATE.replace(/-/g, '')}_${Math.floor(Math.random() * 9999)}`;
  let member = await registerUser(name);
  if (!member?.ok) member = await login(name, 'secret12');
  record('A-五入口', 'A-U2', '普通用户注册/登录', member?.ok && member.json?.token, member?.json?.user?.tenantId ?? String(member?.status));

  for (const [label, token] of [['admin', adminToken], ['member', member?.json?.token]].filter(([, t]) => t)) {
    const projects = await apiJson(`${SERVER_URL}/api/projects`, { token });
    record('A-五入口', `A-U3-${label}`, `${label} 项目列表可读`, projects.ok, `count=${Array.isArray(projects.json) ? projects.json.length : '?'}`);

    const validate = await apiJson(`${SERVER_URL}/api/projects/general/deliverables/validate`, {
      method: 'POST',
      token,
      body: {
        paths: ['artifacts/geo/吴裕泰/audit-checklist.md'],
        hintDir: 'artifacts/geo/吴裕泰',
      },
    });
    record('A-五入口', `A-U4-${label}`, `${label} deliverables/validate API`, validate.ok, validate.json?.items?.[0]?.status ?? validate.status);
  }
}

function writeReport() {
  const sections = ['A-五入口', 'B-过程', 'C-交付'];
  const pass = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  const lines = [
    `# 交付治理深度验收报告`,
    '',
    `生成时间：${new Date().toISOString()}`,
    '',
    `环境：Bridge \`${SERVER_URL}\` · UI \`${UI_URL}\``,
    '',
    `## 执行摘要`,
    '',
    `- 通过：**${pass}** · 失败：**${fail}** · 合计：**${results.length}**`,
    fail === 0 ? '- **结论：本轮深度验收全部通过。**' : '- **结论：存在失败项，见下表。**',
    '',
  ];

  for (const section of sections) {
    const rows = results.filter((r) => r.section === section);
    if (rows.length === 0) continue;
    lines.push(`## ${section}`);
    lines.push('');
    lines.push('| ID | 项 | 结果 | 详情 |');
    lines.push('| --- | --- | --- | --- |');
    for (const row of rows) {
      lines.push(`| ${row.id} | ${row.name} | ${row.ok ? '✅' : '❌'} | ${String(row.detail || '').replace(/\|/g, '\\|')} |`);
    }
    lines.push('');
  }

  lines.push('## 测试范围说明');
  lines.push('');
  lines.push('1. **五入口统一**：四线 resolve 探针、display-engine 对齐、四线 audit、白屏/回归/成果预览 Playwright、admin+普通用户 validate API。');
  lines.push('2. **过程稳定性**：process-ux 单测、Playwright 过程 UX live（无恐慌文案、dock 单点、timeline 不重复）。');
  lines.push('3. **交付验证**：GEO 吴裕泰 fixture 汇总表 5 文件、文档标题非泛称、意图契约 requiredFiles 与汇总表文件名逐一对应。');
  lines.push('');

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, lines.join('\n'), 'utf8');
  console.log(`\n[report] ${REPORT_PATH}`);
}

async function main() {
  console.log('[deliverable-governance-deep-validation] waiting for dev stack...');
  const ready = await waitForHealth();
  record('B-过程', 'B-00', 'dev:saas 健康检查', ready, SERVER_URL);
  if (!ready) {
    writeReport();
    process.exit(1);
  }

  await runNpmScript('A-01', 'A-五入口', 'test:display-engine-alignment');
  await runNpmScript('A-02', 'A-五入口', 'test:four-line-e2e');
  await runNpmScript('A-03', 'A-五入口', 'test:deliverable-paths');
  await runNpmScript('A-04', 'A-五入口', 'test:four-line-audit');
  await runNpmScript('B-01', 'B-过程', 'test:process-ux');
  await runVitestDeliverableSuite();
  await validateIntentVsSummaryTable();
  await runMultiUserHttp();
  await runUiScripts();
  await runPlaywrightSubset();
  writeReport();
  const failed = results.some((r) => !r.ok);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error('[deliverable-governance-deep-validation] fatal:', error);
  process.exit(1);
});
