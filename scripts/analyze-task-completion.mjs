#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Batch scan transcript JSONL for task-completion KPIs and intervention signals.
 * Usage:
 *   node scripts/analyze-task-completion.mjs [--data-root=.saas-dev-data] [--json] [--limit=50] [--gate]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseJsonlFile } from './lib/parseJsonlTurns.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const INTERVENTION_PATTERNS = [
  /继续/,
  /怎么又停/,
  /为什么停/,
  /不对/,
  /重来/,
  /没做完/,
  /为什么没有/,
];

const DELIVERABLE_GOAL_PATTERNS = [
  /(?:生成|制作|导出|创建|输出).{0,24}(?:ppt|PPT|pptx|幻灯)/i,
  /可编辑的?\s*(?:PPT|pptx|幻灯)/i,
  /(?:生成|导出|输出).{0,24}(?:docx|word|pdf|报告)/i,
  /调研|研究报告|竞品/,
  /HTML|落地页|幻灯/,
];

const USER_CONTINUE_SYNTHETIC = /task-resume|auto.?continue|不要向用户索要继续/i;

function parseArgs(argv) {
  const opts = {
    dataRoot: path.join(REPO_ROOT, '.saas-dev-data'),
    json: false,
    gate: false,
    gatePhase: 'phase1',
    limit: 0,
    telemetryDir: null,
  };
  for (const arg of argv) {
    if (arg === '--json') opts.json = true;
    else if (arg === '--gate') opts.gate = true;
    else if (arg.startsWith('--gate-phase=')) opts.gatePhase = arg.slice('--gate-phase='.length);
    else if (arg.startsWith('--data-root=')) opts.dataRoot = path.resolve(arg.slice('--data-root='.length));
    else if (arg.startsWith('--limit=')) opts.limit = Number(arg.slice('--limit='.length)) || 0;
    else if (arg.startsWith('--telemetry=')) opts.telemetryDir = path.resolve(arg.slice('--telemetry='.length));
  }
  if (!opts.telemetryDir) opts.telemetryDir = path.join(opts.dataRoot, 'telemetry');
  return opts;
}

function walkJsonlFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsonlFiles(full, out);
    else if (entry.name.endsWith('.jsonl') && full.includes(`${path.sep}chats${path.sep}`)) out.push(full);
  }
  return out;
}

function textFromUserMessage(entry) {
  const msg = entry?.message ?? entry?.messages?.[0];
  if (!msg?.content) return '';
  if (typeof msg.content === 'string') return msg.content;
  if (!Array.isArray(msg.content)) return '';
  return msg.content.filter((b) => b?.type === 'text').map((b) => b.text).join('\n');
}

function isSyntheticUser(entry) {
  const meta = entry?.message?.metadata ?? entry?.messages?.[0]?.metadata;
  return Boolean(meta?.synthetic || meta?.purpose === 'auto_continue' || meta?.purpose === 'tool_recovery');
}

function classifyGoal(text) {
  const t = String(text || '').trim();
  if (!t) return 'unknown';
  if (/ppt|PPT|pptx|幻灯/.test(t)) return 'ppt';
  if (/调研|研究报告|竞品|GEO/.test(t)) return 'research';
  if (/docx|word|pdf|报告/.test(t)) return 'document';
  if (/HTML|落地页|frontend-slides/.test(t)) return 'html_slides';
  if (/画布|canvas-edit/.test(t)) return 'canvas_edit';
  if (DELIVERABLE_GOAL_PATTERNS.some((re) => re.test(t))) return 'deliverable_other';
  return 'general';
}

function hasDeliverableExt(turn, ext) {
  const re = new RegExp(`\\.${ext}\\b`, 'i');
  return turn.toolPaths.some((p) => re.test(p))
    || turn.finalDeliverables?.some((d) => re.test(d.path || d.apiPath || ''));
}

function countRecoveryInEntries(entries) {
  let autoContinue = 0;
  let toolRecovery = 0;
  let turnProgress = 0;
  let turnInterrupted = 0;
  for (const e of entries) {
    if (e?.type === 'turn_progress') turnProgress += 1;
    if (e?.type === 'turn_interrupted') turnInterrupted += 1;
    const purpose = e?.message?.metadata?.purpose;
    if (purpose === 'auto_continue') autoContinue += 1;
    if (purpose === 'tool_recovery') toolRecovery += 1;
  }
  return { autoContinue, toolRecovery, turnProgress, turnInterrupted };
}

