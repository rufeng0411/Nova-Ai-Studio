#!/usr/bin/env node
/**
 * 营销 SaaS 深度验收（geo_only：营销 Tab 无 AI搜索 Pill，GEO 迁至独立 Tab）。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  FLYWHEEL_STAGE_IDS,
  applyTaxonomyToSkill,
  capabilityMatchesFlywheelTaskGroup,
} from './lib/capabilityHubTaxonomy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = path.join(ROOT, 'config', 'capabilities.catalog.json');
const INSTALL_JSON = path.join(ROOT, 'artifacts', 'marketing-saas-smoke', 'install-readiness.json');
const OUT = path.join(ROOT, 'artifacts', 'marketing-saas-smoke', 'deep-report.json');

function runNpm(script) {
  const r = spawnSync('npm', ['run', script], { cwd: ROOT, encoding: 'utf8', shell: true });
  return { ok: r.status === 0, stdout: r.stdout, stderr: r.stderr };
}

function main() {
  if (!existsSync(CATALOG_PATH)) throw new Error('Run capabilities:gen first');
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  const skills = (catalog.skills || []).map((s) => applyTaxonomyToSkill({ ...s }));
  const visible = skills.filter((s) => !s.hidden_in_hub);

  const aiSearchLeaks = [];
  for (const stage of FLYWHEEL_STAGE_IDS) {
    const count = visible.filter((s) => capabilityMatchesFlywheelTaskGroup(s, stage, 'ai_search')).length;
    if (count > 0) aiSearchLeaks.push(`${stage}/ai_search=${count}`);
  }

  const pdGeo = skills.find((s) => s.slug === 'pd-geo');
  const pdGeoOk =
    pdGeo &&
    pdGeo.major_category === 'geo' &&
    pdGeo.geo_stage === 'geo_strategy' &&
    !(pdGeo.secondary_task_groups || []).includes('ai_search');

  const geoSlugs = skills.filter((s) => s.slug.startsWith('geo-')).map((s) => s.slug);
  const geoTabCount = visible.filter((s) => s.major_category === 'geo').length;
  const installOk = existsSync(INSTALL_JSON)
    ? JSON.parse(readFileSync(INSTALL_JSON, 'utf8')).ok
    : false;

  const aigeo = runNpm('smoke:aigeo');
  const hub = runNpm('smoke:capability-hub');
  const geoHub = runNpm('smoke:geo-hub');

  const ok =
    aiSearchLeaks.length === 0 &&
    pdGeoOk &&
    geoSlugs.length >= 9 &&
    geoTabCount >= 20 &&
    aigeo.ok &&
    hub.ok &&
    geoHub.ok &&
    installOk;

  const report = {
    generatedAt: new Date().toISOString(),
    ok,
    aiSearchLeaks,
    pdGeoOk,
    geoSlugCount: geoSlugs.length,
    geoTabCount,
    geoSlugs,
    installOk,
    smoke: { aigeo: aigeo.ok, capabilityHub: hub.ok, geoHub: geoHub.ok },
  };

  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[marketing-saas-deep] ok=${ok}`);
  console.log(`[marketing-saas-deep] aiSearchLeaks=${aiSearchLeaks.length} geo=${geoSlugs.length} geoTab=${geoTabCount}`);
  console.log(`[marketing-saas-deep] report=${OUT}`);
  if (!ok) process.exitCode = 1;
}

main();
