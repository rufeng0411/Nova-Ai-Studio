#!/usr/bin/env node
/**
 * Regression: tail-read must not drop the first accepted_input (cloud 9a748581 class).
 * Simulates dense agent jsonl (~500+ entries, ~400KB) with PILOTDECK_HISTORY_TAIL_READ=1.
 */
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

import { getPilotProjectChatDir } from '../src/pilot/index.ts';
import { readWebSessionMessages } from '../src/web/server/readSessionMessages.ts';

const SESSION_ID = 'web-s_first_user_tail_regression';

function acceptedInput(sequence, text, turnId = `t-${sequence}`) {
  return JSON.stringify({
    type: 'accepted_input',
    sessionId: SESSION_ID,
    turnId,
    sequence,
    createdAt: `2026-06-24T08:00:${String(sequence % 60).padStart(2, '0')}.000Z`,
    entryId: `e-${sequence}`,
    messages: [{ role: 'user', content: [{ type: 'text', text }] }],
  });
}

function assistantToolCall(sequence, turnId) {
  return JSON.stringify({
    type: 'assistant_message',
    sessionId: SESSION_ID,
    turnId,
    sequence,
    createdAt: `2026-06-24T08:01:${String(sequence % 60).padStart(2, '0')}.000Z`,
    entryId: `e-a-${sequence}`,
    message: {
      role: 'assistant',
      content: [{
        type: 'tool_call',
        id: `tool-${sequence}`,
        name: 'read_file',
        input: { path: 'foo.txt' },
      }],
    },
  });
}

function toolResult(sequence, turnId) {
  return JSON.stringify({
    type: 'tool_result_message',
    sessionId: SESSION_ID,
    turnId,
    sequence,
    createdAt: `2026-06-24T08:02:${String(sequence % 60).padStart(2, '0')}.000Z`,
    entryId: `e-r-${sequence}`,
    message: {
      role: 'user',
      content: [{
        type: 'tool_result',
        toolCallId: `tool-${sequence}`,
        isError: false,
        content: [{ type: 'text', text: `result-${sequence}` }],
      }],
    },
  });
}

function successTurn(sequence, turnId) {
  return JSON.stringify({
    type: 'turn_result',
    sessionId: SESSION_ID,
    turnId,
    sequence,
    createdAt: `2026-06-24T08:05:${String(sequence % 60).padStart(2, '0')}.000Z`,
    entryId: `e-ok-${sequence}`,
    result: { type: 'success', stopReason: 'end_turn' },
  });
}

const FIRST_GOAL = '帮【吴裕泰】做 AI 搜索可见度标准包，直接开始做，做完告诉我各文件路径。';

async function seedDenseTranscript(projectRoot, pilotHome) {
  const lines = [acceptedInput(1, FIRST_GOAL)];
  for (let i = 2; i <= 520; i += 1) {
    const turnId = `t-${Math.floor(i / 3)}`;
    if (i % 3 === 1) lines.push(successTurn(i, turnId));
    else if (i % 3 === 2) lines.push(assistantToolCall(i, turnId));
    else lines.push(toolResult(i, turnId));
  }
  const chatDir = getPilotProjectChatDir(projectRoot, pilotHome);
  await mkdir(chatDir, { recursive: true });
  const body = `${lines.join('\n')}\n`;
  await writeFile(join(chatDir, `${SESSION_ID}.jsonl`), body, 'utf8');
  return body.length;
}

function collectUserTexts(messages) {
  return messages
    .filter((message) => message.role === 'user' && message.kind === 'text')
    .map((message) => message.text ?? '');
}

async function loadAllUserTexts(projectRoot, pilotHome) {
  process.env.PILOTDECK_HISTORY_TAIL_READ = '1';
  let page = await readWebSessionMessages(
    { sessionKey: SESSION_ID, projectKey: projectRoot, limit: 120, direction: 'backward' },
    { projectRoot, pilotHome },
  );
  let userTexts = collectUserTexts(page.messages);
  let guard = 0;
  while (page.nextCursor && guard < 30) {
    page = await readWebSessionMessages(
      {
        sessionKey: SESSION_ID,
        projectKey: projectRoot,
        limit: 120,
        direction: 'backward',
        cursor: page.nextCursor,
      },
      { projectRoot, pilotHome },
    );
    userTexts = [...collectUserTexts(page.messages), ...userTexts];
    guard += 1;
  }
  delete process.env.PILOTDECK_HISTORY_TAIL_READ;
  return userTexts;
}

const base = await mkdtemp(join(tmpdir(), 'pd-first-user-tail-'));
const pilotHome = join(base, 'home');
const projectRoot = join(base, 'project');
const bytes = await seedDenseTranscript(projectRoot, pilotHome);

const userTexts = await loadAllUserTexts(projectRoot, pilotHome);
assert.ok(bytes > 100_000, `expected dense fixture, got ${bytes} bytes`);
assert.ok(userTexts.some((text) => text.includes('吴裕泰')), 'tail-read must expose first user goal somewhere in history');
assert.equal(userTexts[0]?.includes('吴裕泰'), true, 'pagination must reach the very first user bubble');

console.log('[integration-first-user-tail-read] OK', {
  fixtureBytes: bytes,
  userBubbleCount: userTexts.length,
  firstPreview: userTexts[0]?.slice(0, 48),
});
