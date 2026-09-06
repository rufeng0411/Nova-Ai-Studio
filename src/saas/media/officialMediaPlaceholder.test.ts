// PD-SAAS-FORK VAP: placeholder detection for quality counting.
import { describe, expect, it } from "vitest";
import {
  buildOfficialMediaPlaceholder,
  looksLikeVisualPlaceholder,
} from "./officialMediaPlaceholder.js";

describe("looksLikeVisualPlaceholder", () => {
  it("detects marked official placeholder content", () => {
    const placeholder = buildOfficialMediaPlaceholder({ label: "官方素材待补" });
    expect(looksLikeVisualPlaceholder({ textPreview: placeholder.content })).toBe(true);
  });

  it("detects unlabeled hero-placeholder.svg path", () => {
    expect(
      looksLikeVisualPlaceholder({
        path: "artifacts/task/assets/hero-placeholder.svg",
      }),
    ).toBe(true);
  });

  it("detects dashed SVG placeholder body", () => {
    expect(
      looksLikeVisualPlaceholder({
        textPreview: '<svg xmlns="http://www.w3.org/2000/svg"><rect stroke-dasharray="18 12"/></svg>',
      }),
    ).toBe(true);
  });
});
