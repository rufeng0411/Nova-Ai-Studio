#!/usr/bin/env node
/**
 * PD-SAAS-FORK VAP: preview HTTP audit — sibling img assets must not 401 when parent HTML has token.
 * Usage: node --import tsx scripts/audit-visual-deliverable-preview-http.mjs [--gate] [--server-url=...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchSaasAuthToken, resolveGeneralWorkspaceCwd } from './lib/resolveGeneralWorkspaceCwd.mjs';
import {
  REPO_ROOT,
  auditHtmlSrcOnDisk,
  extractImgSrcs,
  readArg,
  resolveSiblingPath,
  writeReport,
} from './lib/visualDeliverableVerification.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPORT_DIR = path.join(REPO_ROOT, 'artifacts', 'visual-deliverable-verification');
const CORE_FIXTURE_SRC = path.join(REPO_ROOT, 'tests', 'fixtures', 'visual-deliverable-core', 'core-bound');

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(from, to);
    else fs.copyFileSync(from, to);
  }
}

function stageCoreFixture(workspaceRoot) {
  const relDir = 'artifacts/_visual-deliverable-audit-core';
  const dest = path.join(workspaceRoot, relDir);
  copyDirRecursive(CORE_FIXTURE_SRC, dest);
  return {
    htmlRelPath: `${relDir}/index.html`.replace(/\\/g, '/'),
    workspaceRoot,
  };
}

async function probePreviewAsset(serverUrl, token, projectName, htmlRelPath, workspaceRoot) {
  const htmlAbs = path.join(workspaceRoot, htmlRelPath);
  if (!fs.existsSync(htmlAbs)) {
    return { skipped: true, reason: 'html_missing', broken: 0, probes: [] };
  }
  const html = fs.readFileSync(htmlAbs, 'utf8');
  const refs = extractImgSrcs(html);
  const htmlPreviewPath = htmlRelPath.replace(/\\/g, '/');
  const htmlUrl = `${serverUrl.replace(/\/$/, '')}/api/projects/${encodeURIComponent(projectName)}/preview/${htmlPreviewPath}?token=${encodeURIComponent(token)}`;
  const htmlRes = await fetch(htmlUrl, { signal: AbortSignal.timeout(15_000) });
  const probes = [{ kind: 'html', url: htmlUrl, status: htmlRes.status }];
  let broken = htmlRes.status >= 400 ? 1 : 0;

  for (const ref of refs.slice(0, 8)) {
    const assetRel = path.relative(workspaceRoot, resolveSiblingPath(htmlAbs, ref)).replace(/\\/g, '/');
    const assetUrl = `${serverUrl.replace(/\/$/, '')}/api/projects/${encodeURIComponent(projectName)}/preview/${assetRel}`;
    const noTokenRes = await fetch(assetUrl, {
      headers: { Referer: htmlUrl },
      signal: AbortSignal.timeout(15_000),
    });
    probes.push({ kind: 'asset_no_query', ref, status: noTokenRes.status });
    if (noTokenRes.status === 401 || noTokenRes.status === 403) {
      broken += 1;
    }
  }

  const disk = auditHtmlSrcOnDisk(htmlAbs, workspaceRoot);
  return { skipped: false, broken, probes, diskOk: disk.ok, srcCount: refs.length };
}

async function main() {
  const args = process.argv.slice(2);
  const gate = args.includes('--gate');
  const serverUrl = readArg(args, '--server-url')
    ?? process.env.SERVER_URL
    ?? process.env.PLAYWRIGHT_SERVER_URL
    ?? 'http://127.0.0.1:7990';
  const workspaceRoot = readArg(args, '--workspace') ?? REPO_ROOT;

  const token = await fetchSaasAuthToken(serverUrl);
  if (!token) {
    const report = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      serverUrl,
      skipped: true,
      reason: 'no_auth_token',
      previewBrokenImages: null,
      verdict: 'SKIP',
    };
    writeReport(REPORT_DIR, 'preview-http-report.json', report);
    console.log('[visual-deliverable:preview-http] SKIP — dev:saas not reachable or login failed');
    return;
  }

  const workspaceCwd = await resolveGeneralWorkspaceCwd({ serverUrl, token });
  if (!workspaceCwd) {
    const report = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      serverUrl,
      skipped: true,
      reason: 'no_workspace_cwd',
      previewBrokenImages: null,
      verdict: 'SKIP',
    };
    writeReport(REPORT_DIR, 'preview-http-report.json', report);
    console.log('[visual-deliverable:preview-http] SKIP — workspaceCwd unavailable');
    return;
  }

  const staged = stageCoreFixture(workspaceCwd);
  const rows = [];
  let previewBrokenImages = 0;

  const result = await probePreviewAsset(
    serverUrl,
    token,
    'general',
    staged.htmlRelPath,
    staged.workspaceRoot,
  );
  previewBrokenImages += result.broken ?? 0;
  rows.push({ id: 'core-bound-html-staged', ...result });

  const verdict = previewBrokenImages === 0 ? 'GO' : 'NO_GO';
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    serverUrl,
    workspaceCwd,
    stagedHtml: staged.htmlRelPath,
    previewBrokenImages,
    cases: rows,
    verdict,
  };
  writeReport(REPORT_DIR, 'preview-http-report.json', report);
  console.log(`[visual-deliverable:preview-http] previewBrokenImages=${previewBrokenImages} verdict=${verdict}`);
  if (gate && verdict !== 'GO') process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(`[visual-deliverable:preview-http] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
