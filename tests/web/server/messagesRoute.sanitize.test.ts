import test from "node:test";
import assert from "node:assert/strict";

import { isHistorySanitizeEnabled } from "../../../src/web/server/historyReadFlags.js";
import {
  sanitizeHistoryMessages,
  sanitizeNormalizedHistoryMessage,
} from "../../../src/web/server/historyMessageSanitize.js";

test("sanitize flag respects explicit env override", () => {
  process.env.PILOTDECK_HISTORY_SANITIZE = "0";
  assert.equal(isHistorySanitizeEnabled(), false);
  process.env.PILOTDECK_HISTORY_SANITIZE = "1";
  assert.equal(isHistorySanitizeEnabled(), true);
  delete process.env.PILOTDECK_HISTORY_SANITIZE;
});

test("disk and gateway paths share identical sanitize output", () => {
  const sample = [{
    id: "m1",
    kind: "tool_result",
    content: "x".repeat(50_000),
    writtenFilePath: "artifacts/demo/out.html",
  }];
  const gw = sanitizeHistoryMessages(sample);
  const disk = sanitizeHistoryMessages(sample);
  assert.deepEqual(gw, disk);
  assert.ok(JSON.stringify(gw).length < JSON.stringify(sample).length);
});

test("mapWebMessageToNormalized + sanitize preserves writtenFilePath field", () => {
  const sanitized = sanitizeNormalizedHistoryMessage({
    id: "tr",
    kind: "tool_result",
    content: `Saved artifacts/demo/out.html\n${"h".repeat(100_000)}`,
  });
  assert.equal(sanitized.writtenFilePath, "artifacts/demo/out.html");
});
