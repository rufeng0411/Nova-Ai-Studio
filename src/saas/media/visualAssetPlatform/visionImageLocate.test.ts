import { describe, expect, it } from "vitest";
import { parseImageUrlsFromVisionText } from "./visionImageLocate.js";

describe("visionImageLocate", () => {
  it("ignores description-only output", () => {
    expect(
      parseImageUrlsFromVisionText("页面上有一张好看的轮胎产品图"),
    ).toEqual([]);
  });

  it("extracts https image urls", () => {
    const urls = parseImageUrlsFromVisionText(
      '{"imageUrls":["https://cdn.example.com/a.jpg","http://evil.local/x.png"]}',
    );
    expect(urls).toEqual(["https://cdn.example.com/a.jpg"]);
  });
});