function analyzeSession(filePath) {
  let parsed;
  try {
    parsed = parseJsonlFile(filePath);
  } catch {
    return null;
  }

  const { entries, turns, sessionId } = parsed;
  const userMessages = entries.filter((e) => {
    if (e.type === 'accepted_input') return true;
    if (e.type === 'user_message') return true;
    return false;
  });

  const realUserTexts = [];
  const interventions = [];
  let firstGoal = '';
  let firstGoalType = 'unknown';

  for (const entry of userMessages) {
    const texts = entry.type === 'accepted_input'
      ? (entry.messages || []).map((m) => (typeof m.content === 'string' ? m.content : textFromUserMessage({ message: m })))
      : [textFromUserMessage(entry)];
    for (const text of texts) {
      if (!text?.trim() || isSyntheticUser(entry)) continue;
      if (USER_CONTINUE_SYNTHETIC.test(text)) continue;
      realUserTexts.push(text);
      if (!firstGoal) {
        firstGoal = text.slice(0, 200);
        firstGoalType = classifyGoal(text);
      }
      if (INTERVENTION_PATTERNS.some((re) => re.test(text))) {
        interventions.push(text.slice(0, 120));
      }
    }
  }

  const recovery = countRecoveryInEntries(entries);
  const lastTurn = turns[turns.length - 1];
  const hasPptx = turns.some((t) => hasDeliverableExt(t, 'pptx'));
  const hasDocx = turns.some((t) => hasDeliverableExt(t, 'docx'));
  const hasHtml = turns.some((t) => hasDeliverableExt(t, 'html'));
  const hasMd = turns.some((t) => hasDeliverableExt(t, 'md'));

  const goalImpliesDeliverable = DELIVERABLE_GOAL_PATTERNS.some((re) => re.test(firstGoal))
    || ['ppt', 'research', 'document', 'html_slides'].includes(firstGoalType);

  let completionStatus = 'unknown';
  if (!goalImpliesDeliverable) {
    completionStatus = interventions.length === 0 ? 'chat_ok' : 'chat_with_intervention';
  } else if (firstGoalType === 'ppt') {
    completionStatus = hasPptx ? (interventions.length === 0 ? 'verified_pptx' : 'pptx_with_intervention') : 'incomplete_ppt';
  } else if (firstGoalType === 'research') {
    completionStatus = (hasMd || hasDocx) && interventions.length === 0 ? 'verified_research' : 'incomplete_research';
  } else if (firstGoalType === 'html_slides') {
    completionStatus = hasHtml && interventions.length === 0 ? 'verified_html' : 'incomplete_html';
  } else {
    completionStatus = (hasPptx || hasDocx || hasHtml || hasMd) ? 'partial_deliverable' : 'incomplete';
  }

  const sessionName = path.basename(filePath, '.jsonl');
  const project = filePath.split(`${path.sep}projects${path.sep}`)[1]?.split(`${path.sep}chats`)[0] ?? '';

  return {
    filePath: path.relative(REPO_ROOT, filePath).replace(/\\/g, '/'),
    sessionId: sessionId || sessionName,
    project,
    goalType: firstGoalType,
    goalSnippet: firstGoal.slice(0, 100),
    turnCount: turns.length,
    userMessageCount: realUserTexts.length,
    interventionCount: interventions.length,
    interventionSamples: interventions.slice(0, 3),
    zeroIntervention: interventions.length === 0,
    completionStatus,
    hasPptx,
    hasDocx,
    hasHtml,
    hasMd,
    recovery,
    lastTurnSuccess: lastTurn?.hasTurnResult ?? false,
    lastAssistantSnippet: (lastTurn?.assistantText || '').slice(0, 150),
    lineCount: parsed.lineCount,
  };
}

