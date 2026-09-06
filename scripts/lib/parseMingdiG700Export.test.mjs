import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { MINGDI_G700_20260718_CASES } from '../../tests/fixtures/mingdi-g700-20260718-cases.ts';
import * as auditModule from '../audit-mingdi-g700-exports.mjs';
import * as parserModule from './parseMingdiG700Export.mjs';
import {
  MINGDI_G700_METRIC_KEYS,
  assertMingdiG700ManifestMatches,
  computeMingdiG700Metrics,
  failureLabelsFromMetrics,
  parseMingdiG700Export,
} from './parseMingdiG700Export.mjs';

function fixtureById(id) {
  const fixture = MINGDI_G700_20260718_CASES.find((item) => item.id === id);
  assert.ok(fixture, `缺少 fixture：${id}`);
  return fixture;
}

test('Windows npm 剥离命名参数时仍能解析 baseline 目录', () => {
  assert.deepEqual(
    auditModule.resolveMingdiAuditOptions(
      ['C:\\Users\\example\\Downloads'],
      {
        npm_config_gate: 'baseline',
        npm_config_exports_dir: 'true',
      },
    ),
    {
      gate: 'baseline',
      exportsDir: 'C:\\Users\\example\\Downloads',
    },
  );
});

test('三项权威成果合同严格保持原始用户意图', () => {
  const strategy = fixtureById('strategy');
  assert.doesNotMatch(strategy.sanitizedGoal, /报告|文件|交付/);
  assert.deepEqual(strategy.expectedFiles, []);

  const last30days = fixtureById('last30days');
  assert.deepEqual(last30days.expectedFiles, [
    {
      basename: 'marketing-deliverable-2026-07-18.html',
      kind: 'html',
      required: true,
    },
  ]);

  const productResearch = fixtureById('product-research');
  assert.deepEqual(productResearch.expectedFiles, [
    {
      basename: 'product-2026-07-18.html',
      kind: 'html',
      required: true,
    },
  ]);
});

test('expectedFiles 参与精确成果合同指标计算', () => {
  const strategy = fixtureById('strategy');
  const strategyMetrics = computeMingdiG700Metrics(
    strategy.structureEvidence,
    parserModule.buildMingdiG700CaseContract(strategy),
  );
  assert.equal(strategyMetrics.scope_expansion, 1);
  assert.equal(strategyMetrics.false_incomplete_loop, 1);

  const last30days = fixtureById('last30days');
  const last30daysMetrics = computeMingdiG700Metrics(
    last30days.structureEvidence,
    parserModule.buildMingdiG700CaseContract(last30days),
  );
  assert.ok(last30daysMetrics.scope_expansion >= 3);
  assert.equal(last30daysMetrics.deliverable_contract_mismatch, 1);

  const productResearch = fixtureById('product-research');
  const productMetrics = computeMingdiG700Metrics(
    productResearch.structureEvidence,
    parserModule.buildMingdiG700CaseContract(productResearch),
  );
  assert.equal(productMetrics.scope_expansion, 1);
  assert.equal(productMetrics.output_kind_mismatch, 1);
  assert.equal(productMetrics.deliverable_contract_mismatch, 1);
});

test('失败标签要求精确集合相等并拒绝多报', () => {
  assert.deepEqual(
    parserModule.compareFailureLabelSets(
      ['snapshot_missing'],
      ['snapshot_missing', 'scope_expansion'],
    ),
    {
      pass: false,
      missing: [],
      unexpected: ['scope_expansion'],
    },
  );
});

test('脱敏结构 fixture 可离线复放全部 11 个案例', () => {
  assert.equal(MINGDI_G700_20260718_CASES.length, 11);

  for (const fixture of MINGDI_G700_20260718_CASES) {
    const metrics = computeMingdiG700Metrics(
      fixture.structureEvidence,
      parserModule.buildMingdiG700CaseContract(fixture),
    );
    const labels = failureLabelsFromMetrics(metrics);

    for (const key of MINGDI_G700_METRIC_KEYS) {
      assert.equal(typeof metrics[key], 'number', `${fixture.id} 缺少指标 ${key}`);
    }
    const comparison = parserModule.compareFailureLabelSets(
      fixture.expectedFailureLabels,
      labels,
    );
    assert.equal(
      comparison.pass,
      true,
      `${fixture.id} 标签不精确：缺失=${comparison.missing.join(',')} 多报=${comparison.unexpected.join(',')}`,
    );
  }
});

test('实施报告不保存绝对 Downloads 路径', () => {
  const report = fs.readFileSync(
    new URL(
      '../../artifacts/mingdi-g700-production-acceptance/p0-0-report.md',
      import.meta.url,
    ),
    'utf8',
  );
  assert.doesNotMatch(report, /[A-Z]:\\Users\\[^\\]+\\Downloads/i);
  assert.match(report, /<本地导出目录>/);
});

