import { describe, expect, it } from "vitest";
import {
  isSpeechApiReady,
  isTtsApiReady,
  isVideoApiReady,
  isWondaReady,
} from "./mediaRuntimeProbe.js";

describe("mediaRuntimeProbe", () => {
  it("detects video API when dashscope key and model are set", () => {
    expect(
      isVideoApiReady({
        DASHSCOPE_API_KEY: "sk-test",
        PILOTDECK_VIDEO_MODEL: "happyhorse-1.0-t2v",
      }),
    ).toBe(true);
  });

  it("detects tts and speech from dashscope key", () => {
    const env = { DASHSCOPE_API_KEY: "sk-test" };
    expect(isTtsApiReady(env)).toBe(true);
    expect(isSpeechApiReady(env)).toBe(true);
  });

  it("detects wonda from bridge env names", () => {
    expect(isWondaReady({ WONDA_API_KEY: "sk_wonda" })).toBe(true);
    expect(isWondaReady({ PILOTDECK_SKILL_WONDA_API_KEY: "sk_wonda" })).toBe(true);
  });
});
