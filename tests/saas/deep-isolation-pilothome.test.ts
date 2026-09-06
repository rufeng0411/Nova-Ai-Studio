/**
 * PD-SAAS-FORK: deep tenant isolation via per-request `pilotHome`.
 *
 * The SaaS edge this guards: two tenants register the *same* real project
 * path (e.g. both add `D:\workspaces\0608`). The gateway keys transcript
 * directories off `createProjectId(projectRoot)`, so a shared path alone
 * would collapse both tenants into one `chats/` dir. By routing each
 * tenant's reads/writes through its own `pilotHome`, the transcript dir
 * becomes `<tenantHome>/projects/<id>/chats` and the two tenants never see
 * each other's sessions even on an identical project path.
 *
 * Single-user behaviour is unchanged: callers that omit the override keep
 * using the one global home, which this test also exercises implicitly by
 * comparing same-path/different-home outcomes.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { getPilotProjectChatDir } from "../../src/pilot/index.js";
import { listProjectSessions } from "../../src/session/index.js";
import { readWebSessionMessages } from "../../src/web/server/readSessionMessages.js";

function acceptedInputLine(sessionId: string, text: string): string {
  return JSON.stringify({
    type: "accepted_input",
    sessionId,
    turnId: "t1",
    sequence: 1,
    createdAt: "2026-06-08T00:00:00.000Z",
    entryId: "e-1",
    messages: [{ role: "user", content: [{ type: "text", text }] }],
  });
}

async function seedSession(
  projectRoot: string,
  pilotHome: string,
  sessionId: string,
  text: string,
): Promise<void> {
  const chatDir = getPilotProjectChatDir(projectRoot, pilotHome);
  await mkdir(chatDir, { recursive: true });
  await writeFile(join(chatDir, `${sessionId}.jsonl`), `${acceptedInputLine(sessionId, text)}\n`, "utf8");
}

test("two tenants on the same real project path do not share sessions", async () => {
  const base = await mkdtemp(join(tmpdir(), "pilotdeck-deep-iso-"));
  const tenantAHome = join(base, "tenants", "alice");
  const tenantBHome = join(base, "tenants", "bob");
  // The collision case: both tenants registered the identical external path.
  const sharedProject = join(base, "external", "workspaces-0608");

  await seedSession(sharedProject, tenantAHome, "web-s_alpha", "alice-only secret");
  await seedSession(sharedProject, tenantBHome, "web-s_beta", "bob-only secret");

  const aliceSessions = await listProjectSessions({
    projectRoot: sharedProject,
    pilotHome: tenantAHome,
  });
  const bobSessions = await listProjectSessions({
    projectRoot: sharedProject,
    pilotHome: tenantBHome,
  });

  assert.deepEqual(
    aliceSessions.map((s) => s.sessionId),
    ["web-s_alpha"],
    "alice sees only her own session under her home",
  );
  assert.deepEqual(
    bobSessions.map((s) => s.sessionId),
    ["web-s_beta"],
    "bob sees only his own session under his home",
  );
});

test("reading a sibling tenant's sessionKey under the wrong home yields nothing", async () => {
  const base = await mkdtemp(join(tmpdir(), "pilotdeck-deep-iso-read-"));
  const tenantAHome = join(base, "tenants", "alice");
  const tenantBHome = join(base, "tenants", "bob");
  const sharedProject = join(base, "external", "workspaces-0608");

  await seedSession(sharedProject, tenantAHome, "web-s_alpha", "alice-only secret");

  // Bob requests Alice's sessionKey but his own home resolves the transcript
  // dir — the file simply is not there, so no content leaks.
  const leaked = await readWebSessionMessages(
    { sessionKey: "web-s_alpha", projectKey: sharedProject },
    { projectRoot: sharedProject, pilotHome: tenantBHome },
  );
  assert.equal(leaked.messages.length, 0, "bob cannot read alice's transcript via the same path");

  // Alice's own home resolves and returns the content.
  const own = await readWebSessionMessages(
    { sessionKey: "web-s_alpha", projectKey: sharedProject },
    { projectRoot: sharedProject, pilotHome: tenantAHome },
  );
  assert.ok(own.messages.length > 0, "alice reads her own transcript under her home");
});
