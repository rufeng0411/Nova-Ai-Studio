import { describe, expect, it } from "vitest";
import { semanticSlotLabel, isRawKindLabel } from "./sdmSlotLabels.js";

describe("sdmSlotLabels", () => {
  it("uses path stem for raw kind labels", () => {
    expect(
      semanticSlotLabel({ label: "markdown", kind: "markdown", pathHint: "jl3-world-opinion-deep-dive.md" }),
    ).toBe("jl3 world opinion deep dive");
  });

  it("maps kind to semantic Chinese label when no path", () => {
    expect(semanticSlotLabel({ kind: "html" })).toBe("HTML 网页");
  });

  it("preserves non-raw user labels", () => {
    expect(semanticSlotLabel({ label: "传播 brief", pathHint: "brief.md" })).toBe("传播 brief");
  });

  it("detects raw kind labels", () => {
    expect(isRawKindLabel("markdown")).toBe(true);
    expect(isRawKindLabel("调研报告")).toBe(false);
  });
});
