import test from "node:test";
import assert from "node:assert/strict";

import { isFallbackEligible } from "../../src/router/fallback/runFallbackChain.js";

test("isFallbackEligible allows fallback on fetch failed provider errors", () => {
  assert.equal(
    isFallbackEligible({
      provider: "qwen",
      protocol: "openai",
      code: "provider_error",
      message: "fetch failed",
      retryable: false,
      raw: {},
    }),
    true,
  );
});

test("isFallbackEligible respects non-retryable auth errors", () => {
  assert.equal(
    isFallbackEligible({
      provider: "qwen",
      protocol: "openai",
      code: "auth_error",
      message: "invalid api key",
      retryable: false,
      raw: {},
    }),
    false,
  );
});
