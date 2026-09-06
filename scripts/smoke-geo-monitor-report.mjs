#!/usr/bin/env node
/**
 * PD-SAAS-FORK: GEO 监测 HTML 报告 smoke（fixture → DOM 断言）
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateLlmCoverageModels, getRequiredModelIds } from './lib/geoLlmCoverageRequired.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = path.join(ROOT, 'skills', 'geo-monitor-report', 'templates', 'geo-monitor-report.html');
const TEMPLATE_DIR = path.join(ROOT, 'skills', 'geo-dual-report', 'templates');
const REQUIRED_CONFIG = path.join(ROOT, 'config', 'geo-llm-coverage-required-models.json');

function buildRequiredModelsFixture() {
  const cfg = JSON.parse(readFileSync(REQUIRED_CONFIG, 'utf8'));
  const rows = [...(cfg.cn?.models || []), ...(cfg.global?.models || [])];
  return rows.map((m, i) => ({
    id: m.id,
    name: m.name,
    region: cfg.cn?.models?.some((x) => x.id === m.id) ? 'cn' : 'global',
    indexing_status: i < 5 ? 'partial' : 'unknown',
    indexing_score: i < 5 ? 55 + i : 0,
    mention_rate: i < 5 ? 40 : 0,
    status: i < 5 ? 'ok' : 'skipped',
    evidence_summary: i < 5 ? 'smoke fixture' : '缺 Key 占位',
  }));
}

const FIXTURE = {
  brand: 'Nova Test',
  site: 'example.com',
  subject: { type: 'brand', name: 'Nova Test', aliases: ['Nova'], keywords: ['最好的 AI 工具'] },
  generated_at: new Date().toISOString(),
  overall_score: 72,
  mention_rate: 45,
  top_pick_rate: 18,
  llm_coverage: {
    coverage_score: 58,
    summary: '十一模型 smoke fixture',
    models: buildRequiredModelsFixture(),
    gaps: [{ model_id: 'doubao', gap: '首位推荐为 0', severity: 'medium' }],
    optimization: [{ priority: 'P0', target_models: ['qwen', 'doubao'], action: '补齐 FAQ 可引用段落', rationale: '提高 partial 模型收录' }],
  },
  engines: buildRequiredModelsFixture().slice(0, 5).map((m) => ({ id: m.id, name: m.name, score: m.indexing_score })),
  competitors: [{ name: '竞品A', score: 55 }],
  queries: [{ text: '最好的 AI 工具', mentioned: true }, { text: 'XX 对比', mentioned: false }],
  dimensions: { technical: 70, citability: 65, schema: 80, entity: 60 },
  actions: [{ priority: 'P0', text: '补齐 llms.txt' }],
};
const OUT_DIR = path.join(ROOT, 'artifacts', 'geo-monitor-smoke');

function inlineNgrs(html) {
  const css = readFileSync(path.join(TEMPLATE_DIR, 'geo-report-theme.css'), 'utf8');
  const js = readFileSync(path.join(TEMPLATE_DIR, 'geo-chart-theme.js'), 'utf8');
  return html
    .replace(/<link rel="stylesheet" href="geo-report-theme.css"\s*\/>/, `<style>\n${css}\n</style>`)
    .replace(/<script src="geo-chart-theme.js"><\/script>/, `<script>\n${js}\n</script>`);
}

function main() {
  const errors = [];
  if (!existsSync(TEMPLATE)) errors.push('missing HTML template');
  if (!existsSync(REQUIRED_CONFIG)) errors.push('missing geo-llm-coverage-required-models.json');

  const coverageCheck = validateLlmCoverageModels(FIXTURE.llm_coverage.models);
  if (!coverageCheck.ok) {
    errors.push(`fixture missing required model ids: ${coverageCheck.missing.join(', ')}`);
  }
  if (getRequiredModelIds().length !== 11) errors.push('required model config not 11 ids');

  let html = readFileSync(TEMPLATE, 'utf8');
  html = html
    .replace(/\{\{BRAND\}\}/g, FIXTURE.brand)
    .replace(/\{\{SITE\}\}/g, FIXTURE.site)
    .replace(/\{\{OVERALL_SCORE\}\}/g, String(FIXTURE.overall_score))
    .replace(/\{\{MONITOR_DATA_JSON\}\}/g, JSON.stringify(FIXTURE));

  for (const token of [
    'data-ngrs-kpi-grid',
    'data-ngrs-chart-grid',
    'data-ngrs-action-list',
    'NGRS.renderReport',
    'NGRS.monitorDataToCharts',
  ]) {
    if (!html.includes(token)) errors.push(`missing ${token}`);
  }
  if (!html.includes('Chart.js') && !html.includes('chart.js')) errors.push('missing Chart.js reference');

  html = inlineNgrs(html);
  if (!html.includes('llmIndexingBar') && !html.includes('llm_coverage')) {
    errors.push('missing llm_coverage / llmIndexingBar support');
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const outHtml = path.join(OUT_DIR, 'geo-monitor-report.html');
  const outJson = path.join(OUT_DIR, 'monitor-data.json');
  writeFileSync(outHtml, html, 'utf8');
  writeFileSync(outJson, `${JSON.stringify(FIXTURE, null, 2)}\n`, 'utf8');

  const ok = errors.length === 0;
  console.log(`[smoke:geo-monitor-report] ok=${ok}`);
  console.log(`[smoke:geo-monitor-report] html=${outHtml}`);
  if (errors.length) {
    for (const e of errors) console.log(`  - ${e}`);
    process.exitCode = 1;
  }
}

main();
