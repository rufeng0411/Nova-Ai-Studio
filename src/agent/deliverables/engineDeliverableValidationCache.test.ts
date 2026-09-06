import { describe, expect, it } from "vitest";
import type { CanonicalMessage } from "../../model/index.js";
import {
  buildTurnValidationCacheKey,
  countDeliverableWriteOps,
  lookupTurnValidationCache,
  storeTurnValidationCache,
} from "./engineDeliverableValidationCache.js";
import type { EngineDeliverableValidation } from "./validateDeliverablesEngine.js";

describe("engineDeliverableValidationCache", () => {
  it("counts write_file tool calls", () => {
    const messages: CanonicalMessage[] = [{
      role: "assistant",
      content: [{
        type: "tool_call",
        id: "1",
        name: "write_file",
        input: {},
      }],
    }];
    expect(countDeliverableWriteOps(messages)).toBe(1);
  });

  it("reuses cache when write ops and manifest unchanged", () => {
    const messages: CanonicalMessage[] = [];
    const key = buildTurnValidationCacheKey({ messages, sessionManifest: undefined });
    const result = {
      verified: [],
      missing: ["a.md"],
      broken: [],
      failures: [],
      acceptance: "needs_repair",
    } satisfies EngineDeliverableValidation;
    const entry = storeTurnValidationCache(key, result);
    expect(lookupTurnValidationCache(entry, key)).toEqual(result);
    expect(lookupTurnValidationCache(entry, {
      ...key,
      writeOpsCount: 1,
    })).toBeNull();
    expect(lookupTurnValidationCache(entry, {
      ...key,
      goalVersion: 2,
    })).toBeNull();
  });
});
