#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Compare perf baseline JSON files; fail if any metric degrades >10%.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readArg(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}

function loadJsonOrDir(spec) {
  if (!spec) return null;
  const resolved = path.resolve(spec);
  if (!fs.existsSync(resolved)) return null;
  if (fs.statSync(resolved).isDirectory()) {
    const files = fs.readdirSync(resolved).filter((f) => f.endsWith('.json'));
    if (files.length === 0) return null;
    files.sort();
    return JSON.parse(fs.readFileSync(path.join(resolved, files[files.length - 1]), 'utf8'));
  }
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function pickMetrics(doc) {
  if (!doc || typeof doc !== 'object') return {};
  const gate = doc.gate ?? doc;
  return {
    readyP95: gate.readyP95Ms ?? doc.readyP95 ?? doc.readyP95Ms,
    tailReadP95: doc.tailReadP95 ?? doc.p95Ms,
    rssGrowthPct: doc.rssGrowthPct ?? doc.rssGrowth,
    loginSidebarMs: doc.loginSidebarMs ?? doc.loginMs,
  };
}

export function compareBaselines(baseline, current, maxDegradeRatio = 0.1) {
  const b = pickMetrics(baseline);
  const c = pickMetrics(current);
  const rows = [];
  let fail = false;
  for (const key of Object.keys(b)) {
    const bv = Number(b[key]);
    const cv = Number(c[key]);
    if (!Number.isFinite(bv) || !Number.isFinite(cv)) continue;
    const ratio = bv === 0 ? (cv > 0 ? Infinity : 0) : (cv - bv) / bv;
    const degraded = ratio > maxDegradeRatio;
    if (degraded) fail = true;
    rows.push({ key, baseline: bv, current: cv, deltaPct: Math.round(ratio * 1000) / 10, degraded });
  }
  return { pass: !fail, rows };
}

function main() {
  const args = process.argv.slice(2);
  const baseline = loadJsonOrDir(readArg(args, '--baseline'));
  const current = loadJsonOrDir(readArg(args, '--current'));
  if (!baseline || !current) {
    console.error('[baselineDiff] missing --baseline or --current');
    process.exit(1);
  }
  const result = compareBaselines(baseline, current);
  console.log(JSON.stringify(result, null, 2));
  if (!result.pass) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
