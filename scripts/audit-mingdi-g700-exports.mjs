#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Replay the sanitized Mingdi G700 fixture or audit 11 raw exports.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MINGDI_G700_20260718_CASES } from '../tests/fixtures/mingdi-g700-20260718-cases.ts';
import {
  MINGDI_G700_METRIC_KEYS,
  assertMingdiG700ManifestMatches,
  buildMingdiG700CaseContract,
  compareFailureLabelSets,
  computeMingdiG700Metrics,
  failureLabelsFromMetrics,
  parseMingdiG700Export,
} from './lib/parseMingdiG700Export.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const FIXTURE_MANIFEST_PATH = path.join(
  REPO_ROOT,
  'tests',
  'fixtures',
  'mingdi-g700-20260718-exports.manifest.json',
);
const BASELINE_JSON_PATH = path.join(
  REPO_ROOT,
  'artifacts',
  'mingdi-g700-production-acceptance',
  'baseline.json',
);
const BASELINE_DOC_PATH = path.join(
  REPO_ROOT,
  'docs',
  'mingdi-g700-production-hardening-baseline-20260718.zh-CN.md',
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256File(filePath) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(filePath))
    .digest('hex');
}

function readArg(args, name) {
  const inlinePrefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(inlinePrefix));
  if (inline) return inline.slice(inlinePrefix.length);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export function resolveMingdiAuditOptions(
  args = process.argv.slice(2),
  env = process.env,
) {
  const gate = readArg(args, '--gate') || env.npm_config_gate;
  const npmExportsDir = /^(?:true|false)$/i.test(
    String(env.npm_config_exports_dir ?? ''),
  )
    ? undefined
    : env.npm_config_exports_dir;
  let exportsDir = readArg(args, '--exports-dir')
    || env.MINGDI_G700_EXPORTS_DIR
    || npmExportsDir;
  if (!exportsDir && gate === 'baseline') {
    exportsDir = args.find((arg) => !arg.startsWith('--'));
  }
  return { gate, exportsDir };
}

function metricTotals(results) {
  const totals = Object.fromEntries(
    MINGDI_G700_METRIC_KEYS.map((key) => [key, 0]),
  );
  for (const result of results) {
    for (const key of MINGDI_G700_METRIC_KEYS) {
      totals[key] += Number(result.metrics[key] ?? 0);
    }
  }
  return totals;
}

function replayFixtureCase(fixture) {
  const metrics = computeMingdiG700Metrics(
    fixture.structureEvidence,
    buildMingdiG700CaseContract(fixture),
  );
  const observedFailureLabels = failureLabelsFromMetrics(metrics);
  const comparison = compareFailureLabelSets(
    fixture.expectedFailureLabels,
    observedFailureLabels,
  );
  return {
    id: fixture.id,
    sanitizedGoal: fixture.sanitizedGoal,
    expectedFailureLabels: fixture.expectedFailureLabels,
    observedFailureLabels,
    missingExpectedFailureLabels: comparison.missing,
    unexpectedFailureLabels: comparison.unexpected,
    metrics,
    pass: comparison.pass,
  };
}

export function runSanitizedReplay() {
  const results = MINGDI_G700_20260718_CASES.map(replayFixtureCase);
  const passed = results.filter((result) => result.pass).length;
  const report = {
    mode: 'sanitized_fixture_replay',
    caseCount: results.length,
    passed,
    metrics: metricTotals(results),
    results,
    pass: passed === results.length && results.length === 11,
  };

  console.log(
    `[鸣镝 G700] 脱敏结构回放：${passed}/${results.length} 案例复现预期问题标签`,
  );
  if (!report.pass) {
    const failures = results
      .filter((result) => !result.pass)
      .map((result) => (
        `${result.id}: 缺失=${result.missingExpectedFailureLabels.join('、') || '无'}`
        + `，多报=${result.unexpectedFailureLabels.join('、') || '无'}`
      ));
    throw new Error(`普通回放未通过：${failures.join('；')}`);
  }
  return report;
}

