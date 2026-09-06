import { afterEach, describe, expect, it } from "vitest";
import type { ContractBindingResult } from "./deliverableContractBinding.js";
import {
  assessCompositeSlotQuality,
  compositeSlotQualityMode,
} from "./compositeSlotQuality.js";

const binding: ContractBindingResult = {
  complete: true,
  requiredCount: 1,
  matchedCount: 1,
  units: [],
  bindings: [],
  slotSummaries: [{
    slotId: "social_pack",
    label: "社媒矩阵",
    required: true,
    requiredCount: 1,
    matchedCount: 1,
    resolvedPaths: ["artifacts/social-matrix/index.md"],
  }],
  usedEvidencePaths: ["artifacts/social-matrix/index.md"],
};

const completeSocialMatrixEvidence = [
  "artifacts/social-matrix/index.md",
  "artifacts/social-matrix/brief.md",
  "artifacts/social-matrix/creative-anchors.md",
  "artifacts/social-matrix/copywriting.md",
  "artifacts/social-matrix/manifest.json",
];

describe("compositeSlotQuality", () => {
  afterEach(() => {
    delete process.env.PILOTDECK_COMPOSITE_SLOT_QUALITY;
  });

  it.each([
    [undefined, "off"],
    ["off", "off"],
    ["shadow", "shadow"],
    ["enforce", "enforce"],
  ] as const)("resolves the independent tri-state flag %s", (raw, expected) => {
    if (raw == null) delete process.env.PILOTDECK_COMPOSITE_SLOT_QUALITY;
    else process.env.PILOTDECK_COMPOSITE_SLOT_QUALITY = raw;
    expect(compositeSlotQualityMode()).toBe(expected);
  });

  it("observes an index-only social matrix as incomplete in shadow mode", () => {
    process.env.PILOTDECK_COMPOSITE_SLOT_QUALITY = "shadow";
    const assessments = assessCompositeSlotQuality({
      profileId: "social_matrix",
      binding,
      evidencePaths: ["artifacts/social-matrix/index.md"],
      scopeDir: "artifacts/social-matrix",
    });
    expect(assessments).toEqual([expect.objectContaining({
      slotId: "social_pack",
      complete: false,
      reason: "composite_directory_incomplete",
      missingBasenames: [
        "brief.md",
        "creative-anchors.md",
        "copywriting.md",
        "manifest.json",
      ],
    })]);
  });

  it("passes when the profile-defined minimum file group is present", () => {
    process.env.PILOTDECK_COMPOSITE_SLOT_QUALITY = "enforce";
    const assessments = assessCompositeSlotQuality({
      profileId: "social_matrix",
      binding,
      evidencePaths: completeSocialMatrixEvidence,
      scopeDir: "artifacts/social-matrix",
    });
    expect(assessments).toEqual([expect.objectContaining({
      slotId: "social_pack",
      complete: true,
      missingBasenames: [],
    })]);
  });

  it("does not count matching files outside the frozen scope", () => {
    process.env.PILOTDECK_COMPOSITE_SLOT_QUALITY = "enforce";
    const assessments = assessCompositeSlotQuality({
      profileId: "social_matrix",
      binding,
      evidencePaths: [
        "artifacts/social-matrix/index.md",
        "artifacts/other-task/brief.md",
        "artifacts/other-task/creative-anchors.md",
        "artifacts/other-task/copywriting.md",
        "artifacts/other-task/manifest.json",
      ],
      scopeDir: "artifacts/social-matrix",
    });
    expect(assessments[0]?.complete).toBe(false);
    expect(assessments[0]?.observedPaths).toEqual(["artifacts/social-matrix/index.md"]);
  });

  it("accepts an explicit degraded placeholder and records the reason", () => {
    process.env.PILOTDECK_COMPOSITE_SLOT_QUALITY = "enforce";
    const assessments = assessCompositeSlotQuality({
      profileId: "social_matrix",
      binding,
      evidencePaths: ["artifacts/social-matrix/index.md"],
      scopeDir: "artifacts/social-matrix",
      degradedSlots: [{
        slotId: "social_pack",
        reason: "上游图片服务不可用，已按清单允许占位",
      }],
    });
    expect(assessments).toEqual([expect.objectContaining({
      slotId: "social_pack",
      complete: true,
      degraded: true,
      degradedReason: "上游图片服务不可用，已按清单允许占位",
    })]);
  });

  it("returns no assessment when the flag is off", () => {
    expect(assessCompositeSlotQuality({
      profileId: "social_matrix",
      binding,
      evidencePaths: ["artifacts/social-matrix/index.md"],
      scopeDir: "artifacts/social-matrix",
    })).toEqual([]);
  });
});
