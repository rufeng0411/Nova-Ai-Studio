import { describe, expect, it } from "vitest";
import { searchDiscoveryTesting } from "./searchDiscovery.js";

describe("searchDiscovery", () => {
  it("parses murl entries from Bing image HTML", () => {
    const html = `
      {"murl":"https:\\/\\/img.example.com\\/g700-front.jpg"}
      {"murl":"https:\\/\\/img.example.com\\/g700-interior.png"}
    `;
    const urls = searchDiscoveryTesting.extractBingImageUrls(html);
    expect(urls).toContain("https://img.example.com/g700-front.jpg");
    expect(urls).toContain("https://img.example.com/g700-interior.png");
  });

  it("builds subject queries from templates", () => {
    expect(
      searchDiscoveryTesting.fillQuery("{subject} site:chery.cn", "纵横 G700"),
    ).toBe("纵横 G700 site:chery.cn");
  });
});
