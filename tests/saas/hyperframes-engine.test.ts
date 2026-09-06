// PD-SAAS-FORK: HyperFrames engine unit tests (L1)
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  parseHyperframesEngineMode,
  isHyperframesVideoSlug,
  goalExplicitlyWantsHyperframes,
} from "../../src/saas/media/hyperframesEngineFlags.js";
import {
  tryAcquireHyperframesRenderSlot,
  getHyperframesRenderActiveCount,
} from "../../src/saas/media/hyperframesRenderGate.js";
import { resolveMediaStrategy } from "../../src/saas/media/mediaStrategyResolver.js";
import { buildCapabilityBindingAppendPrompt } from "../../src/saas/capabilityBindingPrompt.js";
import { resolveProfile } from "../../src/saas/deliverableCapabilityProfiles.js";
import { createRenderHyperframesTool } from "../../src/tool/builtin/renderHyperframes.js";

describe("hyperframesEngineFlags", () => {
  it("parses engine modes", () => {
    expect(parseHyperframesEngineMode("enforce")).toBe("enforce");
    expect(parseHyperframesEngineMode("shadow")).toBe("shadow");
    expect(parseHyperframesEngineMode("0")).toBe("off");
  });

  it("detects hyperframes video slugs", () => {
    expect(isHyperframesVideoSlug("hf-hyperframes")).toBe(true);
    expect(isHyperframesVideoSlug("hf-slideshow")).toBe(false);
    expect(isHyperframesVideoSlug("tool-generate-video")).toBe(false);
  });

  it("detects explicit hyperframes goals", () => {
    expect(goalExplicitlyWantsHyperframes("用 HyperFrames 做 10 秒片头")).toBe(true);
    expect(goalExplicitlyWantsHyperframes("10秒广告视频")).toBe(false);
  });
});

describe("hyperframesRenderGate", () => {
  const prev = process.env.PILOTDECK_HYPERFRAMES_MAX_CONCURRENT;
  beforeEach(() => {
    process.env.PILOTDECK_HYPERFRAMES_MAX_CONCURRENT = "1";
  });
  afterEach(() => {
    if (prev == null) delete process.env.PILOTDECK_HYPERFRAMES_MAX_CONCURRENT;
    else process.env.PILOTDECK_HYPERFRAMES_MAX_CONCURRENT = prev;
  });

  it("allows one concurrent render", () => {
    const lease = tryAcquireHyperframesRenderSlot();
    expect(lease).not.toBeNull();
    expect(getHyperframesRenderActiveCount()).toBe(1);
    expect(tryAcquireHyperframesRenderSlot()).toBeNull();
    lease?.release();
    expect(getHyperframesRenderActiveCount()).toBe(0);
  });
});

describe("mediaStrategyResolver hyperframes", () => {
  const prevEngine = process.env.PILOTDECK_HYPERFRAMES_ENGINE;
  const prevResolver = process.env.PILOTDECK_MEDIA_STRATEGY_RESOLVER;
  beforeEach(() => {
    process.env.PILOTDECK_HYPERFRAMES_ENGINE = "enforce";
    process.env.PILOTDECK_MEDIA_STRATEGY_RESOLVER = "1";
  });
  afterEach(() => {
    if (prevEngine == null) delete process.env.PILOTDECK_HYPERFRAMES_ENGINE;
    else process.env.PILOTDECK_HYPERFRAMES_ENGINE = prevEngine;
    if (prevResolver == null) delete process.env.PILOTDECK_MEDIA_STRATEGY_RESOLVER;
    else process.env.PILOTDECK_MEDIA_STRATEGY_RESOLVER = prevResolver;
  });

  it("routes hf-hyperframes to hyperframes strategy", () => {
    expect(resolveMediaStrategy("做 10 秒片头", "hf-hyperframes")).toBe("hyperframes");
  });

  it("does not hijack generic mp4 goals", () => {
    expect(resolveMediaStrategy("10秒广告视频", undefined, { PILOTDECK_VIDEO_API_READY: "1" })).toBe("generate_video");
  });
});

describe("capability binding", () => {
  const prevEngine = process.env.PILOTDECK_HYPERFRAMES_ENGINE;
  beforeEach(() => {
    process.env.PILOTDECK_HYPERFRAMES_ENGINE = "enforce";
  });
  afterEach(() => {
    if (prevEngine == null) delete process.env.PILOTDECK_HYPERFRAMES_ENGINE;
    else process.env.PILOTDECK_HYPERFRAMES_ENGINE = prevEngine;
  });

  it("includes render_hyperframes in hf binding", () => {
    const prompt = buildCapabilityBindingAppendPrompt({ slug: "hf-hyperframes", displayName: "HTML 代码做视频" });
    expect(prompt).toContain("render_hyperframes");
    expect(prompt).toContain("禁止首轮 generate_video");
  });
});

describe("deliverable profiles", () => {
  it("binds hf slug to hyperframes profile", () => {
    const profile = resolveProfile("hf-product-launch-video", "marketing", "产品发布视频");
    expect(profile.id).toBe("hyperframes");
  });

  it("slideshow uses separate profile", () => {
    const profile = resolveProfile("hf-slideshow", "marketing", "幻灯工程");
    expect(profile.id).toBe("hyperframes-slideshow");
  });
});

describe("render_hyperframes tool", () => {
  it("registers tool definition", () => {
    const tool = createRenderHyperframesTool();
    expect(tool.name).toBe("render_hyperframes");
    expect(tool.isConcurrencySafe()).toBe(false);
  });
});
