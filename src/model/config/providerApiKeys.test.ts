import { describe, expect, it } from "vitest";
import {
  MAX_PROVIDER_API_KEYS,
  normalizeProviderApiKeySlots,
  isApiKeyRotationEligible,
} from "./providerApiKeys.js";

describe("normalizeProviderApiKeySlots", () => {
  it("merges primary and backup keys up to four slots", () => {
    expect(
      normalizeProviderApiKeySlots({
        apiKey: "k1",
        apiKeys: ["k2", "k3", "k4", "k5"],
      }),
    ).toEqual(["k1", "k2", "k3", "k4"]);
  });

  it("dedupes keys preserving order", () => {
    expect(
      normalizeProviderApiKeySlots({
        apiKey: "k1",
        apiKeys: ["k1", "k2"],
      }),
    ).toEqual(["k1", "k2"]);
  });

  it("respects max key count", () => {
    expect(MAX_PROVIDER_API_KEYS).toBe(4);
  });
});

describe("isApiKeyRotationEligible", () => {
  it("accepts auth and rate-limit failures", () => {
    expect(isApiKeyRotationEligible(401, "unauthorized")).toBe(true);
    expect(isApiKeyRotationEligible(429, "rate_limit_exceeded")).toBe(true);
    expect(isApiKeyRotationEligible(500, "internal_error")).toBe(false);
  });

  it("accepts DashScope arrearage so backup apiKeys can rotate", () => {
    expect(isApiKeyRotationEligible(400, "Arrearage")).toBe(true);
    expect(
      isApiKeyRotationEligible(
        400,
        "provider_error",
        "Access denied, please make sure your account is in good standing.",
      ),
    ).toBe(true);
  });
});
