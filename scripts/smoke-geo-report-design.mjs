#!/usr/bin/env node
/**
 * PD-SAAS-FORK: NGRS v1 设计系统 smoke — ChartCatalog + 动效 + 多 reportType 预览
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGeoDualReportManifest } from './lib/geoDualReport.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE_DIR = path.join(ROOT, 'skills', 'geo-dual-report', 'templates');
const BASE_TEMPLATE = path.join(TEMPLATE_DIR, 'geo-report-base.html');
const MONITOR_TEMPLATE = path.join(
  ROOT,
  'skills',
  'geo-monitor-report',
  'templates',
  'geo-monitor-report.html',
);
const THEME_CSS = path.join(TEMPLATE_DIR, 'geo-report-theme.css');
const CHART_JS = path.join(TEMPLATE_DIR, 'geo-chart-theme.js');
const DESIGN_JSON = path.join(ROOT, 'config', 'geo-report-design-system.json');
const CATALOG_JSON = path.join(ROOT, 'config', 'geo-chart-catalog.json');
const OUT_DIR = path.join(ROOT, 'artifacts', 'geo-report-design-preview');

const PREVIEW_TYPES = ['audit', 'research', 'competitor', 'monitor'];

function inlineNgrs(html) {
  const css = readFileSync(THEME_CSS, 'utf8');
  const js = readFileSync(CHART_JS, 'utf8');
  return html
    .replace(/<link rel="stylesheet" href="geo-report-theme.css"\s*\/>/, `<style>\n${css}\n</style>`)
    .replace(/<script src="geo-chart-theme.js"><\/script>/, `<script>\n${js}\n</script>`);
}

function fixtureForType(type, manifest) {
  const charts = manifest.reportTypes?.[type]?.charts || [];
  const chartConfigs = charts.slice(0, 3).map((kind, i) => ({
    kind,
    id: `preview-${type}-${i}`,
    title: kind,
    labels: ['A', 'B', 'C'],
    values: [72, 65, 58],
    pass: 70,
    warn: 20,
    fail: 10,
    value: 78,
  }));

  return {
    title: `NGRS 预览 · ${manifest.reportTypes?.[type]?.label || type}`,
    subtitle: 'Nova Test · 2026-06-10',
    reportType: manifest.reportTypes?.[type]?.label || type,
    score: 78,
    generatedAt: '2026-06-10',
    kpis: [
      { label: '综合分', value: 78 },
      { label: '提及率', value: '45%', sparkline: [30, 35, 40, 42, 45] },
    ],
    charts: chartConfigs.length >= 2 ? chartConfigs : [
      { kind: 'summaryBar', id: 'fb-bar', title: '摘要', labels: ['X', 'Y'], values: [80, 65] },
      { kind: 'distributionDoughnut', id: 'fb-donut', title: '分布', labels: ['A', 'B'], values: [60, 40] },
    ],
    sections: [{ heading: '发现', html: '<p>NGRS smoke fixture。</p>' }],
    actions: [
      { priority: 'P0', text: '补齐 llms.txt' },
      { priority: 'P1', text: '优化高意图问句' },
    ],
  };
}

function assertFile(filePath, label) {
  if (!existsSync(filePath)) return [`missing ${label}: ${filePath}`];
  return [];
}

function assertTemplate(html, name) {
  const errors = [];
  const required = [
    'ngrsFadeUp',
    '--ngrs-accent',
    'NGRS.renderReport',
    'data-ngrs-chart-grid',
    'data-ngrs-kpi-grid',
    'prefers-reduced-motion',
  ];
  for (const token of required) {
    if (token === 'NGRS.renderReport') {
      if (!html.includes('NGRS.renderReport') && !html.includes('NGRS.monitorDataToCharts')) {
        errors.push(`${name}: missing NGRS.renderReport`);
      }
      continue;
    }
    if (!html.includes(token)) errors.push(`${name}: missing ${token}`);
  }
  return errors;
}

function assertCatalog(catalog) {
  const errors = [];
  const kinds = Object.keys(catalog.kinds || {});
  if (kinds.length < 12) errors.push(`chart catalog kinds too few (${kinds.length})`);
  for (const alias of ['score-bar', 'keyword-bar', 'engine-sov']) {
    if (!catalog.aliases?.[alias]) errors.push(`catalog missing alias ${alias}`);
  }
  return errors;
}

function main() {
  const errors = [];
  errors.push(...assertFile(DESIGN_JSON, 'geo-report-design-system.json'));
  errors.push(...assertFile(CATALOG_JSON, 'geo-chart-catalog.json'));
  errors.push(...assertFile(THEME_CSS, 'geo-report-theme.css'));
  errors.push(...assertFile(CHART_JS, 'geo-chart-theme.js'));
  errors.push(...assertFile(BASE_TEMPLATE, 'geo-report-base.html'));
  errors.push(...assertFile(MONITOR_TEMPLATE, 'geo-monitor-report.html'));

  const catalog = JSON.parse(readFileSync(CATALOG_JSON, 'utf8'));
  errors.push(...assertCatalog(catalog));

  const js = readFileSync(CHART_JS, 'utf8');
  if (!js.includes('chartAnimationPreset')) errors.push('geo-chart-theme.js missing chartAnimationPreset');
  if (!js.includes('countUpKpi')) errors.push('geo-chart-theme.js missing countUpKpi');
  if (!js.includes('renderScoreGauge')) errors.push('geo-chart-theme.js missing renderScoreGauge');
  if (!js.includes('animateRotate')) errors.push('geo-chart-theme.js missing animateRotate preset');

  const css = readFileSync(THEME_CSS, 'utf8');
  if (!css.includes('ngrs-gauge-fill')) errors.push('theme css missing scoreGauge');

  let baseHtml = readFileSync(BASE_TEMPLATE, 'utf8');
  let monitorHtml = readFileSync(MONITOR_TEMPLATE, 'utf8');
  const baseInlined = inlineNgrs(baseHtml);
  const monitorInlined = inlineNgrs(monitorHtml);
  errors.push(...assertTemplate(baseInlined, 'geo-report-base'));
  errors.push(...assertTemplate(monitorInlined, 'geo-monitor-report'));

  const manifest = loadGeoDualReportManifest();
  for (const type of PREVIEW_TYPES) {
    const rt = manifest.reportTypes?.[type];
    if (!rt) {
      errors.push(`manifest missing reportType ${type}`);
      continue;
    }
    if ((rt.charts || []).length < 2 && type !== 'monitor') {
      errors.push(`${type} charts < 2`);
    }
  }

  mkdirSync(OUT_DIR, { recursive: true });

  for (const type of PREVIEW_TYPES) {
    const fixture = fixtureForType(type, manifest);
    let html = readFileSync(BASE_TEMPLATE, 'utf8');
    html = html
      .replace(/\{\{TITLE\}\}/g, fixture.title)
      .replace(/\{\{SUBTITLE\}\}/g, fixture.subtitle)
      .replace(/\{\{REPORT_TYPE\}\}/g, fixture.reportType)
      .replace(/\{\{REPORT_DATA_JSON\}\}/g, JSON.stringify(fixture));
    html = inlineNgrs(html);
    const outPath = path.join(OUT_DIR, `preview-${type}.html`);
    writeFileSync(outPath, html, 'utf8');
  }

  const monitorFixture = {
    brand: 'Nova Test',
    site: 'example.com',
    subject: { type: 'product', name: 'Nova Studio', aliases: [], keywords: [] },
    overall_score: 72,
    mention_rate: 45,
    top_pick_rate: 18,
    llm_coverage: {
      coverage_score: 60,
      summary: 'smoke',
      models: [
        { id: 'qwen', name: '通义千问', indexing_score: 65, indexing_status: 'partial', status: 'ok' },
        { id: 'kimi', name: 'Kimi', indexing_score: 55, indexing_status: 'partial', status: 'ok' },
      ],
      gaps: [],
      optimization: [{ priority: 'P1', target_models: ['qwen'], action: '补充 schema', rationale: 'smoke' }],
    },
    engines: [{ id: 'bocha', name: '博查', sov: 40 }],
    competitors: [{ name: '竞品A', score: 55 }],
    queries: [{ mentioned: true }, { mentioned: false }],
    dimensions: { technical: 70, citability: 65, schema: 80, entity: 60 },
    actions: [{ priority: 'P0', text: '补齐 llms.txt' }],
  };
  let mHtml = readFileSync(MONITOR_TEMPLATE, 'utf8');
  mHtml = mHtml
    .replace(/\{\{BRAND\}\}/g, monitorFixture.brand)
    .replace(/\{\{SITE\}\}/g, monitorFixture.site)
    .replace(/\{\{OVERALL_SCORE\}\}/g, String(monitorFixture.overall_score))
    .replace(/\{\{MONITOR_DATA_JSON\}\}/g, JSON.stringify(monitorFixture));
  mHtml = inlineNgrs(mHtml);
  writeFileSync(path.join(OUT_DIR, 'preview-monitor.html'), mHtml, 'utf8');

  const ok = errors.length === 0;
  console.log(`[smoke:geo-report-design] ok=${ok} previews=${PREVIEW_TYPES.length + 1}`);
  console.log(`[smoke:geo-report-design] out=${OUT_DIR}`);
  if (errors.length) {
    for (const e of errors) console.log(`  - ${e}`);
    process.exitCode = 1;
  }
}

main();
