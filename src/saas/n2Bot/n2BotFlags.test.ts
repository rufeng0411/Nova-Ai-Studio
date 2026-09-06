import { describe, expect, it } from "vitest";
import {
  isN2BotMode,
  isN2BotSession,
  isStewardChatQueueExempt,
  resolveN2BotModeFromEnv,
  shouldSkipDeliverableContract,
} from "./n2BotFlags.js";

describe("n2BotFlags fail-closed", () => {
  it("A1 missing / illegal / throws → off", () => {
    expect(isN2BotMode(undefined)).toBe("off");
    expect(isN2BotMode("")).toBe("off");
    expect(isN2BotMode("nope")).toBe("off");
    expect(isN2BotMode("SHADOW")).toBe("shadow");
    expect(isN2BotMode("enforce")).toBe("enforce");
    expect(resolveN2BotModeFromEnv({})).toBe("off");
    expect(resolveN2BotModeFromEnv({ PILOTDECK_JARVIS_BUTLER: "shadow" })).toBe("shadow");
    expect(resolveN2BotModeFromEnv({ PILOTDECK_N2_BOT: "off" })).toBe("off");
  });

  it("only explicit n2_bot skips contract", () => {
    expect(shouldSkipDeliverableContract(undefined)).toBe(false);
    expect(shouldSkipDeliverableContract(null)).toBe(false);
    expect(shouldSkipDeliverableContract("background_task")).toBe(false);
    expect(shouldSkipDeliverableContract("n2_bot")).toBe(true);
    expect(isN2BotSession("n2_bot")).toBe(true);
    expect(isN2BotSession("background_task")).toBe(false);
  });

  it("A6 steward T0-T2 exempt; worker and T3 not", () => {
    expect(isStewardChatQueueExempt({ sessionKind: "n2_bot", options: { n2BotTier: "T0" } })).toBe(true);
    expect(isStewardChatQueueExempt({ sessionKind: "n2_bot", options: { n2BotTier: "T2" } })).toBe(true);
    expect(isStewardChatQueueExempt({ sessionKind: "n2_bot", options: { n2BotTier: "T3" } })).toBe(false);
    expect(isStewardChatQueueExempt({ sessionKind: undefined })).toBe(false);
    expect(isStewardChatQueueExempt({ options: { sessionKind: "n2_bot" } })).toBe(true);
  });
});
