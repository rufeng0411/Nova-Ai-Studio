import { describe, expect, it, beforeEach } from "vitest";
import {
  extractImagesViaCrawlerSidecar,
  setVapCrawlerClientForTests,
} from "./client.js";
import { resetSidecarCircuitForTests } from "./circuit.js";

describe("crawlerSidecar client", () => {
  beforeEach(() => {
    resetSidecarCircuitForTests();
    setVapCrawlerClientForTests(null);
    process.env.PILOTDECK_VAP_CRAWLER_SIDECAR = "off";
  });

  it("skips when sidecar off", async () => {
    const result = await extractImagesViaCrawlerSidecar({
      url: "https://example.com/",
    });
    expect(result.skipped).toBe(true);
    expect(result.imageUrls).toEqual([]);
  });

  it("returns images from injected client", async () => {
    process.env.PILOTDECK_VAP_CRAWLER_SIDECAR = "anycrawl";
    setVapCrawlerClientForTests({
      async extractImages() {
        return {
          imageUrls: ["https://cdn.example.com/p.jpg"],
        };
      },
    });
    const result = await extractImagesViaCrawlerSidecar({
      url: "https://example.com/p",
    });
    expect(result.imageUrls).toEqual(["https://cdn.example.com/p.jpg"]);
  });
});
