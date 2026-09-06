import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { getPilotProjectChatDir } from "../../../src/pilot/index.js";
import {
  readWebSessionMessages,
  sliceWebMessages,
} from "../../../src/web/server/readSessionMessages.js";
import type { WebMessage } from "../../../src/web/client/webMessage.js";

const SESSION_ID = "web-s_pagination_test";

function acceptedInput(sequence: number, text: string, turnId = `t-${sequence}`): string {
  return JSON.stringify({
    type: "accepted_input",
    sessionId: SESSION_ID,
    turnId,
    sequence,
    createdAt: `2026-06-09T00:00:${String(sequence).padStart(2, "0")}.000Z`,
    entryId: `e-${sequence}`,
    messages: [{ role: "user", content: [{ type: "text", text }] }],
  });
}

function syntheticAcceptedInput(sequence: number, text: string, turnId = `t-${sequence}`): string {
  return JSON.stringify({
    type: "accepted_input",
    sessionId: SESSION_ID,
    turnId,
    sequence,
    createdAt: `2026-06-09T00:00:${String(sequence).padStart(2, "0")}.000Z`,
    entryId: `e-synthetic-${sequence}`,
    messages: [{
      role: "user",
      content: [{ type: "text", text }],
      metadata: { synthetic: true, purpose: "acceptance_repair" },
    }],
  });
}

function assistantToolCall(sequence: number, turnId: string): string {
  return JSON.stringify({
    type: "assistant_message",
    sessionId: SESSION_ID,
    turnId,
    sequence,
    createdAt: `2026-06-09T00:01:${String(sequence).padStart(2, "0")}.000Z`,
    entryId: `e-a-${sequence}`,
    message: {
      role: "assistant",
      content: [
        {
          type: "tool_call",
          id: `tool-${sequence}`,
          name: "read_file",
          input: { path: "foo.txt" },
        },
      ],
    },
  });
}

function assistantText(sequence: number, turnId: string, text: string): string {
  return JSON.stringify({
    type: "assistant_message",
    sessionId: SESSION_ID,
    turnId,
    sequence,
    createdAt: `2026-06-09T00:01:${String(sequence).padStart(2, "0")}.000Z`,
    entryId: `e-a-text-${sequence}`,
    message: {
      role: "assistant",
      content: [{ type: "text", text }],
    },
  });
}

function turnDeliverableMeta(sequence: number, turnId: string): string {
  return JSON.stringify({
    type: "turn_deliverable_meta",
    sessionId: SESSION_ID,
    turnId,
    sequence,
    createdAt: `2026-06-09T00:06:${String(sequence).padStart(2, "0")}.000Z`,
    entryId: `e-meta-${sequence}`,
    turnArtifactDir: "artifacts/campaign/demo",
    verifiedPaths: [
      "artifacts/campaign/demo/index.html",
      "artifacts/campaign/demo/brief.docx",
    ],
    alignmentStatus: "aligned",
  });
}

function taskDeliverableLedger(sequence: number, turnId: string): string {
  return JSON.stringify({
    type: "task_deliverable_ledger",
    sessionId: SESSION_ID,
    turnId,
    sequence,
    createdAt: `2026-06-09T00:07:${String(sequence).padStart(2, "0")}.000Z`,
    entryId: `e-ledger-${sequence}`,
    record: {
      taskId: "task-ledger",
      sessionId: SESSION_ID,
      turnId,
      tenantId: "default",
      workspaceRoot: "F:/Ai-pilotdeck/.saas-dev-data/tenants/default/cloud-storage/users/1/workspaces/w1",
      goalVersion: 1,
      apiPath: "index.html",
      resolvedPath: "artifacts/campaign/ledger/index.html",
      hintDir: "artifacts/campaign/ledger",
      turnArtifactDir: "artifacts/campaign/ledger",
      basename: "index.html",
      previewKind: "html",
      sizeBytes: 128,
      source: "tool",
      validationStatus: "verified",
      displayRole: "primary",
      acceptanceRole: "required",
      resolvedBy: "ledger",
    },
  });
}

