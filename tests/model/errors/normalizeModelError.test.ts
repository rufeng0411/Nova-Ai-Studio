import test from "node:test";
import assert from "node:assert/strict";

import { normalizeModelError } from "../../../src/model/errors/normalizeModelError.js";

test("normalizeModelError marks DashScope invalid content as image-strip recoverable", () => {
  const error = normalizeModelError(
    "qwen",
    "openai",
    {
      error: {
        message: "InternalError.Algo.InvalidParameter: The provided messages input is invalid. The error info is [Unexpected item type in content.].",
      },
    },
    400,
  );

  assert.equal(error.recoverableViaImageStrip, true);
});

test("normalizeModelError marks fetch failed as retryable for router fallback", () => {
  const error = normalizeModelError("qwen", "openai", new TypeError("fetch failed"));
  assert.equal(error.retryable, true);
  assert.match(error.message, /fetch failed/i);
});
