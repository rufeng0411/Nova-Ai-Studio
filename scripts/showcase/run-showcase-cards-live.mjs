#!/usr/bin/env node
/**
 * Wave-B showcase card live batch orchestrator.
 * Default: --dry-run (list queue only).
 * Live: --confirm-wave-b --no-dry-run [--section=design] [--exclude-section=video]
 * PD-SAAS-FORK
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  closeGateway,
  connectGateway,
  newSession,
  submitTurn,
} from '../lib/gatewaySessionHarness.mjs';
import {
  fetchSaasAuthToken,
  resolveGeneralWorkspaceCwd,
} from '../lib/resolveGeneralWorkspaceCwd.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_JSON = path.join(root, 'docs/showcase-card-recommendation-20260803.json');
const BRIDGE_URL = process.env.SERVER_URL || process.env.PLAYWRIGHT_SERVER_URL || 'http://127.0.0.1:7990';

const SECTION_MAJOR = {
  design: 'creation',
  video: 'creation',
  copy: 'marketing',
  marketing: 'marketing',
  office: 'office',
  research: 'marketing',
  geo: 'geo',
  fullcase: 'marketing',
  compliance: 'office',
};

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const args = {
    priority: 'all',
    dryRun: true,
    confirmWaveB: false,
    card: '',
    section: '',
    excludeSections: [],
    excludeDeps: ['video_api', 'hf_key'],
    resume: false,
    jsonPath: DEFAULT_JSON,
    outDir: path.join(root, 'artifacts/Showcase-Batch-20260803'),
    timeoutMs: Number(process.env.SHOWCASE_CARD_TIMEOUT_MS || 1_200_000),
    maxTurns: Number(process.env.SHOWCASE_CARD_MAX_TURNS || 18),
  };
  for (const a of argv) {
    if (a === '--dry-run') args.dryRun = true;
    if (a === '--no-dry-run') args.dryRun = false;
    if (a === '--confirm-wave-b') args.confirmWaveB = true;
    if (a === '--resume') args.resume = true;
    if (a.startsWith('--priority=')) args.priority = a.slice('--priority='.length);
    if (a.startsWith('--card=')) args.card = a.slice('--card='.length);
    if (a.startsWith('--section=')) args.section = a.slice('--section='.length);
    if (a.startsWith('--exclude-section=')) {
      args.excludeSections = a
        .slice('--exclude-section='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (a.startsWith('--exclude-deps=')) {
      args.excludeDeps = a
        .slice('--exclude-deps='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (a.startsWith('--json=')) args.jsonPath = a.slice('--json='.length);
    if (a.startsWith('--out=')) args.outDir = a.slice('--out='.length);
    if (a.startsWith('--timeout-ms=')) args.timeoutMs = Number(a.slice('--timeout-ms='.length));
  }
  return args;
}

/**
 * @param {'P0'|'P0+P1'|'all'|string} priority
 * @param {Array<Record<string, unknown>>} cards
 */
function filterByPriority(priority, cards) {
  if (priority === 'all') return cards;
  if (priority === 'P0') return cards.filter((c) => c.priority === 'P0');
  if (priority === 'P0+P1') {
    return cards.filter((c) => c.priority === 'P0' || c.priority === 'P1');
  }
  return cards.filter((c) => c.priority === priority);
}

/**
 * @param {Array<Record<string, unknown>>} cards
 */
function sortForSection(cards) {
  return [...cards].sort((a, b) => {
    const sa = Number(a.sort_order) || 0;
    const sb = Number(b.sort_order) || 0;
    if (sa !== sb) return sa - sb;
    return String(a.id).localeCompare(String(b.id));
  });
}

/**
 * @param {string} progressPath
 * @returns {Set<string>}
 */
function loadPassedIds(progressPath) {
  const passed = new Set();
  if (!fs.existsSync(progressPath)) return passed;
  const lines = fs.readFileSync(progressPath, 'utf8').split('\n').filter(Boolean);
  for (const line of lines) {
    try {
      const row = JSON.parse(line);
      if ((row.status === 'passed' || row.status === 'passed_soft') && row.id) {
        passed.add(String(row.id));
      }
    } catch {
      // skip
    }
  }
  return passed;
}

/**
 * @param {string} progressPath
 * @param {Record<string, unknown>} row
 */
function appendProgress(progressPath, row) {
  fs.appendFileSync(progressPath, `${JSON.stringify(row)}\n`, 'utf8');
}

/**
 * @param {string[]} paths
 */
