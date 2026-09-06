import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const WINDOWS_BIN = new Map([
  ['npm', 'npm.cmd'],
  ['npx', 'npx.cmd'],
]);

function resolveCommand(cmd) {
  if (process.platform !== 'win32') return cmd;
  return WINDOWS_BIN.get(cmd) ?? cmd;
}

function runCommand({ cmd, args = [] }, cwd) {
  return new Promise((resolveRun) => {
    const startedAt = Date.now();
    const resolvedCmd = resolveCommand(cmd);
    const child = spawn(resolvedCmd, args, {
      cwd,
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
      shell: process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(resolvedCmd),
    });
    child.on('error', (error) => {
      resolveRun({
        ok: false,
        command: [cmd, ...args].join(' '),
        durationMs: Date.now() - startedAt,
        error: error.message,
      });
    });
    child.on('exit', (code) => {
      resolveRun({
        ok: code === 0,
        command: [cmd, ...args].join(' '),
        durationMs: Date.now() - startedAt,
        exitCode: code,
      });
    });
  });
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

const REQUIRED_SCENARIO_FIELDS = [
  'id',
  'source',
  'entrypoint',
  'historicalFailure',
  'userGoal',
  'turns',
  'expectedGoalContract',
  'expectedDeliverables',
  'forbiddenDeliverables',
  'interruptionAssertions',
  'fiveEntryAssertions',
  'telemetryAssertions',
];

const REQUIRED_MARKETING_STAGES = ['research', 'planning', 'creative', 'outreach', 'publishing', 'monitoring'];
const REQUIRED_CAPABILITY_CATEGORIES = ['marketing', 'office', 'creative', 'development', 'education'];
const REQUIRED_PROCESS_TEMPLATES = [
  'research-report',
  'content-flywheel',
  'geo-aeo-audit',
  'geo-content-optimizer',
  'sales-battlecard-full',
  'legal-risk-quick',
  'ad-storyboard-seedance',
  'short-drama-seedance-pack',
  'saas-demo-remotion-full',
];
const REQUIRED_SKILL_KINDS = [
  'local_no_key',
  'attachment_required',
  'external_key',
  'multi_file',
  'binary',
  'process_script',
];

function missingRequiredFields(scenario) {
  return REQUIRED_SCENARIO_FIELDS.filter((field) => {
    const value = scenario[field];
    if (Array.isArray(value)) return value.length === 0;
    if (value && typeof value === 'object') return Object.keys(value).length === 0;
    return value == null || value === '';
  });
}

function collectCoverage(scenarios, key) {
  return new Set(scenarios.map((scenario) => scenario.coverage?.[key]).filter(Boolean));
}

function requireCoverage({ failures, label, required, actual }) {
  for (const item of required) {
    if (!actual.has(item)) failures.push(`${label} 覆盖缺失：${item}`);
  }
}

export function validateDialogueStabilityScenarioMatrix(scenarios) {
  const failures = [];
  if (!Array.isArray(scenarios)) {
    return { ok: false, failures: ['scenarios.json 必须是数组。'], metrics: {} };
  }

  const historical = scenarios.filter((scenario) => scenario.coverage?.historical === true);
  if (historical.length < 12) {
    failures.push(`历史高频错误范例必须至少 12 个，当前 ${historical.length}/12。`);
  }

  for (const scenario of scenarios) {
    const missing = missingRequiredFields(scenario);
    if (missing.length > 0) {
      failures.push(`${scenario.id ?? '<unknown>'} 缺少字段：${missing.join(', ')}`);
    }
  }

  const marketingStages = collectCoverage(scenarios, 'marketingStage');
  const capabilityCategories = collectCoverage(scenarios, 'capabilityCategory');
  const processTemplates = collectCoverage(scenarios, 'processTemplate');
  const skillKinds = collectCoverage(scenarios, 'skillKind');

  requireCoverage({ failures, label: '营销飞轮六阶段', required: REQUIRED_MARKETING_STAGES, actual: marketingStages });
  requireCoverage({ failures, label: '能力中心大类', required: REQUIRED_CAPABILITY_CATEGORIES, actual: capabilityCategories });
  requireCoverage({ failures, label: '流程模板', required: REQUIRED_PROCESS_TEMPLATES, actual: processTemplates });
  requireCoverage({ failures, label: 'Skill 类型', required: REQUIRED_SKILL_KINDS, actual: skillKinds });

  const metrics = {
    total: scenarios.length,
    historical: historical.length,
    marketingStages: [...marketingStages].sort(),
    capabilityCategories: [...capabilityCategories].sort(),
    processTemplates: [...processTemplates].sort(),
    skillKinds: [...skillKinds].sort(),
  };

  return { ok: failures.length === 0, failures, metrics };
}

async function writeReport({ repoRoot, results, matrix, suite }) {
  const docsDir = path.join(repoRoot, 'docs');
  await fs.mkdir(docsDir, { recursive: true });
  const reportPath = path.join(docsDir, `dialogue-stability-full-chain-acceptance-${todayStamp()}.md`);
  const passed = results.filter((result) => result.ok).length;
  const lines = [
    '# 对话稳定性与五入口交付统一全链路验收',
    '',
    `- 时间：${new Date().toISOString()}`,
    `- Suite：${suite}`,
    `- 矩阵：${matrix.ok ? '通过' : '失败'}`,
    `- 结果：${passed}/${results.length} 场景通过`,
    '',
    '## 覆盖率矩阵',
    '',
    `- 历史事故范例：${matrix.metrics.historical ?? 0}/12`,
    `- 能力中心大类：${(matrix.metrics.capabilityCategories ?? []).join('、')}`,
    `- 营销飞轮阶段：${(matrix.metrics.marketingStages ?? []).join('、')}`,
    `- 流程模板：${(matrix.metrics.processTemplates ?? []).join('、')}`,
    `- Skill 类型：${(matrix.metrics.skillKinds ?? []).join('、')}`,
    ...(matrix.failures.length > 0 ? ['', '## 矩阵失败项', '', ...matrix.failures.map((failure) => `- ${failure}`)] : []),
    '',
    '## 执行场景',
    '',
    '| 场景 | 结果 | 命令 |',
    '| --- | --- | --- |',
    ...results.map((result) => (
      `| ${result.title} | ${result.ok ? '通过' : '失败'} | ${result.commands.map((command) => `\`${command.command}\``).join('<br>')} |`
    )),
    '',
  ];
  await fs.writeFile(reportPath, `${lines.join('\n')}\n`, 'utf8');
  return reportPath;
}

export async function runDialogueStabilityScenarios({
  repoRoot,
  scenariosPath,
  suite = 'all',
}) {
  const raw = await fs.readFile(scenariosPath, 'utf8');
  const scenarios = JSON.parse(raw);
  const matrix = validateDialogueStabilityScenarioMatrix(scenarios);
  if (!matrix.ok) {
    console.error('[dialogue-stability] 矩阵校验失败：');
    for (const failure of matrix.failures) {
      console.error(`- ${failure}`);
    }
  }
  const executableScenarios = suite === 'all'
    ? scenarios
    : scenarios.filter((scenario) => (scenario.suites ?? []).includes(suite));
  const results = [];

  for (const scenario of executableScenarios) {
    console.log(`\n[dialogue-stability] ${scenario.id} ${scenario.title}`);
    const commandResults = [];
    for (const command of scenario.commands ?? []) {
      commandResults.push(await runCommand(command, repoRoot));
      if (!commandResults[commandResults.length - 1].ok) break;
    }
    results.push({
      id: scenario.id,
      title: scenario.title,
      ok: commandResults.every((result) => result.ok),
      commands: commandResults,
    });
  }

  const reportPath = await writeReport({ repoRoot, results, matrix, suite });
  return {
    ok: matrix.ok && results.every((result) => result.ok),
    results,
    reportPath,
    matrix,
  };
}
