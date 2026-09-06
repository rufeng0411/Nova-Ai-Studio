#!/usr/bin/env node
/**
 * PD-SAAS-FORK (ROG M12 / Phase 5): parse session export HTML / JSONL for batch KPI.
 * Usage:
 *   node scripts/analyze-rog-batch-exports.mjs [html-dir]
 *   node scripts/analyze-rog-batch-exports.mjs path/to/session.jsonl --gate
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const gate = args.includes('--gate');
const jsonlOut = args.includes('--jsonl');
const jsonlArg = args.find((arg) => !arg.startsWith('--'));

function collectHtmlFiles(inputPath) {
  const abs = path.resolve(inputPath);
  if (!fs.existsSync(abs)) return [];
  const stat = fs.statSync(abs);
  if (stat.isFile() && abs.endsWith('.html')) return [abs];
  if (!stat.isDirectory()) return [];
  return fs.readdirSync(abs)
    .filter((name) => name.endsWith('.html') && name.includes('web-s_'))
    .map((name) => path.join(abs, name));
}

function countUserTurns(html) {
  const userBlocks = html.match(/class="[^"]*role-user[^"]*"/gi) ?? [];
  return userBlocks.length;
}

function decodeHtmlEntities(text) {
  return String(text ?? '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'");
}

function extractAcceptanceStatuses(html) {
  const decoded = decodeHtmlEntities(html);
  return [...decoded.matchAll(/acceptanceStatus["']?\s*[:=]\s*["']([^"']+)["']/gi)]
    .map((m) => m[1]);
}

function extractProfileIds(html) {
  const decoded = decodeHtmlEntities(html);
  return [...decoded.matchAll(/profileId["']?\s*[:=]\s*["']([^"']+)["']/gi)]
    .map((m) => m[1]);
}

function extractPhantomHints(html) {
  const hints = [];
  for (const match of html.matchAll(/(?:好，|missingPaths[^[]*\[)([^\]<"\n]+\.md)/gi)) {
    hints.push(match[1]);
  }
  return [...new Set(hints)];
}

function extractVerifiedBrokenOverlap(html) {
  const decoded = decodeHtmlEntities(html);
  const verified = [...decoded.matchAll(/verifiedPaths[^[]*\[([^\]]*)\]/gi)]
    .flatMap((m) => (m[1].match(/["']([^"']+)["']/g) ?? []).map((s) => s.replace(/["']/g, '')));
  const broken = [...decoded.matchAll(/brokenPaths[^[]*\[([^\]]*)\]/gi)]
    .flatMap((m) => (m[1].match(/["']([^"']+)["']/g) ?? []).map((s) => s.replace(/["']/g, '')));
  const verifiedKeys = new Set(verified.map((p) => p.replace(/\\/g, '/').toLowerCase()));
  return broken.filter((p) => verifiedKeys.has(p.replace(/\\/g, '/').toLowerCase())).length;
}

function extractCircuitBreakerTripped(html) {
  return /circuitBreakerTripped["']?\s*[:=]\s*true/i.test(decodeHtmlEntities(html));
}

function extractDfPptMisroute(html) {
  const decoded = decodeHtmlEntities(html);
  const readSkill = decoded.match(/read_skill[^a-zA-Z0-9_-]*df-ppt-generation/i);
  const wantsPptx = /演示稿|\.pptx|可编辑|原生可编辑/i.test(decoded);
  return Boolean(readSkill && wantsPptx);
}

function extractPptxAliasMiss(html) {
  const decoded = decodeHtmlEntities(html);
  const hasRealPptx = /\.pptx/i.test(decoded) && !/presentation\.pptx/i.test(decoded);
  const missingPresentation = /presentation\.pptx/i.test(decoded) && /missingPaths/i.test(decoded);
  return hasRealPptx && missingPresentation;
}

function analyzeHtmlFile(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const userTurns = countUserTurns(html);
  const statuses = extractAcceptanceStatuses(html);
  const lastStatus = statuses[statuses.length - 1] ?? 'unknown';
  const profileIds = extractProfileIds(html);
  const lastProfileId = profileIds[profileIds.length - 1] ?? 'unknown';
  const repairCount = (html.match(/needs_repair/gi) ?? []).length;
  const phantomHints = extractPhantomHints(html);
  const sessionMatch = path.basename(filePath).match(/web-s_([a-f0-9]+)/i);
  const hasSummaryTable = html.includes('交付文件汇总') || html.includes('deliverable-summary-export');
  const falseIncomplete = lastStatus === 'needs_repair' && repairCount > 0 && userTurns <= 1;
  const verifiedBrokenOverlap = extractVerifiedBrokenOverlap(html);
  const circuitBreakerTripped = extractCircuitBreakerTripped(html);
  const dfPptMisroute = extractDfPptMisroute(html);
  const pptxAliasMiss = extractPptxAliasMiss(html);
  return {
    file: path.basename(filePath),
    sessionPrefix: sessionMatch?.[1]?.slice(0, 8) ?? 'unknown',
    userTurns,
    zeroIntervention: userTurns <= 1,
    lastAcceptanceStatus: lastStatus,
    lastProfileId,
    repairCount,
    falseIncomplete,
    profileMismatch: false,
    phantomHintCount: phantomHints.length,
    summaryMountInExport: hasSummaryTable,
    verifiedBrokenOverlap,
    circuitBreakerTripped,
    dfPptMisroute,
    pptxAliasMiss,
    phantomHints: phantomHints.slice(0, 5),
  };
}

function analyzeJsonlFile(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
  let userTurns = 0;
  let repairCount = 0;
  let lastMeta = null;
  for (const line of lines) {
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (row.role === 'user') userTurns += 1;
    if (row.type === 'turn_acceptance_meta' || row.metadata?.acceptanceStatus) {
      lastMeta = row.metadata ?? row;
    }
    if (row.metadata?.continuationOwner === 'deliverable_repair') repairCount += 1;
    if (row.type === 'recovery_attempt' && row.reason === 'acceptance_repair') repairCount += 1;
  }
  const verified = lastMeta?.verifiedPaths ?? [];
  const missing = lastMeta?.missingPaths ?? [];
  const broken = lastMeta?.brokenPaths ?? [];
  const status = lastMeta?.acceptanceStatus ?? 'unknown';
  const verifiedKeys = new Set(verified.map((p) => String(p).replace(/\\/g, '/').toLowerCase()));
  const verifiedBrokenOverlap = broken.filter((p) => verifiedKeys.has(String(p).replace(/\\/g, '/').toLowerCase())).length;
  const falseIncomplete = verified.length > 0 && missing.length === 0 && status === 'needs_repair';
  return {
    file: path.basename(filePath),
    userTurns,
    zeroIntervention: userTurns <= 1,
    lastAcceptanceStatus: status,
    verifiedCount: verified.length,
    missingCount: missing.length,
    falseIncomplete,
    repairCount,
    verifiedBrokenOverlap,
    circuitBreakerTripped: Boolean(lastMeta?.circuitBreakerTripped),
    dfPptMisroute: false,
    pptxAliasMiss: false,
  };
}

function main() {
  const target = jsonlArg ?? path.join(process.env.USERPROFILE || '', 'Downloads');
  const abs = path.resolve(target);

  let rows = [];
  let mode = 'html';
  if (abs.endsWith('.jsonl') && fs.existsSync(abs)) {
    mode = 'jsonl';
    rows = [analyzeJsonlFile(abs)];
  } else {
    const files = collectHtmlFiles(target);
    if (files.length === 0) {
      console.error(`No ROG session export found under ${target}`);
      process.exit(gate ? 1 : 0);
    }
    rows = files.map(analyzeHtmlFile);
  }

  const falseIncompleteRate = mode === 'jsonl'
    ? rows.filter((r) => r.falseIncomplete).length / Math.max(rows.length, 1)
    : rows.filter((r) => r.falseIncomplete || (r.lastAcceptanceStatus === 'needs_repair' && r.userTurns <= 1)).length / Math.max(rows.length, 1);

  const summary = {
    generatedAt: new Date().toISOString(),
    source: target,
    mode,
    totalSessions: rows.length,
    zeroInterventionRate: rows.filter((r) => r.zeroIntervention).length / Math.max(rows.length, 1),
    false_incomplete_rate: falseIncompleteRate,
    medianUserTurns: rows.map((r) => r.userTurns).sort((a, b) => a - b)[Math.floor(rows.length / 2)] ?? 0,
    phantomSessions: rows.filter((r) => (r.phantomHintCount ?? 0) > 0).length,
    rows,
  };

  const outPath = path.join(root, 'docs', `rog-phase5-kpi-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nWrote ${outPath}`);

  if (jsonlOut) {
    const batchDir = abs.endsWith('.jsonl') ? path.dirname(abs) : abs;
    const pathHas0707 = abs.replace(/\\/g, '/').includes('0707');
    const jsonlName = pathHas0707 ? 'kpi-baseline-0707.jsonl' : 'kpi-baseline-0706.jsonl';
    const jsonlDir = pathHas0707 && path.basename(batchDir) === 'exports'
      ? path.dirname(batchDir)
      : batchDir;
    const jsonlPath = path.join(jsonlDir, jsonlName);
    fs.mkdirSync(path.dirname(jsonlPath), { recursive: true });
    fs.writeFileSync(jsonlPath, '', 'utf8');
    for (const row of rows) {
      fs.appendFileSync(jsonlPath, `${JSON.stringify(row)}\n`);
    }
    console.log(`\nWrote ${jsonlPath}`);
  }

  if (gate) {
    let failed = false;
    if (summary.false_incomplete_rate > 0 && mode === 'jsonl') {
      console.error(`[gate] false_incomplete_rate=${summary.false_incomplete_rate} (must be 0 for jsonl gate)`);
      failed = true;
    }
    const overlapSessions = rows.filter((r) => (r.verifiedBrokenOverlap ?? 0) > 0);
    if (overlapSessions.length > 0 && mode === 'html') {
      console.warn(`[gate-warn] verifiedBrokenOverlap sessions=${overlapSessions.length} (baseline archive; post-fix target 0)`);
    }
    if (summary.zeroInterventionRate < 0.7 && mode === 'html' && rows.length >= 5 && !jsonlOut) {
      console.error(`[gate] zeroInterventionRate=${summary.zeroInterventionRate} (target ≥0.7 for post-fix)`);
      failed = true;
    }
    if (failed) process.exit(1);
  }
}

main();
