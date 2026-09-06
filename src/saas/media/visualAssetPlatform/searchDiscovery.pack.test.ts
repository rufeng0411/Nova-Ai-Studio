import { afterEach, describe, expect, it } from "vitest";

import {
  isAutomotiveSubject,
  resetSearchDiscoveryConfigCacheForTests,
  resolveSearchQueriesForGoal,
  selectSearchPackForGoal,
} from "./searchDiscovery.js";

describe("searchDiscovery pack selection", () => {
  afterEach(() => {
    delete process.env.PILOTDECK_VAP_QUERY_PACK;
    resetSearchDiscoveryConfigCacheForTests();
  });

  it("selects generic pack for non-automotive subjects like paddle board", () => {
    expect(selectSearchPackForGoal("浆板", "户外桨板产品宣传")).toBe("generic");
    expect(isAutomotiveSubject("浆板", "户外桨板产品宣传")).toBe(false);
  });

  it("uses generic web queries without chery.cn for KM3 tire subject", async () => {
    const resolved = await resolveSearchQueriesForGoal(
      "KM3 轮胎",
      "越野轮胎产品图",
    );
    expect(resolved.pack).toBe("generic");
    expect(resolved.webQueries.join(" ")).not.toMatch(/chery\.cn/iu);
    expect(resolved.imageQueries.join(" ")).not.toMatch(/autohome\.com\.cn/iu);
    expect(resolved.trustedHosts).not.toContain("chery.cn");
    expect(resolved.webQueries.some((query) => query.includes("官网"))).toBe(
      true,
    );
  });

  it("uses auto pack for explicit automotive goals", async () => {
    const resolved = await resolveSearchQueriesForGoal(
      "纵横 G700",
      "汽车之家官方外观图",
    );
    expect(resolved.pack).toBe("auto");
    expect(resolved.webQueries.join(" ")).toMatch(/chery\.cn|汽车之家/iu);
    expect(resolved.trustedHosts).toContain("autohome.com.cn");
  });

  it("forces generic pack when PILOTDECK_VAP_QUERY_PACK=generic", async () => {
    process.env.PILOTDECK_VAP_QUERY_PACK = "generic";
    const resolved = await resolveSearchQueriesForGoal(
      "纵横 G700",
      "汽车之家官方外观图",
    );
    expect(resolved.pack).toBe("generic");
    expect(resolved.webQueries.join(" ")).not.toMatch(/chery\.cn/iu);
  });
});
