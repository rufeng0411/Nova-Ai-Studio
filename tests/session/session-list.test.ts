import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getPilotProjectChatDir } from "../../src/pilot/index.js";
import {
  countProjectSessions,
  countProjectSessionsFromChatDirs,
  listProjectSessions,
  listProjectSessionsFromChatDirs,
} from "../../src/session/storage/SessionList.js";

function acceptedInput(sessionId: string, sequence: number, text: string): string {
  return `${JSON.stringify({
    type: "accepted_input",
    sessionId,
    turnId: `turn-${sequence}`,
    sequence,
    createdAt: `2026-06-16T00:00:${String(sequence).padStart(2, "0")}.000Z`,
    entryId: `entry-${sequence}`,
    messages: [{ role: "user", content: [{ type: "text", text }] }],
  })}\n`;
}

async function writeSession(chatDir: string, sessionId: string, mtimeMs: number): Promise<void> {
  const path = join(chatDir, `${sessionId}.jsonl`);
  await writeFile(path, acceptedInput(sessionId, 1, `prompt ${sessionId}`), "utf8");
  const date = new Date(mtimeMs);
  await utimes(path, date, date);
}

test("listProjectSessions reads the requested page ordered by file mtime", async () => {
  const pilotHome = await mkdtemp(join(tmpdir(), "pilotdeck-session-list-home-"));
  const projectRoot = await mkdtemp(join(tmpdir(), "pilotdeck-session-list-project-"));
  const chatDir = getPilotProjectChatDir(projectRoot, pilotHome);
  await mkdir(chatDir, { recursive: true });

  await writeSession(chatDir, "older", 1_000);
  await writeSession(chatDir, "newest", 3_000);
  await writeSession(chatDir, "middle", 2_000);

  const sessions = await listProjectSessions({ projectRoot, pilotHome, limit: 2 });

  assert.deepEqual(sessions.map((session) => session.sessionId), ["newest", "middle"]);
  assert.equal(sessions[0]?.summary, "prompt newest");
});

test("countProjectSessions counts user sessions without reading transcript content", async () => {
  const pilotHome = await mkdtemp(join(tmpdir(), "pilotdeck-session-count-home-"));
  const projectRoot = await mkdtemp(join(tmpdir(), "pilotdeck-session-count-project-"));
  const chatDir = getPilotProjectChatDir(projectRoot, pilotHome);
  await mkdir(chatDir, { recursive: true });

  await writeSession(chatDir, "visible-a", 1_000);
  await writeSession(chatDir, "visible-b", 2_000);
  await writeFile(join(chatDir, "notes.txt"), "not a session", "utf8");

  assert.equal(await countProjectSessions({ projectRoot, pilotHome }), 2);
});

test("listProjectSessionsFromChatDirs merges and dedupes across chat dirs", async () => {
  const pilotHome = await mkdtemp(join(tmpdir(), "pilotdeck-session-merge-home-"));
  const projectRoot = await mkdtemp(join(tmpdir(), "pilotdeck-session-merge-project-"));
  const primaryChatDir = getPilotProjectChatDir(projectRoot, pilotHome);
  const legacyChatDir = join(pilotHome, "projects", "legacy-workspace", "chats");
  await mkdir(primaryChatDir, { recursive: true });
  await mkdir(legacyChatDir, { recursive: true });

  await writeSession(primaryChatDir, "newest", 3_000);
  await writeSession(legacyChatDir, "older", 1_000);
  await writeSession(legacyChatDir, "newest", 2_000);

  const sessions = await listProjectSessionsFromChatDirs({
    chatDirs: [primaryChatDir, legacyChatDir],
    pilotHome,
    projectRoot,
    limit: 10,
  });

  assert.deepEqual(sessions.map((session) => session.sessionId), ["newest", "older"]);
  assert.equal(await countProjectSessionsFromChatDirs([primaryChatDir, legacyChatDir]), 2);
});
