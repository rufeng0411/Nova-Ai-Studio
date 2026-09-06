#!/usr/bin/env node
/**
 * PD-SAAS-FORK P1: audit capability scope / SDM hijack risks (exact slug only).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const CATALOG_PATH = path.join(REPO_ROOT, 'config', 'capabilities.catalog.json');
const REPORT_PATH = path.join(
  REPO_ROOT,
  'artifacts',
  'capability-scope-audit',
  'report.json',
);

const WATCH_SLUGS = new Set([
  'mkt-last30days',
  'ala-strategy-advisor',
  'nova-research-product-user',
  'nova-ppt-aesthetic-slides',
  'brand-campaign-full',
]);

export function auditCapabilityScopeCatalog(catalog) {
  const entries = Array.isArray(catalog?.skills) ? catalog.skills : [];
  const findings = [];
  const missingSlugs = [];
  for (const slug of WATCH_SLUGS) {
    const entry = entries.find((item) => String(item.slug ?? '').trim() === slug);
    if (!entry) {
      missingSlugs.push({
        slug,
        risk: 'missing_from_catalog',
        note: slug === 'brand-campaign-full'
          ? '流程模板 ID，非 Hub capability slug'
          : 'catalog.skills 未找到条目',
      });
      continue;
    }
    findings.push({
      slug,
      majorCategory: entry.major_category ?? null,
      taskGroup: entry.task_group ?? null,
      source: entry.source ?? null,
      risk: 'review_exact_slug_scope_binding',
    });
  }
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    watched: [...WATCH_SLUGS],
    findings,
    missingSlugs,
    pass: findings.length === WATCH_SLUGS.size - 1
      && missingSlugs.every((item) => item.slug === 'brand-campaign-full'),
  };
}

export function main() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  const report = auditCapabilityScopeCatalog(catalog);
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(
    `[capability scope audit] findings=${report.findings.length}/${report.watched.length}`,
  );
  console.log(`[capability scope audit] 报告 ${path.relative(REPO_ROOT, REPORT_PATH)}`);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main();
}
