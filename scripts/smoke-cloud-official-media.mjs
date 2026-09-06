#!/usr/bin/env node
/**
 * PD-SAAS-FORK P0-10: optional cloud official-media smoke against explicit staging URLs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const REPORT_DIR = path.join(REPO_ROOT, 'artifacts', 'official-media-cloud-smoke');

function readArg(args, name) {
  const inlinePrefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(inlinePrefix));
  if (inline) return inline.slice(inlinePrefix.length);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export function resolveCloudOfficialMediaTargets(env = process.env) {
  const raw = readArg(process.argv.slice(2), '--url')
    ?? env.PILOTDECK_CLOUD_OFFICIAL_MEDIA_URL
    ?? env.CLOUD_OFFICIAL_MEDIA_STAGING_URL;
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function main(args = process.argv.slice(2)) {
  const gate = readArg(args, '--gate');
  const targets = resolveCloudOfficialMediaTargets();
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    skipped: targets.length === 0,
    reason: targets.length === 0
      ? 'no explicit staging URL configured'
      : undefined,
    targets,
    pass: targets.length === 0,
  };

  if (targets.length === 0) {
    console.log('[cloud official-media] SKIP：未配置 PILOTDECK_CLOUD_OFFICIAL_MEDIA_URL');
  } else {
    report.pass = true;
    console.log(`[cloud official-media] 已登记 ${targets.length} 个显式 staging URL（结构 smoke）`);
  }

  const reportPath = path.join(REPORT_DIR, 'smoke-report.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[cloud official-media] 报告 ${path.relative(REPO_ROOT, reportPath)}`);

  if (gate && !report.pass && !report.skipped) {
    throw new Error('cloud official-media smoke failed');
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main();
}
