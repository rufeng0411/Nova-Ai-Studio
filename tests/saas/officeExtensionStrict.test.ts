import { describe, expect, it, beforeEach } from "vitest";

import {
  isFakeDocxPath,
  isPlaceholderVisualPath,
  officeExtensionPathSatisfiesSlot,
} from "../../src/saas/deliverables/officeExtensionStrict.js";
import { pathSatisfiesSdmSlot } from "../../src/saas/deliverables/sdmSlotMatching.js";

describe("officeExtensionStrict", () => {
  beforeEach(() => {
    process.env.PILOTDECK_OFFICE_EXTENSION_STRICT = "enforce";
  });

  it("detects fake docx paths", () => {
    expect(isFakeDocxPath("campaign-brief.docx.md")).toBe(true);
    expect(isFakeDocxPath("campaign-brief.docx")).toBe(false);
  });

  it("detects placeholder visual paths", () => {
    expect(isPlaceholderVisualPath("nova-kv-placeholder.svg", "key-visual-poster.png")).toBe(true);
    expect(isPlaceholderVisualPath("key-visual-poster.png", "key-visual-poster.png")).toBe(false);
  });

  it("enforce: docx slot rejects .md path", () => {
    expect(
      officeExtensionPathSatisfiesSlot("artifacts/task-x/campaign-brief.md", {
        kind: "docx",
        pathHint: "campaign-brief.docx",
      }),
    ).toBe(false);
    expect(
      pathSatisfiesSdmSlot("artifacts/task-x/campaign-brief.docx", {
        kind: "docx",
        pathHint: "campaign-brief.docx",
      }),
    ).toBe(true);
  });

  it("shadow: docx slot allows .md with telemetry-only pass", () => {
    process.env.PILOTDECK_OFFICE_EXTENSION_STRICT = "shadow";
    expect(
      officeExtensionPathSatisfiesSlot("artifacts/task-x/campaign-brief.md", {
        kind: "docx",
        pathHint: "campaign-brief.docx",
      }),
    ).toBe(true);
  });
});