function loadTelemetrySummary(telemetryDir) {
  const timingPath = path.join(telemetryDir, 'turn-timing.jsonl');
  const recoveryPath = path.join(telemetryDir, 'recovery-events.jsonl');
  const out = { timingTraces: 0, firstVisibleP95Ms: null, memoryRetrieveP95Ms: null, recoveryEvents: 0, recoveryByReason: {} };

  if (fs.existsSync(timingPath)) {
    const lines = fs.readFileSync(timingPath, 'utf8').split(/\r?\n/).filter(Boolean);
    out.timingTraces = lines.length;
    const firstVisible = [];
    const memoryRetrieve = [];
    for (const line of lines) {
      try {
        const row = JSON.parse(line);
        if (typeof row.firstVisibleMs === 'number') firstVisible.push(row.firstVisibleMs);
        for (const stage of row.stages || []) {
          if (stage.stage === 'turn.memory_retrieve' && typeof stage.durationMs === 'number') {
            memoryRetrieve.push(stage.durationMs);
          }
        }
      } catch { /* skip */ }
    }
    out.firstVisibleP95Ms = percentile(firstVisible, 0.95);
    out.memoryRetrieveP95Ms = percentile(memoryRetrieve, 0.95);
  }

  if (fs.existsSync(recoveryPath)) {
    const lines = fs.readFileSync(recoveryPath, 'utf8').split(/\r?\n/).filter(Boolean);
    out.recoveryEvents = lines.length;
    for (const line of lines) {
      try {
        const row = JSON.parse(line);
        const reason = row.reason || 'unknown';
        out.recoveryByReason[reason] = (out.recoveryByReason[reason] || 0) + 1;
      } catch { /* skip */ }
    }
  }
  return out;
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return Math.round(sorted[idx]);
}

function aggregate(sessions) {
  const deliverableSessions = sessions.filter((s) =>
    ['ppt', 'research', 'document', 'html_slides', 'deliverable_other'].includes(s.goalType),
  );
  const withIntervention = sessions.filter((s) => s.interventionCount > 0);
  const pptSessions = sessions.filter((s) => s.goalType === 'ppt');
  const pptComplete = pptSessions.filter((s) => s.hasPptx);
  const pptZeroIntervention = pptSessions.filter((s) => s.hasPptx && s.zeroIntervention);
  const emptySpinSessions = deliverableSessions.filter((s) =>
    s.recovery.autoContinue > 0
    && !s.hasPptx
    && !s.hasDocx
    && !s.hasHtml
    && !s.hasMd
    && !s.lastTurnSuccess
  );

  return {
    totalSessions: sessions.length,
    deliverableSessions: deliverableSessions.length,
    interventionRate: sessions.length ? withIntervention.length / sessions.length : 0,
    deliverableInterventionRate: deliverableSessions.length
      ? deliverableSessions.filter((s) => s.interventionCount > 0).length / deliverableSessions.length
      : 0,
    zeroInterventionRate: deliverableSessions.length
      ? deliverableSessions.filter((s) => s.zeroIntervention && (s.hasPptx || s.hasDocx || s.hasHtml || s.hasMd)).length / deliverableSessions.length
      : 0,
    pptCompletionRate: pptSessions.length ? pptComplete.length / pptSessions.length : 0,
    pptZeroInterventionRate: pptSessions.length ? pptZeroIntervention.length / pptSessions.length : 0,
    recoveryEmptySpinRate: deliverableSessions.length ? emptySpinSessions.length / deliverableSessions.length : 0,
    byCompletionStatus: sessions.reduce((acc, s) => {
      acc[s.completionStatus] = (acc[s.completionStatus] || 0) + 1;
      return acc;
    }, {}),
    byGoalType: sessions.reduce((acc, s) => {
      acc[s.goalType] = (acc[s.goalType] || 0) + 1;
      return acc;
    }, {}),
    avgInterventions: sessions.length
      ? sessions.reduce((sum, s) => sum + s.interventionCount, 0) / sessions.length
      : 0,
    avgAutoContinuePerSession: sessions.length
      ? sessions.reduce((sum, s) => sum + s.recovery.autoContinue, 0) / sessions.length
      : 0,
  };
}

export const TASK_COMPLETION_GATE_THRESHOLDS = {
  phase1: {
    maxDeliverableInterventionRate: 0.22,
    minPptCompletionRate: 0.08,
    maxRecoveryEmptySpinRate: 0.15,
  },
  phase2: {
    maxDeliverableInterventionRate: 0.15,
    minPptCompletionRate: 0.20,
    maxRecoveryEmptySpinRate: 0.08,
  },
  phase3: {
    maxDeliverableInterventionRate: 0.08,
    minPptCompletionRate: 0.60,
    maxRecoveryEmptySpinRate: 0.05,
  },
};

