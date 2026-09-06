import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  countTranscriptLines,
  readTranscript,
  readTranscriptHeadEntries,
  readTranscriptTailEntries,
} from "../../../src/session/transcript/TranscriptReader.js";

const SESSION_ID = "web-s_tail_reader";

function entry(sequence: number, text: string) {
  return JSON.stringify({
    type: "accepted_input",
    sessionId: SESSION_ID,
    turnId: `t-${sequence}`,
    sequence,
    createdAt: `2026-06-20T00:00:${String(sequence).padStart(2, "0")}.000Z`,
    entryId: `e-${sequence}`,
    messages: [{ role: "user", content: [{ type: "text", text }] }],
  });
}

test("countTranscriptLines matches non-empty jsonl lines", async () => {
  const base = await mkdtemp(join(tmpdir(), "pd-tail-count-"));
  const path = join(base, "sample.jsonl");
  await writeFile(path, `${entry(1, "a")}\n\n${entry(2, "b")}\n`, "utf8");
  assert.equal(await countTranscriptLines(path), 2);
});

test("readTranscriptTailEntries returns tail entries only", async () => {
  const base = await mkdtemp(join(tmpdir(), "pd-tail-read-"));
  const path = join(base, "tail.jsonl");
  const lines = Array.from({ length: 40 }, (_, i) => entry(i + 1, `msg-${i + 1}`));
  await writeFile(path, `${lines.join("\n")}\n`, "utf8");

  const tail = await readTranscriptTailEntries(path, { maxBytesFromEnd: 4096, maxEntries: 5 });
  assert.ok(tail.entries.length <= 5);
  assert.equal(tail.entries.at(-1)?.sequence, 40);
});

test("readTranscriptTailEntries keeps head entries when entire file is loaded", async () => {
  const base = await mkdtemp(join(tmpdir(), "pd-tail-full-file-"));
  const path = join(base, "dense.jsonl");
  const lines = Array.from({ length: 600 }, (_, i) => entry(i + 1, i === 0 ? "FIRST_USER_GOAL" : `tool-${i + 1}`));
  await writeFile(path, `${lines.join("\n")}\n`, "utf8");

  const tail = await readTranscriptTailEntries(path, { maxBytesFromEnd: 1024 * 1024, maxEntries: 5 });
  assert.equal(tail.truncated, false);
  assert.equal(tail.entries.length, 600);
  const first = tail.entries[0];
  assert.equal(first?.sequence, 1);
  assert.equal(first?.type, "accepted_input");
  if (first?.type === "accepted_input") {
    const block = first.messages[0]?.content?.[0];
    assert.equal(block?.type === "text" ? block.text : undefined, "FIRST_USER_GOAL");
  }
});

test("readTranscriptHeadEntries returns earliest entries", async () => {
  const base = await mkdtemp(join(tmpdir(), "pd-head-read-"));
  const path = join(base, "head.jsonl");
  const lines = Array.from({ length: 40 }, (_, i) => entry(i + 1, `msg-${i + 1}`));
  await writeFile(path, `${lines.join("\n")}\n`, "utf8");

  const head = await readTranscriptHeadEntries(path, { maxBytesFromStart: 4096, maxEntries: 3 });
  assert.equal(head.entries.length, 3);
  assert.equal(head.entries[0]?.sequence, 1);
  assert.equal(head.entries.at(-1)?.sequence, 3);
});
