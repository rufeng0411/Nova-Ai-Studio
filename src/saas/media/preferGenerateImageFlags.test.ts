import { describe, expect, it } from "vitest";
import {
  isPreferGenerateImageEnabled,
  isPreferGenerateImageEnforce,
  resolvePreferGenerateImageMode,
} from "./preferGenerateImageFlags.js";

describe("preferGenerateImageFlags", () => {
  it("defaults to shadow when unset", () => {
    expect(resolvePreferGenerateImageMode({})).toBe("shadow");
    expect(isPreferGenerateImageEnabled({})).toBe(true);
  });

  it("parses off aliases", () => {
    expect(resolvePreferGenerateImageMode({ PILOTDECK_PREFER_GENERATE_IMAGE: "off" })).toBe("off");
    expect(resolvePreferGenerateImageMode({ PILOTDECK_PREFER_GENERATE_IMAGE: "0" })).toBe("off");
    expect(isPreferGenerateImageEnabled({ PILOTDECK_PREFER_GENERATE_IMAGE: "false" })).toBe(false);
  });

  it("parses enforce aliases", () => {
    expect(resolvePreferGenerateImageMode({ PILOTDECK_PREFER_GENERATE_IMAGE: "enforce" })).toBe("enforce");
    expect(resolvePreferGenerateImageMode({ PILOTDECK_PREFER_GENERATE_IMAGE: "1" })).toBe("enforce");
    expect(isPreferGenerateImageEnforce({ PILOTDECK_PREFER_GENERATE_IMAGE: "on" })).toBe(true);
  });
});
