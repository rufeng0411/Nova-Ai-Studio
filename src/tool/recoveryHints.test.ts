import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendToolRecoveryHint } from "./recoveryHints.js";

describe("appendToolRecoveryHint generate_image", () => {
  const prevPrefer = process.env.PILOTDECK_PREFER_GENERATE_IMAGE;

  beforeEach(() => {
    process.env.PILOTDECK_PREFER_GENERATE_IMAGE = "shadow";
  });

  afterEach(() => {
    if (prevPrefer == null) delete process.env.PILOTDECK_PREFER_GENERATE_IMAGE;
    else process.env.PILOTDECK_PREFER_GENERATE_IMAGE = prevPrefer;
  });

  it("does not push SVG-first recovery on billing hard-fail", () => {
    const out = appendToolRecoveryHint(
      "generate_image",
      "tool_execution_failed",
      "Provider Arrearage: account overdue-payment for Imagen",
    );
    expect(out).toContain("authentication or billing");
    expect(out).not.toContain("inline SVG placeholder");
  });

  it("does not push SVG-first recovery on auth hard-fail", () => {
    const out = appendToolRecoveryHint(
      "generate_image",
      "tool_execution_failed",
      "401 unauthorized: invalid API key",
    );
    expect(out).toContain("authentication or billing");
    expect(out).not.toContain("inline SVG placeholder");
  });

  it("uses creative enforce recovery when prefer-generate is enforce", () => {
    process.env.PILOTDECK_PREFER_GENERATE_IMAGE = "enforce";
    const out = appendToolRecoveryHint(
      "generate_image",
      "tool_execution_failed",
      "transient network timeout",
    );
    expect(out).toContain("creative hero");
    expect(out).not.toContain("inline SVG placeholder");
  });
});
