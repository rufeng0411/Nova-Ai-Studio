import { describe, expect, it } from "vitest";
import { shouldSkipMemoryRetrievalForTurn } from "../../src/context/DefaultContextRuntime.js";
import type { CanonicalMessage } from "../../src/model/index.js";

describe("shouldSkipMemoryRetrievalForTurn", () => {
  it("skips memory on first user-only turn", () => {
    const messages: CanonicalMessage[] = [
      { role: "user", content: [{ type: "text", text: "hello" }] },
    ];
    expect(shouldSkipMemoryRetrievalForTurn(messages)).toBe(true);
  });

  it("runs memory after prior assistant reply", () => {
    const messages: CanonicalMessage[] = [
      { role: "user", content: [{ type: "text", text: "hello" }] },
      { role: "assistant", content: [{ type: "text", text: "hi" }] },
      { role: "user", content: [{ type: "text", text: "continue" }] },
    ];
    expect(shouldSkipMemoryRetrievalForTurn(messages)).toBe(false);
  });

  it("ignores synthetic assistant messages", () => {
    const messages: CanonicalMessage[] = [
      { role: "user", content: [{ type: "text", text: "hello" }] },
      {
        role: "assistant",
        content: [{ type: "text", text: "recovery" }],
        metadata: { synthetic: true },
      },
    ];
    expect(shouldSkipMemoryRetrievalForTurn(messages)).toBe(true);
  });
});