function toolResult(sequence: number, turnId: string): string {
  return JSON.stringify({
    type: "tool_result_message",
    sessionId: SESSION_ID,
    turnId,
    sequence,
    createdAt: `2026-06-09T00:02:${String(sequence).padStart(2, "0")}.000Z`,
    entryId: `e-r-${sequence}`,
    message: {
      role: "user",
      content: [
        {
          type: "tool_result",
          toolCallId: `tool-${sequence}`,
          isError: false,
          content: [{ type: "text", text: `result-${sequence}` }],
        },
      ],
    },
  });
}

function compactBoundary(sequence: number): string {
  return JSON.stringify({
    type: "control_boundary",
    sessionId: SESSION_ID,
    turnId: `t-compact-${sequence}`,
    sequence,
    createdAt: `2026-06-09T00:03:${String(sequence).padStart(2, "0")}.000Z`,
    entryId: `e-c-${sequence}`,
    boundary: { kind: "compact", subtype: "compact_boundary", compactMetadata: { trigger: "manual" } },
  });
}

function successTurn(sequence: number, turnId: string): string {
  return JSON.stringify({
    type: "turn_result",
    sessionId: SESSION_ID,
    turnId,
    sequence,
    createdAt: `2026-06-09T00:05:${String(sequence).padStart(2, "0")}.000Z`,
    entryId: `e-ok-${sequence}`,
    result: { type: "success", stopReason: "end_turn" },
  });
}

function errorTurn(sequence: number, turnId: string): string {
  return JSON.stringify({
    type: "turn_result",
    sessionId: SESSION_ID,
    turnId,
    sequence,
    createdAt: `2026-06-09T00:04:${String(sequence).padStart(2, "0")}.000Z`,
    entryId: `e-err-${sequence}`,
    result: {
      type: "error",
      stopReason: "tool_error",
      errors: [{ message: "tool failed" }],
    },
  });
}

async function seedTranscript(
  projectRoot: string,
  pilotHome: string,
  lines: string[],
): Promise<void> {
  const chatDir = getPilotProjectChatDir(projectRoot, pilotHome);
  await mkdir(chatDir, { recursive: true });
  await writeFile(join(chatDir, `${SESSION_ID}.jsonl`), `${lines.join("\n")}\n`, "utf8");
}

function makeMessages(count: number): WebMessage[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `m-${index}`,
    sessionKey: SESSION_ID,
    createdAt: `2026-06-09T00:00:${String(index).padStart(2, "0")}.000Z`,
    provider: "pilotdeck" as const,
    role: "user" as const,
    kind: "text" as const,
    text: `msg-${index}`,
    source: "history" as const,
  }));
}

test("sliceWebMessages backward first page returns tail N in chronological order", () => {
  const all = makeMessages(200);
  const result = sliceWebMessages(all, { direction: "backward", limit: 100 });
  assert.equal(result.total, 200);
  assert.equal(result.messages.length, 100);
  assert.equal(result.messages[0]?.id, "m-100");
  assert.equal(result.messages[99]?.id, "m-199");
  assert.equal(result.nextCursor, "100");
  assert.equal(result.startIndex, 100);
});

test("sliceWebMessages backward second page is contiguous with first", () => {
  const all = makeMessages(200);
  const first = sliceWebMessages(all, { direction: "backward", limit: 100 });
  const second = sliceWebMessages(all, { direction: "backward", limit: 100, cursor: first.nextCursor });
  assert.equal(second.messages.length, 100);
  assert.equal(second.messages[0]?.id, "m-0");
  assert.equal(second.messages[99]?.id, "m-99");
  assert.equal(second.nextCursor, undefined);
  assert.deepEqual(
    [...second.messages, ...first.messages].map((m) => m.id),
    all.map((m) => m.id),
  );
});

test("sliceWebMessages forward preserves legacy offset semantics", () => {
  const all = makeMessages(50);
  const page1 = sliceWebMessages(all, { direction: "forward", limit: 20 });
  assert.equal(page1.messages[0]?.id, "m-0");
  assert.equal(page1.nextCursor, "20");
  const page2 = sliceWebMessages(all, { direction: "forward", limit: 20, cursor: page1.nextCursor });
  assert.equal(page2.messages[0]?.id, "m-20");
  assert.equal(page2.nextCursor, "40");
});

