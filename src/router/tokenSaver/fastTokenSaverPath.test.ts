import { describe, expect, it } from "vitest";
import type { CanonicalMessage } from "../../model/index.js";
import {
  resolveFastTokenSaverDecision,
  shouldUseNonBlockingTokenSaver,
} from "./fastTokenSaverPath.js";

const config = {
  enabled: true,
  judge: { id: "openai/gpt-4.1-mini", provider: "openai", model: "gpt-4.1-mini" },
  defaultTier: "medium",
  judgeTimeoutMs: 3000,
  tiers: {
    simple: { model: { id: "openai/gpt-4.1-mini", provider: "openai", model: "gpt-4.1-mini" } },
    medium: { model: { id: "openai/gpt-4.1", provider: "openai", model: "gpt-4.1" } },
    complex: { model: { id: "openai/gpt-4.1", provider: "openai", model: "gpt-4.1" } },
    reasoning: { model: { id: "openai/o3", provider: "openai", model: "o3" } },
  },
};

describe("fastTokenSaverPath", () => {
  it("uses non-blocking path for main agent turns", () => {
    expect(
      shouldUseNonBlockingTokenSaver({
        isMainAgent: true,
        messages: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
        orchestrating: false,
        customRouterActive: false,
      }),
    ).toBe(true);
  });

  it("routes short messages to simple tier", () => {
    const messages: CanonicalMessage[] = [
      { role: "user", content: [{ type: "text", text: "hi" }] },
    ];
    const decision = resolveFastTokenSaverDecision(config, messages);
    expect(decision.tier).toBe("simple");
  });

  it("falls back to default tier for long messages", () => {
    const messages: CanonicalMessage[] = [
      { role: "user", content: [{ type: "text", text: "x".repeat(400) }] },
    ];
    const decision = resolveFastTokenSaverDecision(config, messages);
    expect(decision.tier).toBe("medium");
  });
});
