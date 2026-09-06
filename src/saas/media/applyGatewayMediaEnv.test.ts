import { describe, expect, it } from "vitest";
import { applyGatewayMediaEnv } from "./applyGatewayMediaEnv.js";

describe("applyGatewayMediaEnv", () => {
  it("injects dashscope + video env from tools.video snapshot", () => {
    const env: NodeJS.ProcessEnv = {};
    applyGatewayMediaEnv(env, {
      video: {
        provider: "qwen",
        apiKey: "sk-test-video",
        model: "happyhorse-1.0-t2v",
        baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      },
    });

    expect(env.PILOTDECK_MEDIA_STRATEGY_RESOLVER).toBe("1");
    expect(env.PILOTDECK_PREFER_GENERATE_IMAGE).toBe("shadow");
    expect(env.DASHSCOPE_API_KEY).toBe("sk-test-video");
    expect(env.PILOTDECK_VIDEO_API_KEY).toBe("sk-test-video");
    expect(env.PILOTDECK_VIDEO_PROVIDER).toBe("qwen");
    expect(env.PILOTDECK_VIDEO_MODEL).toBe("happyhorse-1.0-t2v");
    expect(env.PILOTDECK_VIDEO_BASE_URL).toBe(
      "https://dashscope.aliyuncs.com/compatible-mode/v1",
    );
  });

  it("falls back to credential env when tools.video is empty", () => {
    const env: NodeJS.ProcessEnv = {};
    const credentialEnv: NodeJS.ProcessEnv = {
      DASHSCOPE_API_KEY: "sk-fallback",
      PILOTDECK_VIDEO_MODEL: "wanx2.1-t2v-turbo",
    };
    applyGatewayMediaEnv(env, {}, credentialEnv);

    expect(env.PILOTDECK_MEDIA_STRATEGY_RESOLVER).toBe("1");
    expect(env.PILOTDECK_PREFER_GENERATE_IMAGE).toBe("shadow");
    expect(env.DASHSCOPE_API_KEY).toBe("sk-fallback");
    expect(env.PILOTDECK_VIDEO_MODEL).toBe("wanx2.1-t2v-turbo");
  });

  it("preserves explicit PILOTDECK_PREFER_GENERATE_IMAGE from credential env", () => {
    const env: NodeJS.ProcessEnv = {};
    applyGatewayMediaEnv(env, {}, { PILOTDECK_PREFER_GENERATE_IMAGE: "off" });
    expect(env.PILOTDECK_PREFER_GENERATE_IMAGE).toBe("off");
  });
});