test("sliceWebMessages omitting limit returns full transcript", () => {
  const all = makeMessages(12);
  const result = sliceWebMessages(all, { direction: "backward" });
  assert.equal(result.messages.length, 12);
  assert.equal(result.nextCursor, undefined);
});

test("sliceWebMessages backward when total <= limit returns all without nextCursor", () => {
  const all = makeMessages(30);
  const result = sliceWebMessages(all, { direction: "backward", limit: 100 });
  assert.equal(result.messages.length, 30);
  assert.equal(result.nextCursor, undefined);
  assert.equal(result.startIndex, 0);
});

test("sliceWebMessages backward empty session", () => {
  const result = sliceWebMessages([], { direction: "backward", limit: 50 });
  assert.equal(result.messages.length, 0);
  assert.equal(result.total, 0);
  assert.equal(result.nextCursor, undefined);
});

test("readWebSessionMessages backward pages a multi-turn transcript", async () => {
  const base = await mkdtemp(join(tmpdir(), "pilotdeck-pagination-"));
  const pilotHome = join(base, "home");
  const projectRoot = join(base, "project");
  const lines: string[] = [];
  for (let i = 1; i <= 25; i += 1) {
    lines.push(acceptedInput(i, `user-${i}`));
  }
  await seedTranscript(projectRoot, pilotHome, lines);

  const first = await readWebSessionMessages(
    { sessionKey: SESSION_ID, projectKey: projectRoot, limit: 10, direction: "backward" },
    { projectRoot, pilotHome },
  );
  assert.equal(first.total, 25);
  assert.equal(first.messages.length, 10);
  assert.equal(first.messages[0]?.text, "user-16");
  assert.equal(first.messages[9]?.text, "user-25");
  assert.equal(first.nextCursor, "15");

  const second = await readWebSessionMessages(
    {
      sessionKey: SESSION_ID,
      projectKey: projectRoot,
      limit: 10,
      direction: "backward",
      cursor: first.nextCursor,
    },
    { projectRoot, pilotHome },
  );
  assert.equal(second.messages.length, 10);
  assert.equal(second.messages[0]?.text, "user-6");
  assert.equal(second.nextCursor, "5");

  const third = await readWebSessionMessages(
    {
      sessionKey: SESSION_ID,
      projectKey: projectRoot,
      limit: 10,
      direction: "backward",
      cursor: second.nextCursor,
    },
    { projectRoot, pilotHome },
  );
  assert.equal(third.messages.length, 5);
  assert.equal(third.messages[0]?.text, "user-1");
  assert.equal(third.nextCursor, undefined);
});

test("readWebSessionMessages forward without limit still returns full transcript", async () => {
  const base = await mkdtemp(join(tmpdir(), "pilotdeck-pagination-full-"));
  const pilotHome = join(base, "home");
  const projectRoot = join(base, "project");
  await seedTranscript(projectRoot, pilotHome, [
    acceptedInput(1, "one"),
    acceptedInput(2, "two"),
    acceptedInput(3, "three"),
  ]);

  const full = await readWebSessionMessages(
    { sessionKey: SESSION_ID, projectKey: projectRoot },
    { projectRoot, pilotHome },
  );
  assert.equal(full.messages.length, 3);
  assert.equal(full.total, 3);

  const forward = await readWebSessionMessages(
    { sessionKey: SESSION_ID, projectKey: projectRoot, limit: 2, direction: "forward" },
    { projectRoot, pilotHome },
  );
  assert.equal(forward.messages.length, 2);
  assert.equal(forward.messages[0]?.text, "one");
  assert.equal(forward.nextCursor, "2");
});