test('原始 HTML 解析复用四线解析器并识别稳态失败指标', () => {
  const rows = [
    ['目标报告', 'Markdown', '校验中…', '—'],
    ['第 1 页', 'PNG', '已完成', 'slide-01.png'],
    ['第 2 页', 'PNG', '已完成', 'slide-02.png'],
    ['第 3 页', 'PNG', '已完成', 'slide-03.png'],
    ['第 4 页', 'PNG', '已完成', 'slide-04.png'],
    ['第 5 页', 'PNG', '已完成', 'slide-05.png'],
    ['第 6 页', 'PNG', '已完成', 'slide-06.png'],
    ['第 7 页', 'PNG', '未完成', '—'],
    ['第 8 页', 'PNG', '未完成', '—'],
    ['第 9 页', 'PNG', '未完成', '—'],
    ['第 10 页', 'PNG', '未完成', '—'],
    ['选题', 'Markdown', '已完成', '01-topics.md'],
    ['长文', 'Markdown', '已完成', '02-longform.md'],
    ['社媒切片', 'Markdown', '已完成', '03-social-slices.md'],
  ];
  const tableRows = rows
    .map((cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
    .join('');
  const html = `
    <article class="message role-user">
      <div class="message-body">鸣镝 G700 官方素材任务</div>
    </article>
    <article class="message role-tool">
      <span class="role">工具调用: generate_image</span>
      <div class="message-body">{"output_path":"artifacts/task-current/slide-01.png"}</div>
    </article>
    <article class="message role-thinking">
      <div class="message-body">远程图片全部404，改用 SVG 占位图。误搜到空气净化器。</div>
    </article>
    <article class="message role-assistant">
      <div class="message-body">任务已完成，全部交付完成。</div>
    </article>
    <section data-testid="deliverable-summary-table" data-contract-hash="contract-a">
      <table><tbody>${tableRows}</tbody></table>
    </section>
    <pre id="nova-session-export-index">{"snapshotEnvelope":null,"fourLineDebug":{"contractHash":"contract-a"}}</pre>
  `;

  const parsed = parseMingdiG700Export(html, {
    snapshotRequired: true,
    scopeGuardBasenames: ['01-topics.md', '02-longform.md', '03-social-slices.md'],
    officialMediaOnly: true,
    officialMediaEvidenceRequired: true,
    forbidGenerateImage: true,
    expectedSlideCount: 6,
    requiredOutputKindGroups: [['mp4']],
    forbiddenEntityTerms: ['空气净化器'],
  });

  assert.equal(parsed.fourLine.deliverableTable.rows.length, rows.length);
  assert.equal(parsed.metrics.scope_expansion, 3);
  assert.equal(parsed.metrics.passed_with_pending, 1);
  assert.equal(parsed.metrics.official_media_violation, 1);
  assert.equal(parsed.metrics.forbidden_generate_image, 1);
  assert.equal(parsed.metrics.unreachable_hotlink, 1);
  assert.equal(parsed.metrics.unlabeled_degrade, 1);
  assert.equal(parsed.metrics.entity_misclassification, 1);
  assert.equal(parsed.metrics.slide_count_drift, 4);
  assert.equal(parsed.metrics.output_kind_mismatch, 1);
  assert.equal(parsed.metrics.snapshot_missing, 1);
});

test('baseline manifest 对缺失、重复与 SHA-256 不符严格失败', async (t) => {
  const manifest = {
    expectedCount: 2,
    entries: [
      { id: 'a', basename: 'a.html', sha256: 'a'.repeat(64) },
      { id: 'b', basename: 'b.html', sha256: 'b'.repeat(64) },
    ],
  };

  await t.test('缺失文件', () => {
    assert.throws(
      () => assertMingdiG700ManifestMatches(manifest, [
        { basename: 'a.html', sha256: 'a'.repeat(64) },
      ]),
      /缺失/,
    );
  });

  await t.test('重复文件', () => {
    assert.throws(
      () => assertMingdiG700ManifestMatches(manifest, [
        { basename: 'a.html', sha256: 'a'.repeat(64) },
        { basename: 'a.html', sha256: 'a'.repeat(64) },
      ]),
      /重复/,
    );
  });

  await t.test('哈希不一致', () => {
    assert.throws(
      () => assertMingdiG700ManifestMatches(manifest, [
        { basename: 'a.html', sha256: '0'.repeat(64) },
        { basename: 'b.html', sha256: 'b'.repeat(64) },
      ]),
      /SHA-256/,
    );
  });
});
