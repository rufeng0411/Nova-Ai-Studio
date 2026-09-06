import { describe, expect, it } from "vitest";
import {
  isTransientToolRetryable,
  TRANSIENT_TOOL_RETRY_ATTEMPTS,
} from "./transientToolRetry.js";

describe("isTransientToolRetryable", () => {
  it("retries read-only tool_timeout", () => {
    expect(isTransientToolRetryable("tool_timeout", "timed out", { isReadOnly: true })).toBe(true);
    expect(isTransientToolRetryable("tool_timeout", "timed out", { isReadOnly: false })).toBe(false);
  });

  it("retries read-only transient network tool_execution_failed", () => {
    expect(
      isTransientToolRetryable("tool_execution_failed", "fetch failed: ECONNRESET", { isReadOnly: true }),
    ).toBe(true);
    expect(
      isTransientToolRetryable("tool_execution_failed", "fetch failed: ECONNRESET", { isReadOnly: false }),
    ).toBe(false);
  });

  it("does not retry permission or validation errors", () => {
    expect(isTransientToolRetryable("permission_denied", "denied", { isReadOnly: true })).toBe(false);
    expect(isTransientToolRetryable("invalid_tool_input", "bad input", { isReadOnly: true })).toBe(false);
  });

  it("exposes a single silent retry attempt", () => {
    expect(TRANSIENT_TOOL_RETRY_ATTEMPTS).toBe(1);
  });
});
