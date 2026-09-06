import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  resolveContentQualityCanaryPolicy,
  shouldEnforceContentQualityChecks,
} from "./contentQualityCanaryPolicy.js";

describe("contentQualityCanaryPolicy", () => {
  beforeEach(() => {
    process.env.PILOTDECK_CONTENT_QUALITY_V2 = "enforce";
    process.env.PILOTDECK_QUALITY_CANARY_SLUGS =
      "nova-research-product-user,nova-ppt-aesthetic-slides";
    process.env.PILOTDECK_QUALITY_CANARY_TENANTS = "tenant-default";
  });

  afterEach(() => {
    delete process.env.PILOTDECK_CONTENT_QUALITY_V2;
    delete process.env.PILOTDECK_QUALITY_CANARY_SLUGS;
    delete process.env.PILOTDECK_QUALITY_CANARY_TENANTS;
  });

  it("selects exact capability slugs for content quality enforcement", () => {
    const selected = resolveContentQualityCanaryPolicy({
      capabilitySlug: "nova-research-product-user",
      trustedScope: {
        tenantScopeId: "tenant-default",
        principalScopeId: "user-1",
      },
    });
    expect(selected.selected).toBe(true);
    expect(shouldEnforceContentQualityChecks(selected)).toBe(true);

    const skipped = resolveContentQualityCanaryPolicy({
      capabilitySlug: "nova-research-general",
      trustedScope: {
        tenantScopeId: "tenant-default",
        principalScopeId: "user-1",
      },
    });
    expect(skipped.selected).toBe(false);
  });
});
