import { describe, expect, it } from "vitest";
import { resolveMediaStrategy } from "./mediaStrategyResolver.js";

const envVideoReady = {
  DASHSCOPE_API_KEY: "sk-test",
  PILOTDECK_VIDEO_MODEL: "happyhorse-1.0-t2v",
  PILOTDECK_TTS_API_KEY: "sk-test",
  PILOTDECK_SPEECH_API_KEY: "sk-test",
};

const envImagePrefer = {
  GOOGLE_API_KEY: "AIza-test",
  PILOTDECK_PREFER_GENERATE_IMAGE: "shadow",
};

describe("mediaStrategyResolver", () => {
  it("prefers official_fetch for landing pages with official imagery", () => {
    expect(resolveMediaStrategy("做南美旅游官方摄影风落地页，用官网产品图。")).toBe("official_fetch");
  });

  it("prefers export_document for pptx/pdf deliverables", () => {
    expect(resolveMediaStrategy("导出 8 页 PPTX 报告。")).toBe("export_document");
  });

  it("prefers generate_video when api ready and user wants mp4", () => {
    expect(resolveMediaStrategy("生成 15 秒产品宣传 mp4", undefined, envVideoReady)).toBe("generate_video");
  });

  it("prefers generate_video for 10秒广告视频 goal pattern", () => {
    expect(resolveMediaStrategy("小罐茶冷泡茶10秒广告视频", undefined, envVideoReady)).toBe("generate_video");
  });

  it("prefers render_html_video for remotion engineering goals", () => {
    expect(resolveMediaStrategy("用 Remotion 做可编辑工程", undefined, envVideoReady)).toBe(
      "render_html_video",
    );
  });

  it("prefers generate_speech for narration goals", () => {
    expect(resolveMediaStrategy("给文案配中文旁白", undefined, envVideoReady)).toBe("generate_speech");
  });

  it("routes creative poster HTML to generate_image when prefer flag on and image ready", () => {
    expect(
      resolveMediaStrategy("做一张科技风活动海报 HTML", undefined, envImagePrefer),
    ).toBe("generate_image");
  });

  it("does not force official_fetch for landing slug without official imagery", () => {
    expect(
      resolveMediaStrategy("做一个简洁产品介绍落地页", "od-saas-landing", envImagePrefer),
    ).toBe("generate_image");
  });

  it("keeps official_fetch for explicit official product imagery", () => {
    expect(
      resolveMediaStrategy("做南美旅游官方摄影风落地页，用官网产品图。", "od-saas-landing", envImagePrefer),
    ).toBe("official_fetch");
  });

  it("does not force generate_image for OKR pages", () => {
    expect(
      resolveMediaStrategy("做团队 OKR 跟踪页", "od-team-okrs", envImagePrefer),
    ).toBe("default");
  });
});
