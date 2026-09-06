import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { performance } from "node:perf_hooks";

import { getPilotProjectChatDir } from "../../../src/pilot/index.js";
import { readWebSessionMessages } from "../../../src/web/server/readSessionMessages.js";

const SESSION_ID = "web-s_tail_perf";

function acceptedInput(sequence: number, text: string): string {
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

async function seedLargeTranscript(projectRoot: string, pilotHome: string, count: number) {
  const chatDir = getPilotProjectChatDir(projectRoot, pilotHome);
  const lines = Array.from({ length: count }, (_, i) => acceptedInput(i + 1, `user-${i + 1}`));
  await writeFile(join(chatDir, `${SESSION_ID}.jsonl`), `${lines.join("\n")}\n`, "utf8");
}

test("tail read backward is faster than full read on large transcript", async () => {
  const base = await mkdtemp(join(tmpdir(), "pd-tail-perf-"));
  const pilotHome = join(base, "home");
  const projectRoot = join(base, "project");
  await mkdir(getPilotProjectChatDir(projectRoot, pilotHome), { recursive: true });
  await seedLargeTranscript(projectRoot, pilotHome, 800);

  process.env.PILOTDECK_HISTORY_TAIL_READ = "0";
  const fullStart = performance.now();
  await readWebSessionMessages(
    { sessionKey: SESSION_ID, projectKey: projectRoot, limit: 120, direction: "backward" },
    { projectRoot, pilotHome },
  );
  const fullMs = performance.now() - fullStart;

  process.env.PILOTDECK_HISTORY_TAIL_READ = "1";
  const tailStart = performance.now();
  const tail = await readWebSessionMessages(
    { sessionKey: SESSION_ID, projectKey: projectRoot, limit: 120, direction: "backward" },
    { projectRoot, pilotHome },
  );
  const tailMs = performance.now() - tailStart;

  assert.equal(tail.messages.length, 120);
  assert.ok(tailMs <= fullMs * 0.5 || tailMs < 500, `tail=${tailMs.toFixed(1)}ms full=${fullMs.toFixed(1)}ms`);
  delete process.env.PILOTDECK_HISTORY_TAIL_READ;
});