export function evaluateTaskCompletionGate(summary, phase = 'phase1') {
  const thresholds = TASK_COMPLETION_GATE_THRESHOLDS[phase] ?? TASK_COMPLETION_GATE_THRESHOLDS.phase1;
  const failures = [];
  if (summary.deliverableInterventionRate > thresholds.maxDeliverableInterventionRate) {
    failures.push(`deliverableInterventionRate ${(summary.deliverableInterventionRate * 100).toFixed(1)}% > ${(thresholds.maxDeliverableInterventionRate * 100).toFixed(1)}%`);
  }
  if (summary.pptCompletionRate < thresholds.minPptCompletionRate) {
    failures.push(`pptCompletionRate ${(summary.pptCompletionRate * 100).toFixed(1)}% < ${(thresholds.minPptCompletionRate * 100).toFixed(1)}%`);
  }
  if (summary.recoveryEmptySpinRate > thresholds.maxRecoveryEmptySpinRate) {
    failures.push(`recoveryEmptySpinRate ${(summary.recoveryEmptySpinRate * 100).toFixed(1)}% > ${(thresholds.maxRecoveryEmptySpinRate * 100).toFixed(1)}%`);
  }
  return {
    ok: failures.length === 0,
    phase,
    thresholds,
    failures,
  };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const files = walkJsonlFiles(opts.dataRoot);
  const sessions = [];
  for (const file of files) {
    const row = analyzeSession(file);
    if (row) sessions.push(row);
  }
  sessions.sort((a, b) => b.interventionCount - a.interventionCount || b.turnCount - a.turnCount);

  const limited = opts.limit > 0 ? sessions.slice(0, opts.limit) : sessions;
  const summary = aggregate(sessions);
  const telemetry = loadTelemetrySummary(opts.telemetryDir);

  const payload = {
    generatedAt: new Date().toISOString(),
    dataRoot: path.relative(REPO_ROOT, opts.dataRoot),
    summary,
    telemetry,
    sessions: limited,
    topInterventionSessions: sessions.filter((s) => s.interventionCount > 0).slice(0, 20),
  };

  if (opts.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log('# Task completion scan (v0)\n');
  console.log(`Generated: ${payload.generatedAt}`);
  console.log(`Sessions scanned: ${summary.totalSessions}\n`);
  console.log('## KPI summary');
  console.log(`- Deliverable-oriented sessions: ${summary.deliverableSessions}`);
  console.log(`- Overall intervention rate: ${(summary.interventionRate * 100).toFixed(1)}%`);
  console.log(`- Deliverable intervention rate: ${(summary.deliverableInterventionRate * 100).toFixed(1)}%`);
  console.log(`- PPT completion rate (.pptx tool path): ${(summary.pptCompletionRate * 100).toFixed(1)}%`);
  console.log(`- PPT zero-intervention completion: ${(summary.pptZeroInterventionRate * 100).toFixed(1)}%`);
  console.log(`- Recovery empty spin rate: ${(summary.recoveryEmptySpinRate * 100).toFixed(1)}%`);
  console.log(`- Avg user interventions/session: ${summary.avgInterventions.toFixed(2)}`);
  console.log(`- Avg synthetic auto_continue/session: ${summary.avgAutoContinuePerSession.toFixed(2)}`);
  if (telemetry.firstVisibleP95Ms != null) {
    console.log(`- TTFT first_visible p95: ${telemetry.firstVisibleP95Ms}ms`);
  }
  if (telemetry.memoryRetrieveP95Ms != null) {
    console.log(`- memory_retrieve p95: ${telemetry.memoryRetrieveP95Ms}ms`);
  }
  console.log('\n## By completion status');
  for (const [k, v] of Object.entries(summary.byCompletionStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`- ${k}: ${v}`);
  }
  console.log('\n## Top intervention sessions');
  for (const s of payload.topInterventionSessions.slice(0, 10)) {
    console.log(`- ${s.sessionId} (${s.goalType}) interventions=${s.interventionCount} status=${s.completionStatus}`);
    console.log(`  ${s.goalSnippet}`);
  }
  if (opts.gate) {
    const gate = evaluateTaskCompletionGate(summary, opts.gatePhase);
    console.log('\n## Gate');
    console.log(`- phase: ${gate.phase}`);
    console.log(`- result: ${gate.ok ? 'PASS' : 'FAIL'}`);
    for (const failure of gate.failures) {
      console.log(`- ${failure}`);
    }
    if (!gate.ok) process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
