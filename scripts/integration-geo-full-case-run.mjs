#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Live Gateway acceptance for brand GEO full-case deliverables.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  closeGateway,
  connectGateway,
  newSession,
  REPO_ROOT,
  submitTurn,
} from './lib/gatewaySessionHarness.mjs';
import { resolveGeneralWorkspaceCwd } from './lib/resolveGeneralWorkspaceCwd.mjs';
import { checkProfileRequiredDeliverables } from '../src/saas/deliverables/profileRequiredDeliverables.ts';

const PROJECT_KEY = process.env.GEO_PROJECT || 'general';
const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:3001';
const TIMEOUT_MS = Number(process.env.GEO_TIMEOUT_MS || 900_000);
const MAX_TURNS = Number(process.env.GEO_MAX_TURNS || 24);
const ARTIFACT_DIR = process.env.GEO_ARTIFACT_DIR || 'artifacts/razer-blade-2026-geo-live';

const PROMPT = [
  '帮【雷蛇灵刃2026】做品牌 GEO 全案终验 smoke，按阶段一次执行。',
  '核心优势【高配置，轻薄，高端】，竞品【你来分析】。',
  `全部文件写入 ${ARTIFACT_DIR}/，如联网或评分不可用请降级仍交付，不要中断。`,
  '必须产出这些文件名：',
  'geo-aeo-audit-checklist.md、keywords-research.md、zhihu-article.md、xiaohongshu-article.md、wechat-article.md、optimized.md、schema.jsonld、citability-report.md、visibility-report.html。',
  'visibility-report.html 必须是可打开 HTML；schema.jsonld 必须是 JSON-LD；直接开始做，做完告诉我各文件路径。',
  '单次 write_file 不超过 80 行，用 edit_file 分段追加；禁止空参数工具调用。',
].join('\n');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDevReady(maxMs = 180_000) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    try {
      const health = await fetch(`${SERVER_URL.replace(/\/$/, '')}/api/health`, {
        signal: AbortSignal.timeout(3000),
      });
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

function classifyRun(run, missingFiles, passFiles, requiredChecks) {
  const functionalPass =
    missingFiles.length === 0
    && (run.turnCompleted || passFiles.length === requiredChecks.length);
  const harnessPass = run.ok && run.turnCompleted && !run.timeout;
  if (harnessPass) return 'harness_ok';
  if (functionalPass) return 'functional_pass';
  return 'fail';
}

async function main() {
  const ready = await waitForDevReady();
  if (!ready) {
    console.error(`[geo-full-case] dev stack not ready on ${SERVER_URL}`);
    process.exit(1);
  }

  const workspaceCwd = await resolveGeneralWorkspaceCwd({ serverUrl: SERVER_URL });
  if (!workspaceCwd) {
    console.error('[geo-full-case] could not resolve workspace cwd');
    process.exit(1);
  }

  console.log(`[geo-full-case] workspaceCwd=${workspaceCwd}`);
  console.log(`[geo-full-case] timeout=${TIMEOUT_MS}ms maxTurns=${MAX_TURNS}`);

  const ws = await connectGateway({ clientName: 'geo-full-case-smoke' });
  const sessionKey = await newSession(ws, PROJECT_KEY);
  const { onEvent, events } = collectEvents();
  const run = await submitTurn(ws, {
    sessionKey,
    projectKey: PROJECT_KEY,
    workspaceCwd,
    message: PROMPT,
    timeoutMs: TIMEOUT_MS,
    maxTurns: MAX_TURNS,
    tag: 'geo-full-case',
    onEvent,
  });
  closeGateway(ws);

  const requiredChecks = await checkProfileRequiredDeliverables({
    cwd: workspaceCwd,
    userGoal: PROMPT,
    capabilitySlug: 'pd-geo',
  });
  const passFiles = requiredChecks.filter((check) => check.exists && check.sizeBytes > 0);
  const missingFiles = requiredChecks.filter((check) => !check.exists || check.sizeBytes <= 0);
  const classification = classifyRun(run, missingFiles, passFiles, requiredChecks);
  const pass = classification !== 'fail';
  const recoveryReasons = events
    .filter((event) => /continue|repair|recovery|partial/i.test(String(event.reason || event.type)))
    .map((event) => `${event.type}:${event.reason ?? ''}`);

  const report = {
    at: new Date().toISOString(),
    ok: pass,
    classification,
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
    artifactDir: ARTIFACT_DIR,
  };

  const stamp = new Date().toISOString().slice(0, 10);
  const reportPath = path.join(REPO_ROOT, 'docs', `geo-full-case-acceptance-${stamp}.md`);
  const md = [
    '# GEO Full Case Acceptance',
    '',
    `- **Time**: ${report.at}`,
    `- **Result**: ${report.ok ? 'PASS' : 'FAIL'} (${classification})`,
    `- **Duration**: ${Math.round((run.durationMs || 0) / 1000)}s`,
    `- **Resolved by**: ${run.resolvedBy ?? '—'}`,
    `- **Turn completed**: ${run.turnCompleted}`,
    `- **Timeout**: ${run.timeout}`,
    `- **Recovery attempts**: ${run.recoveryAttempts}`,
    '',
    '## Required deliverables',
    '',
    ...requiredChecks.map((check) =>
      `- ${check.basename}: ${check.exists && check.sizeBytes > 0 ? `OK \`${check.path}\`` : 'MISSING'}`,
    ),
    '',
    '## Tool calls',
    '',
    '```json',
    JSON.stringify(run.toolCalls ?? {}, null, 2),
    '```',
    '',
  ].join('\n');

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, md, 'utf8');
  fs.mkdirSync(path.join(REPO_ROOT, 'artifacts'), { recursive: true });
  fs.writeFileSync(
    path.join(REPO_ROOT, 'artifacts', 'geo-full-case-smoke-last.json'),
    JSON.stringify(report, null, 2),
    'utf8',
  );

  console.log(`[geo-full-case] report=${reportPath}`);
  console.log(`[geo-full-case] deliverables ${passFiles.length}/${requiredChecks.length}`);
  if (missingFiles.length) {
    console.log(`[geo-full-case] missing: ${missingFiles.map((check) => check.basename).join(', ')}`);
  }
  console.log(`[geo-full-case] recoveryAttempts=${run.recoveryAttempts}`);

  if (!pass) {
    console.error('[geo-full-case] FAIL required deliverables or turn incomplete');
    process.exit(1);
  }
  console.log('[geo-full-case] PASS');
}

main().catch((error) => {
  console.error('[geo-full-case]', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
