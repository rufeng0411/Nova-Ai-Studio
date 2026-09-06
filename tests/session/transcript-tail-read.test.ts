import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { readTranscript } from "../../src/session/transcript/TranscriptReader.js";

function entry(sequence: number): string {
  return JSON.stringify({
    type: "accepted_input",
    sessionId: "s1",
    turnId: "t1",
    sequence,
    createdAt: "2026-06-02T00:00:00.000Z",
    entryId: `e-${sequence}`,
    messages: [{ role: "user", content: [{ type: "text", text: `msg-${sequence}` }] }],
  });
}

test("readTranscript loads tail when file exceeds maxBytes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pilotdeck-transcript-"));
  const path = join(dir, "large.jsonl");
  const lines = Array.from({ length: 40 }, (_, index) => entry(index + 1));
  const padding = "x".repeat(60_000);
  const body = [
    ...lines.slice(0, 20).map((line) => `${line}\n${padding}`),
    ...lines.slice(20).map((line) => `${line}\n`),
  ].join("\n");
  await writeFile(path, body, "utf8");

  const result = await readTranscript(path, { maxBytes: 8_192 });
  assert.equal(result.truncated, true);
  assert.ok(result.entries.length > 0);
  assert.ok(result.entries.every((entryItem) => entryItem.sequence >= 20));
  assert.ok(result.diagnostics.some((d) => d.code === "transcript_truncated"));
});