test("readWebSessionMessages includes tool and compact boundary rows in backward pages", async () => {
  const base = await mkdtemp(join(tmpdir(), "pilotdeck-pagination-rich-"));
  const pilotHome = join(base, "home");
  const projectRoot = join(base, "project");
  await seedTranscript(projectRoot, pilotHome, [
    acceptedInput(1, "archived", "t0"),
    successTurn(2, "t0"),
    compactBoundary(3),
    acceptedInput(4, "before", "t1"),
    successTurn(5, "t1"),
    assistantToolCall(6, "t2"),
    toolResult(7, "t2"),
    successTurn(8, "t2"),
    acceptedInput(9, "after", "t3"),
    successTurn(10, "t3"),
    errorTurn(11, "t4"),
  ]);

  const page = await readWebSessionMessages(
    { sessionKey: SESSION_ID, projectKey: projectRoot, limit: 10, direction: "backward" },
    { projectRoot, pilotHome },
  );
  const kinds = page.messages.map((m) => m.kind);
  assert.ok(kinds.includes("text"));
  assert.ok(kinds.includes("tool_use"));
  assert.ok(kinds.includes("tool_result"));
  assert.ok(kinds.includes("compact_boundary"));
  assert.ok(kinds.includes("error"));
});

test("readWebSessionMessages hides synthetic acceptance repair user prompts", async () => {
  const base = await mkdtemp(join(tmpdir(), "pilotdeck-synthetic-repair-"));
  const pilotHome = join(base, "home");
  const projectRoot = join(base, "project");
  await seedTranscript(projectRoot, pilotHome, [
    acceptedInput(1, "帮雷蛇做 GEO 全案", "t1"),
    assistantText(2, "t1", "我会继续补齐。"),
    syntheticAcceptedInput(3, "最终交付验收未通过。请补齐 drafts/zhihu.md。", "t1"),
    assistantText(4, "t1", "已补齐最终成果。"),
    successTurn(5, "t1"),
  ]);

  const page = await readWebSessionMessages(
    { sessionKey: SESSION_ID, projectKey: projectRoot, limit: 10, direction: "backward" },
    { projectRoot, pilotHome },
  );

  assert.deepEqual(
    page.messages.filter((message) => message.role === "user").map((message) => message.text),
    ["帮雷蛇做 GEO 全案"],
  );
  assert.equal(page.messages.some((message) => message.text?.includes("最终交付验收未通过")), false);
});

test("readWebSessionMessages attaches deliverable meta to historical text messages", async () => {
  const base = await mkdtemp(join(tmpdir(), "pilotdeck-meta-"));
  const pilotHome = join(base, "home");
  const projectRoot = join(base, "project");
  const turnId = "t-meta";
  await seedTranscript(projectRoot, pilotHome, [
    acceptedInput(1, "做一个 campaign 全案", turnId),
    assistantText(2, turnId, "我来检查并补齐文件。"),
    successTurn(3, turnId),
    turnDeliverableMeta(4, turnId),
  ]);

  const result = await readWebSessionMessages(
    { sessionKey: SESSION_ID, projectKey: projectRoot, limit: 10, direction: "backward" },
    { projectRoot, pilotHome },
  );
  const assistant = result.messages.find((message) => message.role === "assistant" && message.kind === "text");
  assert.deepEqual(assistant?.payload, {
    turnId,
    turnArtifactDir: "artifacts/campaign/demo",
    verifiedDeliverablePaths: [
      "artifacts/campaign/demo/index.html",
      "artifacts/campaign/demo/brief.docx",
    ],
    turnDeliverableUnrecoverable: false,
  });
});

test("readWebSessionMessages prefers task deliverable ledger over legacy meta", async () => {
  const base = await mkdtemp(join(tmpdir(), "pilotdeck-ledger-meta-"));
  const pilotHome = join(base, "home");
  const projectRoot = join(base, "project");
  const turnId = "t-ledger";
  await seedTranscript(projectRoot, pilotHome, [
    acceptedInput(1, "做一个 campaign 全案", turnId),
    assistantText(2, turnId, "已检查成果。"),
    successTurn(3, turnId),
    turnDeliverableMeta(4, turnId),
    taskDeliverableLedger(5, turnId),
  ]);

  const result = await readWebSessionMessages(
    { sessionKey: SESSION_ID, projectKey: projectRoot, limit: 10, direction: "backward" },
    { projectRoot, pilotHome },
  );
  const assistant = result.messages.find((message) => message.role === "assistant" && message.kind === "text");
  assert.deepEqual(assistant?.payload, {
    turnId,
    turnArtifactDir: "artifacts/campaign/ledger",
    verifiedDeliverablePaths: [
      "artifacts/campaign/ledger/index.html",
    ],
    turnDeliverableUnrecoverable: false,
  });
});