function listRawExports(exportsDir) {
  if (!fs.existsSync(exportsDir) || !fs.statSync(exportsDir).isDirectory()) {
    throw new Error('baseline 导出目录不存在或不是目录');
  }
  return fs.readdirSync(exportsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('2026-07-18.html'))
    .map((entry) => ({
      basename: entry.name,
      filePath: path.join(exportsDir, entry.name),
    }))
    .sort((left, right) => left.basename.localeCompare(right.basename, 'zh-CN'));
}

function assertFixtureManifestAlignment(manifest) {
  const fixturesById = new Map(
    MINGDI_G700_20260718_CASES.map((fixture) => [fixture.id, fixture]),
  );
  if (fixturesById.size !== 11 || manifest.entries.length !== 11) {
    throw new Error('案例 fixture 与导出 manifest 必须同时严格为 11 条');
  }
  for (const entry of manifest.entries) {
    const fixture = fixturesById.get(entry.id);
    if (!fixture) throw new Error(`manifest 案例缺少结构 fixture：${entry.id}`);
    if (fixture.exportBasename !== entry.basename) {
      throw new Error(`fixture 与 manifest basename 不一致：${entry.id}`);
    }
  }
  return fixturesById;
}

function sanitizeBaselineEvidence(evidence) {
  return {
    deliverableRows: evidence.deliverableRows,
    toolCalls: evidence.toolCalls,
    snapshotPresent: evidence.snapshotPresent,
    completionClaim: evidence.completionClaim,
    crossSessionArtifactCount: evidence.crossSessionArtifactCount,
    falseIncompleteSignals: evidence.falseIncompleteSignals,
    unreachableHotlinkCount: evidence.unreachableHotlinkCount,
    syntheticPlaceholderCount: evidence.syntheticPlaceholderCount,
    degradeDisclosed: evidence.degradeDisclosed,
    entityMisclassificationCount: evidence.entityMisclassificationCount,
    observedContractSlideCount: evidence.observedContractSlideCount,
    outputKinds: evidence.outputKinds,
    contentAssertionFailures: evidence.contentAssertionFailures,
    officialMediaProvenanceComplete: evidence.officialMediaProvenanceComplete,
  };
}

function auditRawCase(entry, fixture, filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const parsed = parseMingdiG700Export(
    html,
    buildMingdiG700CaseContract(fixture),
  );
  const comparison = compareFailureLabelSets(
    fixture.expectedFailureLabels,
    parsed.failureLabels,
  );
  return {
    id: fixture.id,
    sanitizedGoal: fixture.sanitizedGoal,
    exportBasename: entry.basename,
    sha256: entry.sha256,
    expectedFiles: fixture.expectedFiles,
    expectedFailureLabels: fixture.expectedFailureLabels,
    observedFailureLabels: parsed.failureLabels,
    missingExpectedFailureLabels: comparison.missing,
    unexpectedFailureLabels: comparison.unexpected,
    expectedFileContract: parsed.expectedFileContract,
    metrics: parsed.metrics,
    structureEvidence: sanitizeBaselineEvidence(parsed.structureEvidence),
    pass: comparison.pass,
  };
}

