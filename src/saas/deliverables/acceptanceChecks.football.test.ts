import { describe, expect, it } from "vitest";
import {
  assertFootballReportMetadataHints,
  assertSingleImageDeliverablePath,
} from "./acceptanceChecks.js";

describe("acceptanceChecks football P1", () => {
  it("rejects fake FIFA/Opta scores", () => {
    const failures = assertFootballReportMetadataHints(
      "阿根廷VS西班牙 预测报告",
      "<html>FIFA 官方评分 8.5</html>",
    );
    expect(failures.length).toBeGreaterThan(0);
  });

  it("requires image path for poster goal", () => {
    const failures = assertSingleImageDeliverablePath([], "9:16 海报 image-generation");
    expect(failures.some((f) => f.reason === "missing")).toBe(true);
  });
});
