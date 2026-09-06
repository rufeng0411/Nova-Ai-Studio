#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Generate synthetic large write_file transcript fixture (no user data).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'tests', 'fixtures', 'transcripts', 'large-write-file.jsonl');
const SESSION_ID = 'web-s_large_write_fixture';
const BLOB = 'x'.repeat(2 * 1024 * 1024);
const TARGET = 'artifacts/demo/large-page.html';

function line(type, sequence, extra = {}) {
  return JSON.stringify({
    type,
    sessionId: SESSION_ID,
    turnId: 't-large-1',
    sequence,
    createdAt: `2026-06-20T00:00:${String(sequence).padStart(2, '0')}.000Z`,
    entryId: `e-${sequence}`,
    ...extra,
  });
}

const lines = [
  line('accepted_input', 1, {
    messages: [{ role: 'user', content: [{ type: 'text', text: '生成大 HTML 页面' }] }],
  }),
  line('assistant_message', 2, {
    message: {
      role: 'assistant',
      content: [{
        type: 'tool_call',
        id: 'tool-write-1',
        name: 'write_file',
        input: { file_path: TARGET, content: BLOB },
      }],
    },
  }),
  line('tool_result_message', 3, {
    message: {
      role: 'user',
      content: [{
        type: 'tool_result',
        toolCallId: 'tool-write-1',
        isError: false,
        content: [{ type: 'text', text: `Wrote ${TARGET}\n${BLOB}` }],
      }],
    },
  }),
  line('turn_result', 4, { result: { type: 'success', stopReason: 'end_turn' } }),
];

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, `${lines.join('\n')}\n`, 'utf8');
console.log(`Wrote ${OUT} (${Math.round(BLOB.length / 1024)}KB tool body)`);
