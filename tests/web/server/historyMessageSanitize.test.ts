import test from "node:test";
import assert from "node:assert/strict";

import {
  estimateSanitizedPayloadBytes,
  sanitizeHistoryMessages,
  sanitizeNormalizedHistoryMessage,
} from "../../../src/web/server/historyMessageSanitize.js";

const TWO_MB = "y".repeat(2 * 1024 * 1024);
const TARGET = "artifacts/demo/large-page.html";

function buildLargeToolResult() {
  return {
    id: "tr-1",
    sessionId: "web-s_test",
    timestamp: "2026-06-20T00:00:00.000Z",
    provider: "pilotdeck",
    kind: "tool_result",
    toolId: "tool-1",
    content: `Wrote ${TARGET}\n${TWO_MB}`,
    isError: false,
  };
}

test("2MB tool_result sanitizes below 500KB", () => {
  process.env.PILOTDECK_HISTORY_SANITIZE = "1";
  const sanitized = sanitizeNormalizedHistoryMessage(buildLargeToolResult());
  const bytes = estimateSanitizedPayloadBytes([sanitized]);
  assert.ok(bytes < 500 * 1024, `expected <500KB, got ${Math.round(bytes / 1024)}KB`);
  assert.equal(sanitized.writtenFilePath, TARGET);
  assert.equal(sanitized.historyTruncated, true);
});

test("12KB boundary keeps content within preview limit", () => {
  const body = "a".repeat(20_000);
  const sanitized = sanitizeNormalizedHistoryMessage({
    id: "tr-2",
    kind: "tool_result",
    content: body,
  });
  assert.ok(String(sanitized.content).length < 20_000);
  assert.equal(sanitized.historyTruncated, true);
});

test("writtenFilePath preserved from giant text", () => {
  const sanitized = sanitizeNormalizedHistoryMessage(buildLargeToolResult());
  assert.equal(sanitized.writtenFilePath, TARGET);
});

test("base64 toolResultImages stripped from history", () => {
  const sanitized = sanitizeNormalizedHistoryMessage({
    id: "tr-3",
    kind: "tool_result",
    content: "ok",
    toolResultImages: [{ data: "data:image/png;base64,AAAA", mimeType: "image/png" }],
    images: ["data:image/png;base64,BBBB"],
  });
  assert.equal(sanitized.toolResultImages, undefined);
  assert.equal(sanitized.images, undefined);
});

test("permission_request messages are not truncated", () => {
  const long = "p".repeat(100_000);
  const sanitized = sanitizeNormalizedHistoryMessage({
    id: "pr-1",
    kind: "permission_request",
    input: { preview: long },
  });
  assert.deepEqual(sanitized.input, { preview: long });
  assert.notEqual(sanitized.historyTruncated, true);
});

test("tool_use path fields remain intact while large html is truncated", () => {
  const sanitized = sanitizeNormalizedHistoryMessage({
    id: "tu-1",
    kind: "tool_use",
    toolInput: {
      file_path: "artifacts/demo/page.html",
      html: "h".repeat(50_000),
    },
  }) as { toolInput: Record<string, unknown>; historyTruncated?: boolean };
  assert.equal(sanitized.toolInput.file_path, "artifacts/demo/page.html");
  assert.ok(String(sanitized.toolInput.html).length < 50_000);
  assert.equal(sanitized.historyTruncated, true);
});

test("sanitizeHistoryMessages batch preserves order", () => {
  const out = sanitizeHistoryMessages([
    { id: "1", kind: "text", content: "hello" },
    buildLargeToolResult(),
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0]?.content, "hello");
});
