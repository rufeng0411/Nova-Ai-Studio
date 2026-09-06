import { describe, expect, it } from "vitest";
import { canEnableImChannels, resolveImChannelsFlag } from "./flags.js";

describe("IM channels flags", () => {
  it("defaults to off", () => {
    expect(resolveImChannelsFlag({})).toBe("off");
    expect(canEnableImChannels({})).toBe(false);
  });

  it("allows shadow and enforce", () => {
    expect(canEnableImChannels({ PILOTDECK_IM_CHANNELS: "shadow" })).toBe(true);
    expect(canEnableImChannels({ PILOTDECK_IM_CHANNELS: "enforce" })).toBe(true);
  });
});
