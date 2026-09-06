import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { CanonicalMessage } from "../../src/model/index.js";
import type { AgentTurnResult } from "../../src/agent/protocol/result.js";
import { ToolResultBudget } from "../../src/context/budget/ToolResultBudget.js";
import {
  canonicalizeUrlForModel,
  redactSensitiveUrl,
  sanitizeUrlsForPersistence,
} from "../../src/saas/security/urlRedaction.js";
import { JsonlTranscriptWriter } from "../../src/session/transcript/JsonlTranscriptWriter.js";
import { TelemetrySender } from "../../src/telemetry/sender.js";
import type { AnalyticsEvent } from "../../src/telemetry/types.js";
import {
  loadStabilityEvents,
  recordStabilityEvent,
} from "../../src/telemetry/stabilityEvents.js";

const SIGNED_URL =
  "https://user:password@cdn.example.com/media/hero.jpg?page=2&X-Amz-Credential=AKIA_TEST&X-Amz-Signature=very-secret&Expires=999999#fragment";

async function waitForFileContains(
  filePath: string,
  expected: string,
): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    try {
      const value = await readFile(filePath, "utf8");
      if (value.includes(expected)) return;
    } catch {
      // Fire-and-forget telemetry may not have created the file yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for ${expected}`);
}

test("URL redaction removes credentials and signing query while preserving safe query", () => {
  assert.equal(
    redactSensitiveUrl(SIGNED_URL),
    "https://cdn.example.com/media/hero.jpg?page=2#fragment",
  );
  assert.equal(
    canonicalizeUrlForModel(SIGNED_URL),
    "https://cdn.example.com/media/hero.jpg",
  );

  const nested = sanitizeUrlsForPersistence({
    error: `download failed for ${SIGNED_URL}`,
    result: [{ url: SIGNED_URL }],
  });
  const serialized = JSON.stringify(nested);
  assert.doesNotMatch(serialized, /password|AKIA_TEST|very-secret|X-Amz/iu);
  assert.match(serialized, /page=2/u);
});

test("durable tool calls, tool results, and turn errors are redacted before JSONL write", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pilotdeck-url-redaction-"));
  const transcriptPath = join(dir, "session.jsonl");
  try {
    const writer = new JsonlTranscriptWriter({ path: transcriptPath });
    const toolCall: CanonicalMessage = {
      role: "assistant",
      content: [{
        type: "tool_call",
        id: "call-1",
        name: "fetch_page_images",
        input: { url: SIGNED_URL },
        raw: { url: SIGNED_URL },
      }],
    };
    const toolResult: CanonicalMessage = {
      role: "user",
      content: [{
        type: "tool_result",
        toolCallId: "call-1",
        content: [{
          type: "text",
          text: `Fetched ${SIGNED_URL}`,
        }],
        raw: {
          type: "success",
          data: { url: SIGNED_URL },
        },
      }],
    };
    const result: AgentTurnResult = {
      type: "error",
      sessionId: "session-1",
      turnId: "turn-1",
      stopReason: "tool_error",
      usage: {},
      permissionDenials: [],
      turns: 1,
      startedAt: "2026-07-19T00:00:00.000Z",
      completedAt: "2026-07-19T00:00:01.000Z",
      errors: [{
        code: "agent_invalid_state",
        message: `Request failed: ${SIGNED_URL}`,
        details: { retryUrl: SIGNED_URL },
      }],
    };

    await writer.recordDurableMessage("session-1", "turn-1", toolCall);
    await writer.recordDurableMessage("session-1", "turn-1", toolResult);
    await writer.recordTurnResult("session-1", "turn-1", result);

    const persisted = await readFile(transcriptPath, "utf8");
    assert.doesNotMatch(
      persisted,
      /user:password|AKIA_TEST|very-secret|X-Amz-Credential|X-Amz-Signature/iu,
    );
    assert.match(
      persisted,
      /https:\\?\/\\?\/cdn\.example\.com\\?\/media\\?\/hero\.jpg\?page=2/iu,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("stability telemetry redacts signed URLs before writing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pilotdeck-url-telemetry-"));
  const logPath = join(dir, "stability.jsonl");
  const previous = process.env.PILOTDECK_STABILITY_LOG;
  process.env.PILOTDECK_STABILITY_LOG = logPath;
  try {
    recordStabilityEvent({
      event: "factual_premise_assessed",
      reason: `blocked ${SIGNED_URL}`,
      detail: { source: SIGNED_URL },
    });
    await waitForFileContains(logPath, "factual_premise_assessed");
    const raw = await readFile(logPath, "utf8");
    assert.doesNotMatch(raw, /password|AKIA_TEST|very-secret|X-Amz/iu);
    assert.match(raw, /page=2/u);

    const events = await loadStabilityEvents(logPath);
    assert.equal(events.length, 1);
  } finally {
    if (previous === undefined) {
      delete process.env.PILOTDECK_STABILITY_LOG;
    } else {
      process.env.PILOTDECK_STABILITY_LOG = previous;
    }
    await rm(dir, { recursive: true, force: true });
  }
});

test("oversized tool-result spill redacts signed URLs before writing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pilotdeck-url-spill-redaction-"));
  try {
    const budget = new ToolResultBudget({
      maxResultSizeChars: 16,
      previewBytes: 32,
      toolResultsDir: dir,
    });
    const message: CanonicalMessage = {
      role: "user",
      content: [{
        type: "tool_result",
        toolCallId: "call-signed-url",
        content: [{
          type: "text",
          text: `Fetched ${SIGNED_URL}`,
        }],
      }],
    };

    const budgeted = await budget.applyToMessage(message);
    const reference = budgeted.content[0];
    assert.equal(reference?.type, "tool_result_reference");
    if (reference?.type !== "tool_result_reference") {
      throw new Error("Expected oversized tool result to be persisted by reference.");
    }
    const persisted = await readFile(reference.path, "utf8");
    assert.doesNotMatch(persisted, /password|AKIA_TEST|very-secret|X-Amz/iu);
    assert.match(persisted, /page=2/u);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("generic telemetry queue redacts signed URLs before writing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pilotdeck-url-queue-redaction-"));
  const queueFilePath = join(dir, "telemetry-queue.jsonl");
  const event: AnalyticsEvent = {
    schemaVersion: "analytics.v2",
    eventId: "event-signed-url",
    eventName: "error_occurred",
    occurredAt: "2026-07-19T00:00:00.000Z",
    installationId: "installation-1",
    instanceId: "instance-1",
    deploymentMode: "source",
    commitHash: "test",
    appVersion: "test",
    platform: process.platform,
    properties: {
      message: `Request failed: ${SIGNED_URL}`,
      nested: { retryUrl: SIGNED_URL },
    },
  };
  const failedFetch: typeof fetch = async () => {
    throw new Error("offline");
  };

  try {
    const sender = new TelemetrySender({
      enabled: true,
      baseUrl: "https://telemetry.example.com",
      flushIntervalMs: 60_000,
      batchSize: 10,
      timeoutMs: 100,
      maxRetries: 1,
      maxQueueSize: 10,
      queueFilePath,
    }, {
      fetchImpl: failedFetch,
    });
    sender.enqueue(event);
    await sender.shutdown();

    const persisted = await readFile(queueFilePath, "utf8");
    assert.doesNotMatch(persisted, /password|AKIA_TEST|very-secret|X-Amz/iu);
    assert.match(persisted, /page=2/u);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
