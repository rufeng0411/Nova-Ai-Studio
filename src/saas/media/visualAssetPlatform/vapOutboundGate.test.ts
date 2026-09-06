import { afterEach, describe, expect, it } from "vitest";

import {
  coerceMinWidth,
  isVapDirectImageUrlEnabled,
  isVapDiscoverParallelEnabled,
  isVapOfficialFirstEnabled,
  resetVapOutboundGateForTests,
  resolveVapOutboundMax,
} from "./vapOutboundGate.js";

describe("vapOutboundGate", () => {
  const envKeys = [
    "PILOTDECK_VAP_OUTBOUND_MAX",
    "PILOTDECK_VAP_OFFICIAL_FIRST",
    "PILOTDECK_VAP_DISCOVER_PARALLEL",
    "PILOTDECK_VAP_DIRECT_IMAGE_URL",
  ] as const;

  const originalEnv: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
    resetVapOutboundGateForTests();
  });

  it("resolveVapOutboundMax defaults to 4 and clamps to 1-8", () => {
    delete process.env.PILOTDECK_VAP_OUTBOUND_MAX;
    expect(resolveVapOutboundMax()).toBe(4);

    process.env.PILOTDECK_VAP_OUTBOUND_MAX = "0";
    expect(resolveVapOutboundMax()).toBe(1);

    process.env.PILOTDECK_VAP_OUTBOUND_MAX = "99";
    expect(resolveVapOutboundMax()).toBe(8);

    process.env.PILOTDECK_VAP_OUTBOUND_MAX = "6";
    expect(resolveVapOutboundMax()).toBe(6);
  });

  it("feature flags default true and honor 0/false", () => {
    delete process.env.PILOTDECK_VAP_OFFICIAL_FIRST;
    delete process.env.PILOTDECK_VAP_DISCOVER_PARALLEL;
    delete process.env.PILOTDECK_VAP_DIRECT_IMAGE_URL;

    expect(isVapOfficialFirstEnabled()).toBe(true);
    expect(isVapDiscoverParallelEnabled()).toBe(true);
    expect(isVapDirectImageUrlEnabled()).toBe(true);

    process.env.PILOTDECK_VAP_OFFICIAL_FIRST = "0";
    process.env.PILOTDECK_VAP_DISCOVER_PARALLEL = "false";
    process.env.PILOTDECK_VAP_DIRECT_IMAGE_URL = "FALSE";

    expect(isVapOfficialFirstEnabled()).toBe(false);
    expect(isVapDiscoverParallelEnabled()).toBe(false);
    expect(isVapDirectImageUrlEnabled()).toBe(false);
  });

  it("coerceMinWidth parses numbers and falls back safely", () => {
    expect(coerceMinWidth(640)).toBe(640);
    expect(coerceMinWidth("512")).toBe(512);
    expect(coerceMinWidth("bad", 400)).toBe(400);
    expect(coerceMinWidth(-1, 400)).toBe(400);
    expect(coerceMinWidth(undefined, 350)).toBe(350);
  });
});
