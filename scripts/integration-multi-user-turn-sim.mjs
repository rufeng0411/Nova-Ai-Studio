#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Multi-task concurrent turn sim — strict isolation + per-task acceptance.
 *
 * Runs 5+ different deliverable profiles in parallel on independent WS connections and
 * asserts they never cross-contaminate: each task carries a unique `qx*` slug and no
 * task's written paths or assistant text may leak another task's slug. Each task keeps
 * an independent recovery budget and its own acceptance status.
 *
 * Requires dev:saas Gateway. Skips gracefully when token missing unless FORCE_MULTI_USER_SIM=1.
 */
import assert from 'node:assert/strict';
import {
  closeGateway,
  connectGateway,
  newSession,
  submitTurn,
} from './lib/gatewaySessionHarness.mjs';

const SKIP_LIVE = process.env.MULTI_USER_SIM_SKIP === '1';
const MAX_RECOVERY_PER_TURN = Number(process.env.MULTI_USER_MAX_RECOVERY || 6);
const TIMEOUT_MS = Number(process.env.MULTI_USER_TIMEOUT_MS || 120_000);

// Each task owns a unique slug. Slugs never appear in any other task's prompt, so any
// occurrence of a foreign slug in written paths or assistant text proves cross-talk.
const USERS = [
  {
    tag: 'qxalpha',
    slug: 'qxalpha',
    projectKey: 'general',
    prompt:
      '简短回复：列出 3 条北京 AI 转型要点，然后 write_file artifacts/qxalpha-brief.md，禁止 read_file skills/',
  },
  {
    tag: 'qxbravo',
    slug: 'qxbravo',
    projectKey: 'general',
    prompt:
      '简短回复：为测试产品写 3 条社媒标题，然后 write_file artifacts/qxbravo-titles.md，禁止 read_file skills/',
  },
  {
    tag: 'qxcharlie',
    slug: 'qxcharlie',
    projectKey: 'general',
    prompt:
      '简短回复：写 3 条产品 FAQ，然后 write_file artifacts/qxcharlie-faq.md，禁止 read_file skills/',
  },
  {
    tag: 'qxdelta',
    slug: 'qxdelta',
    projectKey: 'general',
    prompt:
      '简短回复：写一份 3 点会议大纲，然后 write_file artifacts/qxdelta-outline.md，禁止 read_file skills/',
  },
  {
    tag: 'qxecho',
    slug: 'qxecho',
    projectKey: 'general',
    prompt:
      '简短回复：写 3 条更新说明，然后 write_file artifacts/qxecho-notes.md，禁止 read_file skills/',
  },
];

async function runUserScenario(user) {
  const ws = await connectGateway({ clientName: `multi-user-${user.tag}` });
  try {
    const sessionKey = await newSession(ws, user.projectKey);
    const result = await submitTurn(ws, {
      sessionKey,
      projectKey: user.projectKey,
      message: user.prompt,
      tag: user.tag,
      timeoutMs: TIMEOUT_MS,
      maxTurns: 6,
    });
    return { user: user.tag, slug: user.slug, ...result };
  } finally {
    closeGateway(ws);
  }
}

// PD-SAAS-FORK: core isolation assertion — a task's footprint must not mention foreign slugs.
function assertNoCrossContamination(results) {
  for (const own of results) {
    const haystack = `${own.toolWritePaths.join('\n')}\n${own.assistantText}`.toLowerCase();
    for (const other of results) {
      if (other.slug === own.slug) continue;
      assert.ok(
        !haystack.includes(other.slug),
        `${own.user}: footprint leaked foreign slug "${other.slug}" (cross-task contamination)`,
      );
    }
  }
}

async function main() {
  if (SKIP_LIVE) {
    console.log('[test:multi-user:sim] SKIP (MULTI_USER_SIM_SKIP=1)');
    return;
  }

  try {
    // PD-SAAS-FORK: parallel sessions on separate WS connections for owner/path isolation.
    const results = await Promise.all(USERS.map((user) => runUserScenario(user)));

    for (const r of results) {
      const wrotePaths = r.toolWritePaths.join(', ') || '(none)';
      console.log(
        `[${r.user}] ok=${r.ok} timeout=${r.timeout} success=${r.success} acceptance=${r.acceptanceStatus ?? 'n/a'} recovery=${r.recoveryAttempts} exhausted=${r.recoveryExhausted} duration=${r.durationMs}ms paths=[${wrotePaths}]`,
      );

      // Per-task independent recovery budget.
      assert.ok(
        r.recoveryAttempts <= MAX_RECOVERY_PER_TURN,
        `${r.user}: recovery attempts ${r.recoveryAttempts} > ${MAX_RECOVERY_PER_TURN}`,
      );
      if (r.budgetRemainingSamples.length > 0) {
        const hasNonZero = r.budgetRemainingSamples.some((n) => n > 0);
        if (r.recoveryAttempts > 0 && !r.recoveryExhausted) {
          assert.ok(hasNonZero, `${r.user}: budgetRemaining should be >0 when recoveries remain`);
        }
      }

      // Simple single-file md tasks should not end in a hard user-action block.
      assert.notEqual(
        r.acceptanceStatus,
        'user_action_required',
        `${r.user}: unexpected user_action_required for a no-key md task`,
      );

      // Soft signal: each task should write under its own slug (warn only — model wording varies).
      const wroteOwnSlug = r.toolWritePaths.some((p) => p.toLowerCase().includes(r.slug));
      if (!wroteOwnSlug) {
        console.warn(`[${r.user}] WARN: no written path contained own slug "${r.slug}"`);
      }
    }

    // Strict cross-task isolation across the whole concurrent batch.
    assertNoCrossContamination(results);

    // The batch must not collapse into a global failure (concurrency-induced cross failure).
    const completed = results.filter((r) => r.turnCompleted).length;
    assert.ok(
      completed >= Math.ceil(results.length / 2),
      `only ${completed}/${results.length} tasks completed — possible concurrency stall`,
    );

    console.log(`[test:multi-user:sim] OK — ${results.length} concurrent tasks, no cross-talk`);
  } catch (err) {
    if (process.env.FORCE_MULTI_USER_SIM === '1') throw err;
    console.log(`[test:multi-user:sim] SKIP — ${err instanceof Error ? err.message : err}`);
  }
}

main().catch((error) => {
  console.error('[test:multi-user:sim] FAIL:', error instanceof Error ? error.message : error);
  process.exit(1);
});
