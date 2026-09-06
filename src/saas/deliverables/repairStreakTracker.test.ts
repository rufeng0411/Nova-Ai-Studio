import { describe, expect, it } from "vitest";
import {
  advanceRepairStreak,
  buildSdmGapKey,
  normalizeRepairGapKey,
  shouldFastStopRepairLoop,
} from "./repairStreakTracker.js";

describe("repairStreakTracker", () => {
  it("RS-01: same SDM gap key streak reaches fast stop", () => {
    const key = buildSdmGapKey(["pivot_html_2"]);
    let state = { lastNormalizedGap: null as string | null, streak: 0 };
    state = advanceRepairStreak(state, [], [], key);
    expect(state.streak).toBe(1);
    state = advanceRepairStreak(state, [], [], key);
    expect(shouldFastStopRepairLoop(state.streak)).toBe(true);
  });

  it("RS-02: SDM gap key stable when missing paths jitter", () => {
    const sdmKey = buildSdmGapKey(["profile_geo_platform", "profile_geo_6"]);
    expect(normalizeRepairGapKey(["artifacts/missing-a.md"], [], sdmKey)).toBe(`sdm:${sdmKey}`);
    expect(normalizeRepairGapKey(["artifacts/missing-b.html"], [], sdmKey)).toBe(`sdm:${sdmKey}`);
    expect(normalizeRepairGapKey(["artifacts/missing.md"], [])).toBe("artifacts/missing.md");
  });
});