function basenames(paths) {
  const out = new Set();
  for (const p of paths ?? []) {
    const n = String(p).replace(/\\/g, '/').split('/').pop();
    if (n) out.add(n.toLowerCase());
  }
  return out;
}

/**
 * @param {string[]} writePaths
 */
function inferTaskDir(writePaths) {
  for (const p of writePaths ?? []) {
    const norm = String(p).replace(/\\/g, '/');
    const m = norm.match(/(artifacts\/task-[^/]+)/i);
    if (m) {
      // Prefer absolute if present
      const idx = norm.toLowerCase().indexOf('artifacts/task-');
      if (idx >= 0 && path.isAbsolute(norm.slice(0, idx + 1) === false ? norm : norm)) {
        const absMatch = norm.match(/^(.+?\/artifacts\/task-[^/]+)/i);
        if (absMatch) return absMatch[1].replace(/\//g, path.sep);
      }
      return m[1];
    }
  }
  return null;
}

/**
 * Resolve absolute task dir under workspace cwd.
 * @param {string|null} taskDir
 * @param {string|null} workspaceCwd
 * @param {string[]} writePaths
 */
function resolveAbsTaskDir(taskDir, workspaceCwd, writePaths) {
  for (const p of writePaths ?? []) {
    if (path.isAbsolute(p) && /task-\d{8}-/i.test(p)) {
      const norm = p.replace(/\\/g, '/');
      const m = norm.match(/^(.+\/artifacts\/task-[^/]+)/i);
      if (m && fs.existsSync(m[1])) return m[1].replace(/\//g, path.sep);
    }
  }
  if (!taskDir) return null;
  if (path.isAbsolute(taskDir) && fs.existsSync(taskDir)) return taskDir;
  if (workspaceCwd) {
    const abs = path.join(workspaceCwd, taskDir);
    if (fs.existsSync(abs)) return abs;
  }
  const generalAbs = path.join(root, 'general', taskDir);
  if (fs.existsSync(generalAbs)) return generalAbs;
  return taskDir;
}

/**
 * @param {Record<string, unknown>} card
 * @param {Set<string>} written
 * @param {string|null} absTaskDir
 */
function checkMustDeliver(card, written, absTaskDir) {
  const must = Array.isArray(card.must_deliver) ? card.must_deliver.map(String) : [];
  const missing = [];
  for (const item of must) {
    const base = item.replace(/\\/g, '/').split('/').pop()?.toLowerCase() || item.toLowerCase();
    let ok = written.has(base);
    if (!ok && absTaskDir && fs.existsSync(absTaskDir)) {
      try {
        const files = fs.readdirSync(absTaskDir, { recursive: true });
        ok = files.some((f) => String(f).replace(/\\/g, '/').toLowerCase().endsWith(base)
          || String(f).replace(/\\/g, '/').toLowerCase().includes(base));
      } catch {
        // ignore
      }
    }
    // Soft: primary html/md/pptx basename family
    if (!ok && absTaskDir && fs.existsSync(absTaskDir)) {
      const ext = path.extname(base);
      if (ext) {
        try {
          const files = fs.readdirSync(absTaskDir, { recursive: true });
          ok = files.some((f) => String(f).toLowerCase().endsWith(ext));
        } catch {
          // ignore
        }
      }
    }
    if (!ok) missing.push(item);
  }
  return { missing, hit: must.length - missing.length, mustCount: must.length };
}

/**
 * @param {Record<string, unknown>} card
 */
function buildCapabilityContext(card) {
  const slug = String(card.hub_binding || '');
  if (!slug || slug.startsWith('tool-')) return undefined;
  return {
    slug,
    displayName: String(card.name_zh || slug),
    majorCategory: SECTION_MAJOR[String(card.section_id)] || 'marketing',
  };
}

/**
 * @param {Record<string, unknown>} card
 * @param {string[]} excludeDeps
 */
function shouldSkipForDeps(card, excludeDeps) {
  const deps = Array.isArray(card.deps) ? card.deps.map(String) : [];
  const hit = deps.filter((d) => excludeDeps.includes(d));
  return hit.length ? hit : null;
}

async function runOneCard(ws, card, opts) {
  const { workspaceCwd, timeoutMs, maxTurns, outDir, progressPath } = opts;
  const id = String(card.id);
  const startedAt = new Date().toISOString();
  appendProgress(progressPath, {
    id,
    status: 'running',
    section_id: card.section_id,
    at: startedAt,
  });

  const sessionKey = await newSession(ws, 'general');
  const capabilityContext = buildCapabilityContext(card);
  console.log(
    `[showcase-live] START ${id} session=${sessionKey} bind=${card.hub_binding} timeout=${timeoutMs}ms`,
  );

  const result = await submitTurn(ws, {
    sessionKey,
    message: String(card.prompt_zh || ''),
    projectKey: 'general',
    workspaceCwd: workspaceCwd || 'general',
    timeoutMs,
    maxTurns,
    tag: `sc-${String(card.section_id).slice(0, 6)}`,
    capabilityContext,
  });

  const writePaths = result.toolWritePaths || [];
  const written = basenames(writePaths);
  const taskDirRel = inferTaskDir(writePaths);
  const absTaskDir = resolveAbsTaskDir(taskDirRel, workspaceCwd, writePaths);
  const deliver = checkMustDeliver(card, written, absTaskDir);

  let status = 'failed';
  let reason = '';
  if (result.timeout) {
    status = deliver.hit > 0 ? 'passed_soft' : 'failed';
    reason = result.timeout ? 'timeout' : '';
  } else if (deliver.missing.length === 0) {
    status = result.acceptanceStatus === 'passed' ? 'passed' : 'passed_soft';
    reason = result.acceptanceStatus === 'passed' ? '' : `acceptance=${result.acceptanceStatus || 'unset'}`;
  } else if (deliver.hit > 0) {
    status = 'passed_soft';
    reason = `partial_missing=${deliver.missing.join(',')}`;
  } else {
    status = 'failed';
    reason = `missing=${deliver.missing.join(',') || 'no_writes'};acceptance=${result.acceptanceStatus || 'unset'}`;
  }

  const cardOut = path.join(outDir, 'cards', id);
  fs.mkdirSync(cardOut, { recursive: true });
  const report = {
    id,
    name_zh: card.name_zh,
    section_id: card.section_id,
    status,
    reason,
    sessionKey,
    hub_binding: card.hub_binding,
    must_deliver: card.must_deliver,
    missing: deliver.missing,
    taskDir: absTaskDir,
    taskDirRel,
    writePaths,
    acceptanceStatus: result.acceptanceStatus,
    durationMs: result.durationMs,
    timeout: Boolean(result.timeout),
    toolCalls: result.toolCalls || {},
    assistantPreview: String(result.assistantText || '').slice(0, 600),
    startedAt,
    finishedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(cardOut, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  appendProgress(progressPath, {
    id,
    status,
    section_id: card.section_id,
    sessionId: sessionKey,
    taskDir: absTaskDir,
    reason,
    durationMs: result.durationMs,
    at: report.finishedAt,
  });

  console.log(
    `[showcase-live] DONE ${id} status=${status} dur=${Math.round((result.durationMs || 0) / 1000)}s taskDir=${absTaskDir || '-'}`,
  );
  return report;
}

function writeSectionSummary(outDir, sectionId, reports) {
  const summaryPath = path.join(outDir, `section-${sectionId}-summary.json`);
  const lines = reports.map((r) => ({
    id: r.id,
    name_zh: r.name_zh,
    status: r.status,
    taskDir: r.taskDir,
    sessionKey: r.sessionKey,
    primary: Array.isArray(r.must_deliver) ? r.must_deliver[0] : null,
    reason: r.reason,
  }));
  const body = {
    section_id: sectionId,
    generatedAt: new Date().toISOString(),
    counts: {
      total: reports.length,
      passed: reports.filter((r) => r.status === 'passed').length,
      passed_soft: reports.filter((r) => r.status === 'passed_soft').length,
      failed: reports.filter((r) => r.status === 'failed').length,
      skipped: reports.filter((r) => r.status === 'skipped').length,
    },
    cards: lines,
  };
  fs.writeFileSync(summaryPath, `${JSON.stringify(body, null, 2)}\n`, 'utf8');

  const mdPath = path.join(outDir, `section-${sectionId}-验收地址.md`);
  const md = [
    `# Showcase · ${sectionId} 栏验收地址`,
    '',
    `生成时间：${body.generatedAt}`,
    '',
    `| 卡片 | 状态 | 任务目录 | 会话 |`,
    `|---|---|---|---|`,
    ...lines.map(
      (c) =>
        `| ${c.name_zh} (\`${c.id}\`) | ${c.status} | \`${c.taskDir || '-'}\` | \`${c.sessionKey || '-'}\` |`,
    ),
    '',
    '请打开任务目录验收主成果；确认本栏通过后回复「design 通过，继续下一栏」或指出要重做的 `sc-*` id。',
    '',
  ].join('\n');
  fs.writeFileSync(mdPath, md, 'utf8');
  return { summaryPath, mdPath, body };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.jsonPath)) {
    console.error(`missing ${args.jsonPath}`);
    process.exit(1);
  }
  const doc = JSON.parse(fs.readFileSync(args.jsonPath, 'utf8'));
  let cards = Array.isArray(doc.cards) ? doc.cards : [];

  if (args.card) {
    cards = cards.filter((c) => c.id === args.card);
    if (cards.length === 0) {
      console.error(`card_not_found:${args.card}`);
      process.exit(1);
    }
  } else {
    cards = filterByPriority(args.priority, cards);
    if (args.section) {
      cards = cards.filter((c) => c.section_id === args.section);
    }
    if (args.excludeSections.length) {
      cards = cards.filter((c) => !args.excludeSections.includes(String(c.section_id)));
    }
  }
  cards = sortForSection(cards);

  fs.mkdirSync(args.outDir, { recursive: true });
  const progressPath = path.join(args.outDir, 'progress.jsonl');
  const passed = args.resume ? loadPassedIds(progressPath) : new Set();
  const queue = cards.filter((c) => !passed.has(String(c.id)));

  console.log(
    JSON.stringify(
      {
        mode: args.dryRun || !args.confirmWaveB ? 'dry-run' : 'live',
        priority: args.priority,
        section: args.section || '(all-filtered)',
        excludeSections: args.excludeSections,
        excludeDeps: args.excludeDeps,
        totalInScope: cards.length,
        alreadyPassed: passed.size,
        queued: queue.length,
        outDir: args.outDir,
        bridge: BRIDGE_URL,
      },
      null,
      2,
    ),
  );

  for (const card of queue) {
    console.log(
      [
        card.priority,
        card.section_id,
        card.id,
        card.hub_binding,
        Array.isArray(card.deps) && card.deps.length ? `deps=${card.deps.join('+')}` : 'deps=none',
      ].join('\t'),
    );
  }

  if (!args.confirmWaveB || args.dryRun) {
    console.log(
      '\n[showcase-live] Wave-B Gateway batch not started. Re-run with --confirm-wave-b --no-dry-run after human confirmation.',
    );
    process.exit(0);
  }

  const token = await fetchSaasAuthToken(BRIDGE_URL);
  if (!token) {
    console.error(`[showcase-live] login failed at ${BRIDGE_URL}`);
    process.exit(1);
  }
  const workspaceCwd = await resolveGeneralWorkspaceCwd({ serverUrl: BRIDGE_URL, token });
  console.log(`[showcase-live] workspaceCwd=${workspaceCwd || '(none)'}`);

  const ws = await connectGateway({ clientName: 'showcase-cards-live' });
  const reports = [];
  try {
    for (const card of queue) {
      const skipDeps = shouldSkipForDeps(card, args.excludeDeps);
      if (skipDeps) {
        const row = {
          id: card.id,
          name_zh: card.name_zh,
          section_id: card.section_id,
          status: 'skipped',
          reason: `exclude_deps=${skipDeps.join('+')}`,
          must_deliver: card.must_deliver,
          taskDir: null,
          sessionKey: null,
        };
        reports.push(row);
        appendProgress(progressPath, {
          id: card.id,
          status: 'skipped',
          section_id: card.section_id,
          reason: row.reason,
          at: new Date().toISOString(),
        });
        console.log(`[showcase-live] SKIP ${card.id} ${row.reason}`);
        continue;
      }

      try {
        const report = await runOneCard(ws, card, {
          workspaceCwd,
          timeoutMs: args.timeoutMs,
          maxTurns: args.maxTurns,
          outDir: args.outDir,
          progressPath,
        });
        reports.push(report);
      } catch (err) {
        const row = {
          id: card.id,
          name_zh: card.name_zh,
          section_id: card.section_id,
          status: 'failed',
          reason: String(err?.message || err),
          must_deliver: card.must_deliver,
          taskDir: null,
          sessionKey: null,
        };
        reports.push(row);
        appendProgress(progressPath, {
          id: card.id,
          status: 'failed',
          section_id: card.section_id,
          reason: row.reason,
          at: new Date().toISOString(),
        });
        console.error(`[showcase-live] ERROR ${card.id}`, err);
      }
    }
  } finally {
    closeGateway(ws);
  }

  const sectionId = args.section || 'mixed';
  const { summaryPath, mdPath, body } = writeSectionSummary(args.outDir, sectionId, reports);
  console.log(JSON.stringify({ ok: true, summaryPath, mdPath, counts: body.counts }, null, 2));
}

main().catch((err) => {
  console.error('[showcase-live] fatal', err);
  process.exit(1);
});
