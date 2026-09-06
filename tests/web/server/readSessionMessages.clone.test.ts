import test from "node:test";
import assert from "node:assert/strict";

import { flattenCanonicalMessage } from "../../../src/web/server/readSessionMessages.js";
import type { CanonicalMessage } from "../../../src/model/index.js";

const SESSION_KEY = "web-s_clone";

function sampleMessage(text: string): CanonicalMessage {
  return {
    role: "user",
    content: [{ type: "text", text }],
  };
}

test("flattenCanonicalMessage stable across structured clone path", () => {
  const message = sampleMessage("hello clone");
  const flattenedA = flattenCanonicalMessage(message, {
    index: 0,
    sessionKey: SESSION_KEY,
    entryTimestamp: "2026-06-20T00:00:00.000Z",
  });
  const flattenedB = flattenCanonicalMessage(
    typeof structuredClone === "function" ? structuredClone(message) : JSON.parse(JSON.stringify(message)),
    {
      index: 0,
      sessionKey: SESSION_KEY,
      entryTimestamp: "2026-06-20T00:00:00.000Z",
    },
  );
  assert.equal(flattenedA.length, flattenedB.length);
  assert.equal(flattenedA[0]?.text, flattenedB[0]?.text);
  assert.equal(flattenedA[0]?.kind, "text");
});
