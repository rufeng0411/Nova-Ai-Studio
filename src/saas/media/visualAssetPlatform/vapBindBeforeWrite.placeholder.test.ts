import { describe, expect, it } from "vitest";
import { shouldBlockPlaceholderWhenAssetsExist } from "./vapBindBeforeWrite.js";

describe("shouldBlockPlaceholderWhenAssetsExist", () => {
  it("blocks placeholder when assets exist", () => {
    expect(
      shouldBlockPlaceholderWhenAssetsExist({
        filePath: "assets/placeholder-beijing.svg",
        assetCount: 2,
      }),
    ).toBe(true);
  });

  it("allows when no assets", () => {
    expect(
      shouldBlockPlaceholderWhenAssetsExist({
        filePath: "assets/placeholder-beijing.svg",
        assetCount: 0,
      }),
    ).toBe(false);
  });
});
