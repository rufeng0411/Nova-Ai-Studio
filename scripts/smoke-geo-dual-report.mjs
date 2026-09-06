#!/usr/bin/env node
/**
 * PD-SAAS-FORK: GEO 分析报告 MD+HTML 双交付 smoke
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGeoDualReportManifest } from './lib/geoDualReport.mjs';
import { HUB_DELIVERABLE_BY_SLUG } from './lib/promptTemplateStrategy.mjs';

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
const CATALOG = path.join(ROOT, 'config', 'capabilities.catalog.json');
const OUT_DIR = path.join(ROOT, 'artifacts', 'geo-dual-report-smoke');

function inlineNgrs(html) {
  const cssPath = path.join(TEMPLATE_DIR, 'geo-report-theme.css');
  const jsPath = path.join(TEMPLATE_DIR, 'geo-chart-theme.js');
  const css = readFileSync(cssPath, 'utf8');
  const js = readFileSync(jsPath, 'utf8');
  return html
    .replace(/<link rel="stylesheet" href="geo-report-theme.css"\s*\/>/, `<style>\n${css}\n</style>`)
    .replace(/<script src="geo-chart-theme.js"><\/script>/, `<script>\n${js}\n</script>`);
}

function assertTemplate(name, filePath, requiredIds) {
  const errors = [];
  if (!existsSync(filePath)) {
    errors.push(`missing template ${name}`);
    return errors;
  }
  const html = readFileSync(filePath, 'utf8');
  if (!html.includes('Chart.js') && !html.includes('chart.js')) {
    errors.push(`${name}: missing Chart.js`);
  }
  if (!html.includes('ngrsFadeUp') && !html.includes('geo-report-theme.css')) {
    errors.push(`${name}: missing NGRS theme (ngrsFadeUp or geo-report-theme.css link)`);
  }
  if (!html.includes('NGRS.renderReport') && !html.includes('NGRS.monitorDataToCharts')) {
    if (!html.includes('geo-chart-theme.js')) {
      errors.push(`${name}: missing NGRS chart driver`);
    }
  }
  for (const id of requiredIds) {
    if (!html.includes(id)) errors.push(`${name}: missing ${id}`);
  }
  return errors;
}

function main() {
  const errors = [];
  const manifest = loadGeoDualReportManifest();
  const bindings = manifest.bindings || [];

  if (bindings.length < 20) {
    errors.push(`manifest bindings too few (${bindings.length})`);
  }

  const seenPairs = new Set();
  for (const b of bindings) {
    const key = `${b.slug}::${b.md}`;
    if (seenPairs.has(key)) errors.push(`duplicate binding ${key}`);
    seenPairs.add(key);
    if (!b.md?.endsWith('.md')) errors.push(`invalid md ${b.md}`);
    if (!b.html?.endsWith('.html')) errors.push(`invalid html ${b.html}`);
    if (b.type && !manifest.reportTypes?.[b.type]) {
      errors.push(`unknown report type ${b.type} for ${b.slug}`);
    }
    if (b.templateSkill === 'geo-monitor-report') {
      if (!existsSync(MONITOR_TEMPLATE)) errors.push('missing geo-monitor-report template');
    }
  }

  errors.push(
    ...assertTemplate('geo-report-base', BASE_TEMPLATE, [
      'report-data',
      'data-ngrs-kpi-grid',
      'data-ngrs-chart-grid',
      'data-ngrs-action-list',
    ]),
  );

  const fixture = {
    title: 'GEO 双交付 Smoke',
    subtitle: 'Nova Test · 2026-06-10',
    reportType: '审计报告',
    score: 82,
    kpis: [{ label: '综合分', value: '82' }],
    charts: [
      {
        id: 'main',
        kind: 'dimensionRadar',
        title: '维度得分',
        labels: ['技术', '可引用'],
        values: [80, 84],
      },
      {
        id: 'sec',
        kind: 'summaryBar',
        title: '摘要',
        labels: ['A', 'B'],
        values: [70, 65],
      },
    ],
    sections: [{ heading: '发现', html: '<p>Smoke 通过。</p>' }],
    actions: [{ priority: 'P0', text: '补齐 llms.txt' }],
  };

  let html = readFileSync(BASE_TEMPLATE, 'utf8');
  html = html
    .replace(/\{\{TITLE\}\}/g, fixture.title)
    .replace(/\{\{SUBTITLE\}\}/g, fixture.subtitle)
    .replace(/\{\{REPORT_TYPE\}\}/g, fixture.reportType)
    .replace(/\{\{REPORT_DATA_JSON\}\}/g, JSON.stringify(fixture));
  html = inlineNgrs(html);

  mkdirSync(OUT_DIR, { recursive: true });
  const outHtml = path.join(OUT_DIR, 'geo-deliverable.html');
  writeFileSync(outHtml, html, 'utf8');

  if (existsSync(CATALOG)) {
    const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));
    const slugs = new Set((catalog.skills || []).map((s) => s.slug));
    if (!slugs.has('geo-dual-report')) errors.push('catalog missing geo-dual-report');
    for (const b of bindings) {
      if (b.slug === 'geo-dual-report') continue;
      if (!slugs.has(b.slug)) errors.push(`manifest slug not in catalog: ${b.slug}`);
    }
  }

  for (const b of bindings) {
    if (b.slug === 'geo-dual-report' || b.slug === 'geo-monitor-report') continue;
    const deliverables = HUB_DELIVERABLE_BY_SLUG[b.slug];
    if (!deliverables) continue;
    const text = deliverables.join(' ');
    const htmlBase = b.html.replace(/\.html$/i, '');
    const mdBase = b.md.replace(/\.md$/i, '');
    if (!text.includes(htmlBase) && !text.includes(mdBase)) {
      errors.push(`HUB deliverables for ${b.slug} missing ${b.html} (md=${b.md})`);
    }
  }

  const ok = errors.length === 0;
  console.log(`[smoke:geo-dual-report] ok=${ok} bindings=${bindings.length}`);
  console.log(`[smoke:geo-dual-report] html=${outHtml}`);
  if (errors.length) {
    for (const e of errors) console.log(`  - ${e}`);
    process.exitCode = 1;
  }
}

main();
