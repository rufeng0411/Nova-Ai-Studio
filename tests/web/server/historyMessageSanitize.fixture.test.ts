import test from "node:test";
import assert from "node:assert/strict";

import {
  estimateSanitizedPayloadBytes,
  sanitizeNormalizedHistoryMessage,
} from "../../../src/web/server/historyMessageSanitize.js";

/**
 * Phase 0 baseline — expects sanitize implementation (red before Phase 1).
 */
const TWO_MB = "z".repeat(2 * 1024 * 1024);

test("fixture-shaped 2MB Normalized tool_result payload under 500KB after sanitize", () => {
  const normalized = {
    id: "fixture-tr",
    sessionId: "web-s_large_write_fixture",
    timestamp: "2026-06-20T00:00:00.000Z",
    provider: "pilotdeck",
    kind: "tool_result",
    toolId: "tool-write-1",
    content: `Wrote artifacts/demo/large-page.html\n${TWO_MB}`,
    writtenFilePath: "artifacts/demo/large-page.html",
    isError: false,
  };

  const sanitized = sanitizeNormalizedHistoryMessage(normalized);
  const bytes = estimateSanitizedPayloadBytes([sanitized]);
  assert.ok(bytes < 500 * 1024, `baseline expects <500KB, got ${Math.round(bytes / 1024)}KB`);
});
