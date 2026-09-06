#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Process template live runs (6 representatives).
 * Usage:
 *   node scripts/integration-process-template-live.mjs
 *   node scripts/integration-process-template-live.mjs --complexity light
 *   node scripts/integration-process-template-live.mjs --ids press-release-pack,geo-visibility-quick
 *   TEMPLATE_LIVE_DRY=1 node scripts/integration-process-template-live.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  connectGateway,
  newSession,
  submitTurn,
  closeGateway,
  readGatewayToken,
} from './lib/gatewaySessionHarness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const TEMPLATES_PATH = path.join(REPO_ROOT, 'config', 'process-templates.json');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'full-test');
const OUT_FILE = path.join(OUT_DIR, 'template-live.json');

const DEFAULT_IDS = [
  'press-release-pack',
  'geo-visibility-quick',
  'content-flywheel',
  'social-matrix-pipeline',
  'product-launch-full',
  'outline-ppt-video',
];

const TIMEOUT_BY_COMPLEXITY = {
  light: Number(process.env.TEMPLATE_LIGHT_TIMEOUT_MS || 600_000),
  standard: Number(process.env.TEMPLATE_STD_TIMEOUT_MS || 900_000),
  full: Number(process.env.TEMPLATE_FULL_TIMEOUT_MS || 1_200_000),
};

const DRY = process.env.TEMPLATE_LIVE_DRY === '1' || process.argv.includes('--dry');

function parseArgs() {
  const idsIdx = process.argv.indexOf('--ids');
  if (idsIdx >= 0 && process.argv[idsIdx + 1]) {
    return process.argv[idsIdx + 1].split(',').map((s) => s.trim()).filter(Boolean);
  }
  const cxIdx = process.argv.indexOf('--complexity');
  if (cxIdx >= 0 && process.argv[cxIdx + 1]) {
    const cx = process.argv[cxIdx + 1];
    const data = JSON.parse(fs.readFileSync(TEMPLATES_PATH, 'utf8'));
    return data.templates.filter((t) => t.complexity === cx).slice(0, 2).map((t) => t.id);
  }
  return DEFAULT_IDS;
}

function loadTemplates(ids) {
  const data = JSON.parse(fs.readFileSync(TEMPLATES_PATH, 'utf8'));
  const map = new Map(data.templates.map((t) => [t.id, t]));
  return ids.map((id) => {
    const t = map.get(id);
    if (!t) throw new Error(`Unknown template id: ${id}`);
    return t;
  });
}

async function runTemplate(ws, sessionKey, template) {
  const prompt = template.prompt?.['zh-CN'] || template.prompt?.zh || '';
  const timeoutMs = TIMEOUT_BY_COMPLEXITY[template.complexity] || 900_000;
  if (DRY) {
    return {
      id: template.id,
      complexity: template.complexity,
      status: 'DRY',
      ok: true,
      skipReason: 'TEMPLATE_LIVE_DRY',
      timeoutMs,
    };
  }
  try {
    readGatewayToken();
  } catch (e) {
    return {
      id: template.id,
      complexity: template.complexity,
      status: 'SKIP',
      ok: false,
      skipReason: 'NO_GATEWAY_TOKEN',
      detail: String(e.message || e),
    };
  }

  const result = await submitTurn(ws, {
    sessionKey,
    projectKey: 'general',
    message: prompt,
    tag: `tpl-${template.id}`,
    timeoutMs,
    maxTurns: 12,
  });

  const detail = result.error || (result.timeout ? 'timeout' : '');
  const skipKey = /api.?key|401|403|credential|imagen|ffmpeg/i.test(detail);
  let status = 'FAIL';
  if (result.ok && !result.recoveryExhausted) status = 'PASS';
  else if (result.timeout) status = 'TIMEOUT';
  else if (skipKey) status = 'SKIP-KEY';

  return {
    id: template.id,
    complexity: template.complexity,
    title: template.title?.['zh-CN'],
    relatedSkills: template.relatedSkills,
    status,
    ok: result.ok && !result.recoveryExhausted,
    timeout: result.timeout,
    durationMs: result.durationMs,
    recoveryAttempts: result.recoveryAttempts,
    recoveryExhausted: result.recoveryExhausted,
    toolCalls: result.toolCalls,
    skipReason: skipKey ? 'SKIP-KEY' : undefined,
    detail,
  };
}

async function main() {
  const ids = parseArgs();
  const templates = loadTemplates(ids);
  console.log(`[template-live] ${templates.length} templates dry=${DRY}`);

  const results = [];
  let ws = null;
  let sessionKey = null;

  if (!DRY) {
    try {
      ws = await connectGateway();
      sessionKey = await newSession(ws, 'general');
    } catch (e) {
      for (const t of templates) {
        results.push({
          id: t.id,
          complexity: t.complexity,
          status: 'SKIP',
          ok: false,
          skipReason: 'GATEWAY_DOWN',
          detail: String(e.message || e),
        });
      }
      writeOutput(results, templates.length);
      process.exit(0);
    }
  }

  for (const template of templates) {
    console.log(`\n[template-live] → ${template.id} (${template.complexity})`);
    const row = await runTemplate(ws, sessionKey, template);
    results.push(row);
    console.log(`[template-live] ${row.status} ${template.id}`);
  }

  if (ws) closeGateway(ws);
  const summary = writeOutput(results, templates.length);
  const passCount = results.filter((r) => r.status === 'PASS' || (r.ok && r.status === 'DRY')).length;
  console.log(`\n[template-live] ${passCount}/${templates.length} pass → ${OUT_FILE}`);
  if (passCount < 5 && !DRY && results.every((r) => r.skipReason !== 'GATEWAY_DOWN')) process.exit(1);
}

function writeOutput(results, total) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const pass = results.filter((r) => r.status === 'PASS' || (r.ok && r.status === 'DRY')).length;
  const summary = {
    capturedAt: new Date().toISOString(),
    total,
    pass,
    fail: results.filter((r) => r.status === 'FAIL' || r.status === 'TIMEOUT').length,
    skip: results.filter((r) => r.skipReason || r.status === 'SKIP-KEY').length,
    results,
  };
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  return summary;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
