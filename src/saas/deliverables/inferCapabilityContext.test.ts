import { afterEach, describe, expect, it } from "vitest";
import {
  inferCapabilityContextFromUserText,
  resolveInferredCapabilityForTurn,
  shouldSkipCapabilityInference,
} from "./inferCapabilityContext.js";

describe("inferCapabilityContext", () => {
  const prev = process.env.PILOTDECK_INFER_CAPABILITY_CONTEXT;

  afterEach(() => {
    if (prev == null) delete process.env.PILOTDECK_INFER_CAPABILITY_CONTEXT;
    else process.env.PILOTDECK_INFER_CAPABILITY_CONTEXT = prev;
  });

  it("skips greeting and continue", () => {
    expect(shouldSkipCapabilityInference("你好啊")).toBe(true);
    expect(shouldSkipCapabilityInference("继续")).toBe(true);
    expect(inferCapabilityContextFromUserText("你好啊")).toBeNull();
  });

  it("infers od-saas-landing from high-confidence landing text", () => {
    const inferred = inferCapabilityContextFromUserText(
      "为青盏交付获客官网单页，使用能力「官网落地页」。须交付：index.html。",
    );
    expect(inferred?.slug).toBe("od-saas-landing");
    expect(inferred?.source).toBe("inferred");
  });

  it("infers social-creative-matrix", () => {
    const inferred = inferCapabilityContextFromUserText(
      "用 social-creative-matrix 做社媒创意矩阵",
    );
    expect(inferred?.slug).toBe("social-creative-matrix");
  });

  it("does not infer on vague chat", () => {
    expect(inferCapabilityContextFromUserText("帮我想想怎么卖茶")).toBeNull();
  });

  it("hub source is never overridden", () => {
    process.env.PILOTDECK_INFER_CAPABILITY_CONTEXT = "enforce";
    const result = resolveInferredCapabilityForTurn({
      userText: "为青盏交付获客官网单页，使用能力官网落地页。须交付：index.html。",
      existingSlug: "anth-pptx",
      existingSource: "hub",
    });
    expect(result.inferred?.slug).toBe("od-saas-landing");
    expect(result.apply).toBe(false);
  });

  it("shadow never applies", () => {
    process.env.PILOTDECK_INFER_CAPABILITY_CONTEXT = "shadow";
    const result = resolveInferredCapabilityForTurn({
      userText: "为青盏交付获客官网单页，使用能力官网落地页。须交付：index.html。",
    });
    expect(result.inferred?.slug).toBe("od-saas-landing");
    expect(result.apply).toBe(false);
  });

  it("enforce applies when unbound", () => {
    process.env.PILOTDECK_INFER_CAPABILITY_CONTEXT = "enforce";
    const result = resolveInferredCapabilityForTurn({
      userText: "为青盏交付获客官网单页，使用能力官网落地页。须交付：index.html。",
    });
    expect(result.apply).toBe(true);
    expect(result.inferred?.slug).toBe("od-saas-landing");
  });
});
