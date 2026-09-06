#!/usr/bin/env node
/**
 * PD-SAAS-FORK VAP: disk audit for visual deliverables (HTML src exists, manifest KPI).
 * Usage: node --import tsx scripts/audit-visual-deliverable-disk.mjs [--profile=core|g700-canary] [--gate]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  REPO_ROOT,
  auditHtmlSrcOnDisk,
  countOfficialAssets,
  hasCrossTaskRawRef,
  loadJsonIfExists,
  loadTsFixture,
  manifestUsesGenerateImage,
  readArg,
  writeReport,
} from './lib/visualDeliverableVerification.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPORT_DIR = path.join(REPO_ROOT, 'artifacts', 'visual-deliverable-verification');

async function auditCoreCases(workspaceRoot) {
  const cases = await loadTsFixture('tests/fixtures/visual-deliverable-core-cases.ts', 'VISUAL_DELIVERABLE_CORE_CASES');
  const rows = [];
  for (const item of cases) {
    const htmlAbs = path.join(workspaceRoot, item.htmlRelPath);
    const disk = auditHtmlSrcOnDisk(htmlAbs, workspaceRoot);
    const manifestPath = path.join(workspaceRoot, item.taskArtifactDir, 'assets', 'visual-asset-manifest.json');
    const manifest = loadJsonIfExists(manifestPath);
    const pass = item.expectSrcOnDisk ? disk.ok : !disk.ok;
    rows.push({
      id: item.id,
      label: item.label,
      htmlRelPath: item.htmlRelPath,
      srcCount: disk.srcCount,
      missingSrc: disk.missing,
      officialAssets: countOfficialAssets(manifest),
      pass,
    });
  }
  return rows;
}

async function auditG700Canary(workspaceRoot, dataRoot) {
  const cases = await loadTsFixture('tests/fixtures/g700-canary-disk-audit.ts', 'G700_CANARY_DISK_CASES');
  const rows = [];
  for (const item of cases) {
    const taskAbs = path.join(dataRoot ?? workspaceRoot, item.taskArtifactDir);
    const htmlRel = item.htmlRelPath ?? item.galleryRelPath;
    const htmlAbs = htmlRel ? path.join(dataRoot ?? workspaceRoot, htmlRel) : null;
    const manifestPath = path.join(taskAbs, 'assets', 'visual-asset-manifest.json');
    const manifest = loadJsonIfExists(manifestPath);
    const slideManifest = item.slideManifestRelPath
      ? loadJsonIfExists(path.join(dataRoot ?? workspaceRoot, item.slideManifestRelPath))
      : null;
    const taskExists = fs.existsSync(taskAbs);
    const htmlExists = htmlAbs ? fs.existsSync(htmlAbs) : false;
    let htmlAudit = { ok: true, missing: [], srcCount: 0 };
    let htmlContent = '';
    if (htmlExists && htmlAbs) {
      htmlAudit = auditHtmlSrcOnDisk(htmlAbs, dataRoot ?? workspaceRoot);
      htmlContent = fs.readFileSync(htmlAbs, 'utf8');
    }
    const officialCount = countOfficialAssets(manifest);
    const crossTask = item.forbidCrossTaskRawRefs && hasCrossTaskRawRef(htmlContent);
    const generateViolation = item.forbidGenerateImageInManifest && manifestUsesGenerateImage(manifest);
    const skipped = !taskExists && !htmlExists;
    const pass = skipped
      ? true
      : !crossTask
        && !generateViolation
        && officialCount >= item.minOfficialAssets
        && (htmlExists ? htmlAudit.ok : true);
    rows.push({
      id: item.id,
      label: item.label,
      taskArtifactDir: item.taskArtifactDir,
      skipped,
      exists: taskExists,
      htmlExists,
      officialAssets: officialCount,
      htmlSrcMissing: htmlAudit.missing,
      crossTaskRawRef: crossTask,
      generateImageInManifest: generateViolation,
      slideManifestPresent: Boolean(slideManifest),
      pass: skipped ? 'skip' : pass,
    });
  }
  return rows;
}

async function main() {
  const args = process.argv.slice(2);
  const gate = args.includes('--gate');
  const profile = readArg(args, '--profile') ?? 'core';
  const workspaceRoot = readArg(args, '--workspace') ?? REPO_ROOT;
  const dataRoot = readArg(args, '--data-root') ?? process.env.DATA_ROOT ?? null;

  const coreRows = await auditCoreCases(workspaceRoot);
  const canaryRows = profile === 'g700-canary' || profile === 'all'
    ? await auditG700Canary(workspaceRoot, dataRoot)
    : [];

  const corePass = coreRows.every((row) => row.pass);
  const canaryPass = canaryRows.every((row) => row.pass === true || row.pass === 'skip');
  const verdict = corePass && canaryPass ? 'GO' : 'NO_GO';

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    profile,
    workspaceRoot,
    dataRoot,
    kpis: {
      htmlSrcNotOnDisk: coreRows.reduce((sum, row) => sum + row.missingSrc.length, 0),
      coreCasesPass: corePass,
      canaryCasesPass: canaryPass,
    },
    core: coreRows,
    canary: canaryRows,
    verdict,
  };

  const reportPath = writeReport(REPORT_DIR, 'disk-audit-report.json', report);
  console.log(`[visual-deliverable:disk] ${path.relative(REPO_ROOT, reportPath)} verdict=${verdict}`);
  if (gate && verdict !== 'GO') process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(`[visual-deliverable:disk] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}

export { auditCoreCases, auditG700Canary };
