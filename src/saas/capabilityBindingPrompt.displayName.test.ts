// PD-SAAS-FORK P0-I: slug-only capabilityContext must not throw.
import { describe, expect, it } from "vitest";
import { buildCapabilityBindingAppendPrompt } from "./capabilityBindingPrompt.js";

describe("capabilityBindingPrompt displayName fallback", () => {
  it("accepts slug-only context from CLI harness", () => {
    const text = buildCapabilityBindingAppendPrompt({
      slug: "nova-ppt-aesthetic-slides",
    });
    expect(text.length).toBeGreaterThan(20);
    expect(text).toContain("nova-ppt-aesthetic-slides");
  });

  it("includes VAP-first official order for official_only", () => {
    const text = buildCapabilityBindingAppendPrompt(
      { slug: "nova-ppt-aesthetic-slides", displayName: "Nova美学幻灯" },
      { officialMediaPolicy: "official_only", allowPlaceholders: false },
    );
    expect(text).toContain("resolve_session_visual_assets");
    expect(text).toContain("needs_repair");
  });
});
