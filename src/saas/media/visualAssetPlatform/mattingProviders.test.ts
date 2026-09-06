// PD-SAAS-FORK VAP P1-A: matting provider mock.
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { runMattingProvider } from "./mattingProviders.js";

describe("mattingProviders", () => {
  it("bbox fallback returns a png buffer", async () => {
    const input = await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite([{
        input: await sharp({
          create: {
            width: 20,
            height: 20,
            channels: 3,
            background: { r: 20, g: 20, b: 20 },
          },
        }).png().toBuffer(),
        left: 22,
        top: 22,
      }])
      .png()
      .toBuffer();

    const result = await runMattingProvider(input, "bbox");
    expect(result.provider).toBe("bbox");
    expect(result.degraded).toBe(true);
    expect(result.buffer.length).toBeGreaterThan(0);
  });

  it("auto falls back to bbox when rembg URL absent", async () => {
    delete process.env.PILOTDECK_REMBG_URL;
    const input = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: { r: 10, g: 10, b: 10 },
      },
    }).png().toBuffer();
    const result = await runMattingProvider(input, "auto");
    expect(result.provider).toBe("bbox");
  });
});
