import { describe, expect, it } from "vitest";
import {
  extractSourceUrlsFromGoal,
  sanitizeUrlFromText,
} from "./urlSanitize.js";

describe("urlSanitize", () => {
  it("strips trailing CJK punctuation glued to URLs", () => {
    expect(
      sanitizeUrlFromText(
        "https://zongheng.chery.cn/vehicle/g700-refit，图和资料要来自官网",
      ),
    ).toBe("https://zongheng.chery.cn/vehicle/g700-refit");
  });

  it("extracts clean URLs from mixed goal text", () => {
    const urls = extractSourceUrlsFromGoal(
      "用官网素材：https://zongheng.chery.cn/vehicle/g700-refit，做 8 页幻灯",
    );
    expect(urls).toEqual(["https://zongheng.chery.cn/vehicle/g700-refit"]);
  });
});