function renderBaselineMarkdown(report) {
  const lines = [
    '# 鸣镝 G700 内容与官方素材生产稳态基线（2026-07-18）',
    '',
    '## 结论',
    '',
    `- 原始导出严格核验：**${report.manifest.matched}/${report.manifest.expected}**`,
    `- 预期问题标签复现：**${report.summary.reproduced}/${report.summary.caseCount}**`,
    `- baseline 门禁：**${report.pass ? '通过' : '未通过'}**`,
    '- 本报告仅保留脱敏目标、导出 basename/SHA-256、成果结构、质量合同与失败标签；不记录绝对数据目录、用户 ID、Cookie、签名 URL 或完整私密正文。',
    '',
    '## 关键问题复现',
    '',
    '- `last30days`：01/02/03 三类成果越界扩张，并混入跨会话成果信号；唯一权威成果 `marketing-deliverable-2026-07-18.html` 缺失。',
    '- `strategy`：原始 consultation 无文件意图，但旧导出擅自生成 0/1 校验中成果合同并宣称完成。',
    '- `product-research`：唯一权威成果 `product-2026-07-18.html` 缺失，旧导出同时扩张出错误命名的 MD/HTML 合同。',
    '- `nova-slides`：用户要求 6 页，合同扩张至 10 页，且出现重复页绑定。',
    '- 官方素材：存在生图替代、官方来源证据缺失、远程热链不可达或占位降级。',
    '- 主体与输出：存在主体误判、视频输出类型错配以及内容断言失败。',
    '- 四线快照：11 份导出均缺少可核验 snapshot envelope。',
    '',
    '## 指标汇总',
    '',
    '| 指标 | 数量 |',
    '|---|---:|',
    ...MINGDI_G700_METRIC_KEYS.map(
      (key) => `| \`${key}\` | ${report.metricTotals[key]} |`,
    ),
    '',
    '## 11 案结果',
    '',
    '| 案例 | 结果 | 已复现标签 | 缺失预期标签 | 多报标签 |',
    '|---|---|---|---|---|',
    ...report.cases.map((item) => (
      `| ${item.id} | ${item.pass ? '通过' : '未通过'} | ${item.observedFailureLabels.join('、') || '无'} | ${item.missingExpectedFailureLabels.join('、') || '无'} | ${item.unexpectedFailureLabels.join('、') || '无'} |`
    )),
    '',
    '## 复现命令',
    '',
    '```powershell',
    'npm run test:mingdi-g700:replay -- --gate=baseline --exports-dir "<本地导出目录>"',
    '```',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function writeBaselineReports(report) {
  fs.mkdirSync(path.dirname(BASELINE_JSON_PATH), { recursive: true });
  fs.writeFileSync(
    BASELINE_JSON_PATH,
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
  fs.writeFileSync(
    BASELINE_DOC_PATH,
    renderBaselineMarkdown(report),
    'utf8',
  );
}

export function runBaselineAudit(exportsDir) {
  const manifest = readJson(FIXTURE_MANIFEST_PATH);
  const fixturesById = assertFixtureManifestAlignment(manifest);
  const rawExports = listRawExports(exportsDir);
  const actualExports = rawExports.map((item) => ({
    basename: item.basename,
    sha256: sha256File(item.filePath),
  }));
  const manifestResult = assertMingdiG700ManifestMatches(manifest, actualExports);
  const rawByName = new Map(rawExports.map((item) => [item.basename, item.filePath]));
  const cases = manifest.entries.map((entry) => auditRawCase(
    entry,
    fixturesById.get(entry.id),
    rawByName.get(entry.basename),
  ));
  const reproduced = cases.filter((item) => item.pass).length;
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: 'baseline',
    source: '本地原始导出（路径未记录）',
    manifest: {
      expected: manifestResult.expectedCount,
      matched: manifestResult.matchedCount,
    },
    summary: {
      caseCount: cases.length,
      reproduced,
    },
    metricTotals: metricTotals(cases),
    cases,
    pass: reproduced === 11 && cases.length === 11,
  };

  writeBaselineReports(report);
  console.log(
    `[鸣镝 G700] baseline：manifest ${report.manifest.matched}/${report.manifest.expected}，问题标签 ${reproduced}/${cases.length}`,
  );
  console.log(`[鸣镝 G700] 已写入 ${path.relative(REPO_ROOT, BASELINE_JSON_PATH)}`);
  console.log(`[鸣镝 G700] 已写入 ${path.relative(REPO_ROOT, BASELINE_DOC_PATH)}`);
  if (!report.pass) {
    const failed = cases
      .filter((item) => !item.pass)
      .map((item) => `${item.id}: ${item.missingExpectedFailureLabels.join('、')}`);
    throw new Error(`baseline 未复现全部预期问题：${failed.join('；')}`);
  }
  return report;
}

export function main(args = process.argv.slice(2)) {
  const { gate, exportsDir } = resolveMingdiAuditOptions(args);
  if (!gate) return runSanitizedReplay();
  if (gate !== 'baseline') {
    throw new Error(`不支持的 gate：${gate}`);
  }
  if (!exportsDir) {
    throw new Error(
      'baseline 模式必须提供 --exports-dir 或 MINGDI_G700_EXPORTS_DIR',
    );
  }
  return runBaselineAudit(path.resolve(exportsDir));
}

if (path.resolve(process.argv[1] ?? '') === SCRIPT_PATH) {
  try {
    main();
  } catch (error) {
    console.error(
      `[鸣镝 G700] ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
