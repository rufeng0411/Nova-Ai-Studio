import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { selectN2ChipAttention } from "./selectN2ChipAttention.js";
import { stripToolsFromChatPayload, isForbiddenStewardAcceptTurn } from "./stewardChatGuard.js";

describe("selectN2ChipAttention", () => {
  it("needs_you from catalog quota, not extra poll", () => {
    expect(selectN2ChipAttention([
      { sessionId: "w1", executionStatus: "paused", issue: "quota" },
    ])).toBe("needs_you");
    expect(selectN2ChipAttention([
      { sessionId: "w1", executionStatus: "running" },
    ])).toBe("active");
    expect(selectN2ChipAttention([
      { sessionId: "s-n2", sessionKind: "n2_bot", executionStatus: "running" },
    ], "s-n2")).toBe("idle");
  });
});

describe("stewardChatGuard", () => {
  it("F7 strips tools array", () => {
    const next = stripToolsFromChatPayload({ tools: [{ name: "write_file" }], prompt: "hi" });
    expect(next.tools).toEqual([]);
    expect(next.acceptTurn).toBe(false);
    expect(next.sessionKind).toBe("n2_bot");
  });

  it("forbids acceptTurn on steward session", () => {
    expect(isForbiddenStewardAcceptTurn("n2_bot")).toBe(true);
    expect(isForbiddenStewardAcceptTurn(undefined)).toBe(false);
  });

  it("K4 speak route has no_key fallback and tmpdir not task artifacts", () => {
    const src = readFileSync(new URL("../../../ui/server/saas/n2-bot/routes.js", import.meta.url), "utf8");
    expect(src).toContain("reason: 'no_key'");
    expect(src).toContain("os.tmpdir()");
    expect(src).toContain("longxiaochun");
    expect(src).not.toMatch(/artifacts\/task-\*/);
  });
});
