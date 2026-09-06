#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Seed ≥300 message jsonl + manifest for trust-stack perf tests.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COUNT = Number(process.env.TRUST_STACK_LARGE_MSG_COUNT || 320);
const SESSION_ID = process.env.TRUST_STACK_LARGE_SESSION_ID || 'web-s_trust_stack_large';
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'transcripts');
const JSONL_PATH = path.join(FIXTURE_DIR, 'trust-stack-large-session.jsonl');
const META_PATH = path.join(FIXTURE_DIR, 'trust-stack-large-session.meta.json');

function line(type, sequence, extra = {}) {
  return JSON.stringify({
    type,
    sessionId: SESSION_ID,
    turnId: `t-${Math.floor(sequence / 4)}`,
    sequence,
    createdAt: new Date(Date.UTC(2026, 5, 20, 0, 0, sequence)).toISOString(),
    entryId: `e-${sequence}`,
    ...extra,
  });
}

const lines = [];
for (let i = 0; i < COUNT; i += 1) {
  const kind = i % 4;
  if (kind === 0) {
    lines.push(line('accepted_input', i * 3 + 1, {
      messages: [{ role: 'user', content: [{ type: 'text', text: `用户消息 #${i}` }] }],
    }));
  } else if (kind === 1) {
    lines.push(line('assistant_message', i * 3 + 2, {
      message: { role: 'assistant', content: [{ type: 'text', text: `助手回复 #${i}` }] },
    }));
  } else if (kind === 2) {
    lines.push(line('tool_result_message', i * 3 + 3, {
      message: {
        role: 'user',
        content: [{
          type: 'tool_result',
          toolCallId: `tool-${i}`,
          isError: false,
          content: [{ type: 'text', text: `ok ${i}` }],
        }],
      },
    }));
  } else {
    lines.push(line('turn_result', i * 3 + 4, { result: { type: 'success', stopReason: 'end_turn' } }));
  }
}

fs.mkdirSync(FIXTURE_DIR, { recursive: true });
fs.writeFileSync(JSONL_PATH, `${lines.join('\n')}\n`, 'utf8');
const meta = {
  sessionId: SESSION_ID,
  messageCount: lines.length,
  jsonlPath: JSONL_PATH,
  projectKey: 'general',
  tenantId: 'default',
  generatedAt: new Date().toISOString(),
};
fs.writeFileSync(META_PATH, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
console.log(`[seed-trust-stack-large-session] wrote ${lines.length} lines → ${JSONL_PATH}`);