test("readWebSessionMessages tail-read preserves first user on dense multi-entry transcript", async () => {
  const base = await mkdtemp(join(tmpdir(), "pilotdeck-dense-first-user-"));
  const pilotHome = join(base, "home");
  const projectRoot = join(base, "project");
  const lines: string[] = [
    acceptedInput(1, "帮【吴裕泰】做 AI 搜索可见度标准包，直接开始做"),
  ];
  for (let i = 2; i <= 550; i += 1) {
    const turnId = `t-${Math.floor(i / 3)}`;
    if (i % 3 === 1) {
      lines.push(successTurn(i, turnId));
    } else if (i % 3 === 2) {
      lines.push(assistantToolCall(i, turnId));
    } else {
      lines.push(toolResult(i, turnId));
    }
  }
  await seedTranscript(projectRoot, pilotHome, lines);

  process.env.PILOTDECK_HISTORY_TAIL_READ = "1";
  let page = await readWebSessionMessages(
    { sessionKey: SESSION_ID, projectKey: projectRoot, limit: 120, direction: "backward" },
    { projectRoot, pilotHome },
  );
  delete process.env.PILOTDECK_HISTORY_TAIL_READ;

  const collectUserTexts = (messages: typeof page.messages) =>
    messages
      .filter((message) => message.role === "user" && message.kind === "text")
      .map((message) => message.text ?? "");

  let userTexts = collectUserTexts(page.messages);
  let guard = 0;
  while (page.nextCursor && guard < 20) {
    process.env.PILOTDECK_HISTORY_TAIL_READ = "1";
    page = await readWebSessionMessages(
      {
        sessionKey: SESSION_ID,
        projectKey: projectRoot,
        limit: 120,
        direction: "backward",
        cursor: page.nextCursor,
      },
      { projectRoot, pilotHome },
    );
    delete process.env.PILOTDECK_HISTORY_TAIL_READ;
    userTexts = [...collectUserTexts(page.messages), ...userTexts];
    guard += 1;
  }

  assert.ok(
    userTexts.some((text) => text.includes("吴裕泰")),
    "first user goal must survive tail-read on dense jsonl",
  );
  assert.equal(userTexts[0]?.includes("吴裕泰"), true, "pagination must reach the first user bubble");
});

test("readWebSessionMessages tail-read backward matches full-read tail page", async () => {
  const base = await mkdtemp(join(tmpdir(), "pilotdeck-pagination-tail-"));
  const pilotHome = join(base, "home");
  const projectRoot = join(base, "project");
  const lines: string[] = [];
  for (let i = 1; i <= 25; i += 1) {
    lines.push(acceptedInput(i, `user-${i}`));
  }
  await seedTranscript(projectRoot, pilotHome, lines);

  process.env.PILOTDECK_HISTORY_TAIL_READ = "0";
  const full = await readWebSessionMessages(
    { sessionKey: SESSION_ID, projectKey: projectRoot, limit: 10, direction: "backward" },
    { projectRoot, pilotHome },
  );

  process.env.PILOTDECK_HISTORY_TAIL_READ = "1";
  const tail = await readWebSessionMessages(
    { sessionKey: SESSION_ID, projectKey: projectRoot, limit: 10, direction: "backward" },
    { projectRoot, pilotHome },
  );
  delete process.env.PILOTDECK_HISTORY_TAIL_READ;

  assert.deepEqual(
    tail.messages.map((m) => m.text),
    full.messages.map((m) => m.text),
  );
  assert.equal(tail.messages.length, 10);
});
