#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Live Gateway acceptance — continuity storyboard pack (P0 gate).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  closeGateway,
  connectGateway,
  newSession,
  REPO_ROOT,
  submitTurn,
} from './lib/gatewaySessionHarness.mjs';
import { resolveGeneralWorkspaceCwd } from './lib/resolveGeneralWorkspaceCwd.mjs';
import { checkProfileRequiredDeliverables } from '../src/saas/deliverables/profileRequiredDeliverables.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_KEY = process.env.STORYBOARD_PROJECT || 'general';
const TIMEOUT_MS = Number(process.env.STORYBOARD_TIMEOUT_MS || 1_200_000);
const MAX_TURNS = Number(process.env.STORYBOARD_MAX_TURNS || 24);

const PROMPT = [
  '用「连续性分镜包」为【雷蛇灵刃2026，5090，世界最强笔记本】广告创意输出 continuity 分镜包：',
  'continuity_bible.md、shot_cards.md、handoff_design_matrix.md。',
  '目录 artifacts/storyboard-razer-blade-2026-p0/，直接开始做，做完告诉我各文件路径。',
  '单次 write_file 不超过 80 行，用 edit_file 分段追加；禁止空参数工具调用。',
].join('\n');

const REPORT_PATH = path.join(
  REPO_ROOT,
  'docs',
  `storyboard-pack-acceptance-${new Date().toISOString().slice(0, 10)}.md`,
);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForDevReady(maxMs = 180_000) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    try {
      const health = await fetch('http://127.0.0.1:3001/api/health', { signal: AbortSignal.timeout(3000) });
      if (health.ok) return true;
    } catch {
      // keep polling
    }
    await sleep(3000);
  }
  return false;
}

function collectEvents() {
  const events = [];
  return {
    onEvent(event) {
      events.push({
        type: event.type,
        reason: event.reason,
        at: new Date().toISOString(),
      });
    },
    events,
  };
}

function hasHardStopLeak(events) {
  return events.some((e) =>
    e.type === 'turn_failed'
    || (e.type === 'turn_completed' && /Large file repair|Repeated invalid tool input/i.test(JSON.stringify(e))),
  );
}

async function main() {
  const ready = await waitForDevReady();
  if (!ready) {
    console.error('[storyboard-pack] dev stack not ready on :3001');
    process.exit(1);
  }

  const workspaceCwd = await resolveGeneralWorkspaceCwd({
    serverUrl: 'http://127.0.0.1:3001',
  });
  if (!workspaceCwd) {
    console.error('[storyboard-pack] could not resolve workspace cwd');
    process.exit(1);
  }

  console.log(`[storyboard-pack] workspaceCwd=${workspaceCwd}`);
  console.log(`[storyboard-pack] timeout=${TIMEOUT_MS}ms maxTurns=${MAX_TURNS}`);

  const ws = await connectGateway({ clientName: 'storyboard-pack-smoke' });
  const sessionKey = await newSession(ws, PROJECT_KEY);
  const { onEvent, events } = collectEvents();

  const run = await submitTurn(ws, {
    sessionKey,
    projectKey: PROJECT_KEY,
    workspaceCwd,
    message: PROMPT,
    timeoutMs: TIMEOUT_MS,
    maxTurns: MAX_TURNS,
    tag: 'storyboard-p0',
    onEvent,
  });
  closeGateway(ws);

  const requiredChecks = await checkProfileRequiredDeliverables({
    cwd: workspaceCwd,
    userGoal: PROMPT,
    capabilitySlug: 'create-vid-storyboard-pack',
  });

  const passFiles = requiredChecks.filter((c) => c.exists && c.sizeBytes > 0);
  const missingFiles = requiredChecks.filter((c) => !c.exists || c.sizeBytes <= 0);

  const recoveryReasons = events
    .filter((e) => /continue|repair|recovery|partial/i.test(String(e.reason || e.type)))
    .map((e) => `${e.type}:${e.reason ?? ''}`);

  const functionalPass =
    missingFiles.length === 0
    && (run.turnCompleted || passFiles.length === requiredChecks.length);
  const harnessPass = run.ok && run.turnCompleted && !run.timeout;
  const pass = harnessPass || (functionalPass && passFiles.length >= 3);

  const report = {
    at: new Date().toISOString(),
    ok: pass,
    classification: harnessPass
      ? 'harness_ok'
      : functionalPass
        ? 'functional_pass_response_timeout'
        : 'fail',
    run: {
      ok: run.ok,
      turnCompleted: run.turnCompleted,
      timeout: run.timeout,
      durationMs: run.durationMs,
      resolvedBy: run.resolvedBy,
      stopReason: run.stopReason,
      recoveryAttempts: run.recoveryAttempts,
      toolCalls: run.toolCalls,
      error: run.error,
    },
    deliverables: {
      required: requiredChecks,
      passCount: passFiles.length,
      missingCount: missingFiles.length,
    },
    recoveryTrace: recoveryReasons.slice(0, 40),
    sessionKey,
    workspaceCwd,
  };

  const md = [
    '# Storyboard Pack P0 Acceptance',
    '',
    `- **Time**: ${report.at}`,
    `- **Result**: ${report.ok ? 'PASS' : 'FAIL'} (${report.classification ?? '—'})`,
    `- **Duration**: ${Math.round((run.durationMs || 0) / 1000)}s`,
    `- **Resolved by**: ${run.resolvedBy ?? '—'}`,
    `- **Turn completed**: ${run.turnCompleted}`,
    `- **Timeout**: ${run.timeout}`,
    `- **Stop reason**: ${run.stopReason ?? '—'}`,
    '',
    '## Required deliverables',
    '',
    ...requiredChecks.map((c) =>
      `- ${c.basename}: ${c.exists && c.sizeBytes > 0 ? `OK \`${c.path}\`` : 'MISSING'}`,
    ),
    '',
    '## Recovery trace (sample)',
    '',
    ...recoveryReasons.slice(0, 20).map((line) => `- ${line}`),
    '',
    '## Tool calls',
    '',
    '```json',
    JSON.stringify(run.toolCalls ?? {}, null, 2),
    '```',
    '',
  ].join('\n');

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, md, 'utf8');
  fs.writeFileSync(
    path.join(REPO_ROOT, 'artifacts', 'storyboard-pack-smoke-last.json'),
    JSON.stringify(report, null, 2),
    'utf8',
  );

  console.log(`[storyboard-pack] report=${REPORT_PATH}`);
  console.log(`[storyboard-pack] deliverables ${passFiles.length}/${requiredChecks.length}`);
  if (missingFiles.length) {
    console.log(`[storyboard-pack] missing: ${missingFiles.map((m) => m.basename).join(', ')}`);
  }
  console.log(`[storyboard-pack] recoveryAttempts=${run.recoveryAttempts}`);

  if (!pass) {
    console.error('[storyboard-pack] FAIL required deliverables or turn incomplete');
    process.exit(1);
  }
  if (!harnessPass && functionalPass) {
    console.log('[storyboard-pack] PASS (functional — submit_turn response after timeout, files verified on disk)');
  } else {
    console.log('[storyboard-pack] PASS');
  }
}

main().catch((err) => {
  console.error('[storyboard-pack]', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
