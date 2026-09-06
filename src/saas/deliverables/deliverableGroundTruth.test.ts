import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  applyGroundTruthToValidation,
  isGroundTruthReconcileEnabled,
  reconcileDeliverableGroundTruth,
  shouldApplyBaselineStrictGt,
  shouldTreatSdmAsComplete,
} from "./deliverableGroundTruth.js";
import type { SessionDeliverableManifest } from "../taskState/sessionDeliverableManifest.js";
import type { EngineDeliverableValidation } from "../../agent/deliverables/validateDeliverablesEngine.js";

const COMPETITOR_GOAL = [
  "帮我做竞品口碑分析，两步一次做完：",
  "1. competitive-brief.md 竞品简报",
  "2. sentiment-notes.md 口碑要点",
  "直接开始做，做完告诉我文件在哪。",
].join("\n");

function b9ab64b2Manifest(): SessionDeliverableManifest {
  return {
    manifestVersion: 2,
    goalVersion: 1,
    sessionGoalAnchor: COMPETITOR_GOAL,
    slots: [
      {
        id: "slot_1_competitive_brief_md",
        label: "competitive-brief.md 竞品简报",
        pathHint: "competitive-brief.md",
        required: true,
        status: "done",
        kind: "markdown",
      },
      {
        id: "slot_2_sentiment_notes_md",
        label: "sentiment-notes.md 口碑要点",
        pathHint: "sentiment-notes.md",
        required: true,
        status: "done",
        kind: "markdown",
      },
      {
        id: "pivot_html_2",
        label: "html",
        kind: "html",
        required: true,
        status: "active",
      },
    ],
  };
}

describe("deliverableGroundTruth", () => {
  const prev = process.env.PILOTDECK_GROUND_TRUTH_RECONCILE;

  beforeEach(() => {
    process.env.PILOTDECK_GROUND_TRUTH_RECONCILE = "1";
  });

  afterEach(() => {
    if (prev == null) delete process.env.PILOTDECK_GROUND_TRUTH_RECONCILE;
    else process.env.PILOTDECK_GROUND_TRUTH_RECONCILE = prev;
  });

  it("GT-01: b9ab64b2 — verified 2, missing=[], pivot slot → passed", () => {
    const result = reconcileDeliverableGroundTruth({
      userGoal: COMPETITOR_GOAL,
      verified: [
        "artifacts/competitive/competitive-brief.md",
        "artifacts/competitive/sentiment-notes.md",
      ],
      missing: [],
      broken: [],
      sessionManifest: b9ab64b2Manifest(),
    });
    expect(result.reconciled).toBe(true);
    expect(result.acceptance).toBe("passed");
    expect(result.satisfiedSlotIds.length).toBe(2);
    expect(result.sdmWarnings.some((w) => w.includes("pivot_"))).toBe(true);
  });

  it("GT-02: real gap — 1/3 numbered verified → needs_repair", () => {
    const goal = [
      "三步交付：",
      "1. intel.md",
      "2. battlecard.md",
      "3. talk-track.md",
    ].join("\n");
    const result = reconcileDeliverableGroundTruth({
      userGoal: goal,
      verified: ["artifacts/intel.md"],
      missing: ["artifacts/battlecard.md"],
      broken: [],
    });
    expect(result.reconciled).toBe(false);
    expect(result.acceptance).toBe("needs_repair");
  });

  it("GT-03: verified=0 must not reconcile passed", () => {
    const result = reconcileDeliverableGroundTruth({
      userGoal: COMPETITOR_GOAL,
      verified: [],
      missing: [],
      broken: [],
      sessionManifest: b9ab64b2Manifest(),
    });
    expect(result.reconciled).toBe(false);
  });

  it("GT-04: numbered pptx file in goal satisfied", () => {
    const result = reconcileDeliverableGroundTruth({
      userGoal: "1. presentation.pptx 融资路演 PPT",
      verified: ["artifacts/deck/presentation.pptx"],
      missing: [],
      broken: [],
      capabilitySlug: "anth-pptx",
    });
    expect(result.reconciled).toBe(true);
    expect(result.acceptance).toBe("passed");
  });

  it("GT-07: flag off → reconciled false", () => {
    process.env.PILOTDECK_GROUND_TRUTH_RECONCILE = "0";
    expect(isGroundTruthReconcileEnabled()).toBe(false);
    const result = reconcileDeliverableGroundTruth({
      userGoal: COMPETITOR_GOAL,
      verified: [
        "artifacts/competitive/competitive-brief.md",
        "artifacts/competitive/sentiment-notes.md",
      ],
      missing: [],
      broken: [],
      sessionManifest: b9ab64b2Manifest(),
    });
    expect(result.reconciled).toBe(false);
  });

  it("GT-08: applyGroundTruthToValidation syncs acceptance", () => {
    const validation: EngineDeliverableValidation = {
      verified: [
        "artifacts/competitive/competitive-brief.md",
        "artifacts/competitive/sentiment-notes.md",
      ],
      missing: [],
      broken: [],
      failures: [],
      acceptance: "needs_repair",
    };
    const next = applyGroundTruthToValidation(validation, {
      userGoal: COMPETITOR_GOAL,
      sessionManifest: b9ab64b2Manifest(),
    });
    expect(next.acceptance).toBe("passed");
    expect(next.continuePrompt).toBeUndefined();
  });

  it("GT-09: shouldTreatSdmAsComplete when numbered satisfied", () => {
    expect(
      shouldTreatSdmAsComplete({
        userGoal: COMPETITOR_GOAL,
        verified: [
          "artifacts/competitive/competitive-brief.md",
          "artifacts/competitive/sentiment-notes.md",
        ],
        missing: [],
        broken: [],
        sessionManifest: b9ab64b2Manifest(),
      }),
    ).toBe(true);
  });

  it("GT-10: baselineLocked auto strict GT — 3/6 required done stays needs_repair (C4)", () => {
    const prevStrict = process.env.PILOTDECK_SDM_BASELINE_STRICT_GT;
    delete process.env.PILOTDECK_SDM_BASELINE_STRICT_GT;
    const manifest: SessionDeliverableManifest = {
      manifestVersion: 2,
      goalVersion: 1,
      baselineLocked: true,
      profileId: "geo",
      sessionGoalAnchor: "雷蛇 GEO 七步",
      slots: [
        { id: "s1", label: "audit", pathHint: "01-aeo-audit-checklist.md", pathHints: ["01-aeo-audit-checklist.md"], required: true, status: "done" },
        { id: "s2", label: "keywords", pathHint: "02-keyword-research.md", pathHints: ["02-keyword-research.md"], required: true, status: "done" },
        { id: "s3", label: "draft", pathHint: "03-optimized.md", pathHints: ["03-optimized.md"], required: true, status: "done" },
        { id: "s4", label: "platform", required: true, status: "pending", count: 3 },
        { id: "s5", label: "schema", pathHint: "schema.jsonld", pathHints: ["schema.jsonld"], required: true, status: "pending" },
        { id: "s6", label: "citability", pathHint: "citability-report.md", pathHints: ["citability-report.md"], required: true, status: "pending" },
        { id: "s7", label: "optional xhs", required: false, status: "pending" },
      ],
    };
    expect(shouldApplyBaselineStrictGt(manifest)).toBe(true);
    const verified = [
      "artifacts/razer-geo/01-aeo-audit-checklist.md",
      "artifacts/razer-geo/02-keyword-research.md",
      "artifacts/razer-geo/03-optimized.md",
      "artifacts/razer-geo/README.md",
      "artifacts/razer-geo/deliverables-index.md",
    ];
    const result = reconcileDeliverableGroundTruth({
      userGoal: manifest.sessionGoalAnchor,
      verified,
      missing: [],
      broken: [],
      sessionManifest: manifest,
    });
    expect(result.acceptance).toBe("needs_repair");
    expect(result.reconciled).toBe(false);
    if (prevStrict == null) delete process.env.PILOTDECK_SDM_BASELINE_STRICT_GT;
    else process.env.PILOTDECK_SDM_BASELINE_STRICT_GT = prevStrict;
  });

  it("GT-11: auto strict blocks profile basename bypass when SDM incomplete", () => {
    const prevStrict = process.env.PILOTDECK_SDM_BASELINE_STRICT_GT;
    delete process.env.PILOTDECK_SDM_BASELINE_STRICT_GT;
    const manifest: SessionDeliverableManifest = {
      manifestVersion: 2,
      goalVersion: 1,
      baselineLocked: true,
      profileId: "geo",
      sessionGoalAnchor: "GEO 七步",
      slots: [
        { id: "s1", label: "audit", pathHint: "geo-aeo-audit-checklist.md", pathHints: ["geo-aeo-audit-checklist.md", "01-aeo-audit-checklist.md"], required: true, status: "done" },
        { id: "s2", label: "keywords", pathHint: "keywords-research.md", pathHints: ["keywords-research.md"], required: true, status: "pending" },
        { id: "s3", label: "platform", pathHint: "optimized.md", pathHints: ["optimized.md"], required: true, status: "pending" },
      ],
    };
    const verified = [
      "artifacts/geo/geo-aeo-audit-checklist.md",
    ];
    const result = reconcileDeliverableGroundTruth({
      userGoal: manifest.sessionGoalAnchor,
      verified,
      missing: [],
      broken: [],
      sessionManifest: manifest,
      profileId: "geo",
    });
    expect(result.acceptance).toBe("needs_repair");
    if (prevStrict == null) delete process.env.PILOTDECK_SDM_BASELINE_STRICT_GT;
    else process.env.PILOTDECK_SDM_BASELINE_STRICT_GT = prevStrict;
  });

  it("GT-12: PILOTDECK_SDM_BASELINE_STRICT_GT=0 disables auto strict (rollback)", () => {
    const prevStrict = process.env.PILOTDECK_SDM_BASELINE_STRICT_GT;
    process.env.PILOTDECK_SDM_BASELINE_STRICT_GT = "0";
    const manifest: SessionDeliverableManifest = {
      manifestVersion: 2,
      goalVersion: 1,
      baselineLocked: true,
      profileId: "geo",
      sessionGoalAnchor: "GEO",
      slots: [
        { id: "s1", label: "audit", pathHint: "geo-aeo-audit-checklist.md", required: true, status: "pending" },
      ],
    };
    expect(shouldApplyBaselineStrictGt(manifest)).toBe(false);
    if (prevStrict == null) delete process.env.PILOTDECK_SDM_BASELINE_STRICT_GT;
    else process.env.PILOTDECK_SDM_BASELINE_STRICT_GT = prevStrict;
  });
});
