import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { EngineDeliverableValidation } from "./validateDeliverablesEngine.js";
import type { SessionDeliverableManifest } from "../../saas/taskState/sessionDeliverableManifest.js";
import { finalizeDeliverableAcceptance } from "./finalizeDeliverableAcceptance.js";

const TASK_DIR = "artifacts/task-finalizer";
const REPORT_PATH = `${TASK_DIR}/report.md`;
const HTML_PATH = `${TASK_DIR}/report.html`;

function manifest(): SessionDeliverableManifest {
  return {
    manifestVersion: 1,
    goalVersion: 1,
    sessionGoalAnchor: "交付报告",
    taskArtifactDir: TASK_DIR,
    baselineLocked: true,
    slots: [
      {
        id: "report_md",
        label: "报告",
        kind: "markdown",
        pathHint: REPORT_PATH,
        required: true,
        status: "active",
      },
      {
        id: "report_html",
        label: "网页版",
        kind: "html",
        pathHint: HTML_PATH,
        required: true,
        status: "active",
      },
    ],
  };
}

function validation(
  overrides: Partial<EngineDeliverableValidation> = {},
): EngineDeliverableValidation {
  return {
    verified: [REPORT_PATH, HTML_PATH],
    missing: [],
    broken: [],
    failures: [],
    acceptance: "passed",
    qualityCompletion: "passed",
    enforcedQualityCompletion: "passed",
    qualityContractHash: "qgc1:contract",
    qualityEvidenceHash: `qev1:${"a".repeat(64)}`,
    qualityFailures: [],
    ...overrides,
  };
}

describe("finalizeDeliverableAcceptance", () => {
  beforeEach(() => {
    process.env.PILOTDECK_DELIVERABLE_CERTIFICATE_V2 = "shadow";
    process.env.PILOTDECK_CONTRACT_AUTHORITY_V2 = "shadow";
    process.env.PILOTDECK_CONTENT_QUALITY_V2 = "enforce";
  });

  afterEach(() => {
    delete process.env.PILOTDECK_DELIVERABLE_CERTIFICATE_V2;
    delete process.env.PILOTDECK_CONTRACT_AUTHORITY_V2;
    delete process.env.PILOTDECK_CONTENT_QUALITY_V2;
  });

  it("builds one complete v2 certificate with engine quality evidence", () => {
    const result = finalizeDeliverableAcceptance({
      validation: validation({
        assetProvenanceSummary: {
          totalEntries: 1,
          validEntries: 1,
          officialEntries: 1,
          invalidEntries: 0,
          placeholderCount: 0,
          sourceLevelCounts: { L0: 1 },
          sourceTierCounts: { brand_official: 1 },
          ledgerEvidenceHash: `ape1:${"b".repeat(64)}`,
        },
      }),
      manifest: manifest(),
      scopeDir: TASK_DIR,
      candidateContinuationAction: "deliverable_repair",
    });

    expect(result.completionState).toBe("complete");
    expect(result.acceptanceStatus).toBe("passed");
    expect(result.continuationAction).toBe("none");
    expect(result.continuationOwner).toBe("none");
    expect(result.acceptanceCertificate).toMatchObject({
      certificateVersion: 2,
      completionState: "complete",
      acceptanceStatus: "passed",
      qualityContractHashVersion: 1,
      qualityContractHash: "qgc1:contract",
      qualityEvidenceHashVersion: 1,
      qualityEvidenceHash: `qev1:${"a".repeat(64)}`,
      qualityCompletion: "passed",
      assetProvenanceSummary: expect.objectContaining({
        officialEntries: 1,
        invalidEntries: 0,
      }),
    });
  });

  it("maps an allowed official-media degradation to accepted_partial", () => {
    const result = finalizeDeliverableAcceptance({
      validation: validation({
        qualityCompletion: "degraded_acceptable",
        enforcedQualityCompletion: "degraded_acceptable",
      }),
      manifest: manifest(),
      scopeDir: TASK_DIR,
      candidateContinuationAction: "deliverable_repair",
    });

    expect(result).toMatchObject({
      completionState: "accepted_partial",
      acceptanceStatus: "passed",
      partialReason: "official_media_degraded",
      continuationAction: "none",
      continuationOwner: "none",
    });
    expect(result.acceptanceCertificate).toMatchObject({
      completionState: "accepted_partial",
      partialReason: "official_media_degraded",
    });
  });

  it("preserves shadow quality insight without vetoing structural completion", () => {
    const result = finalizeDeliverableAcceptance({
      validation: validation({
        qualityCompletion: "needs_repair",
        enforcedQualityCompletion: "not_applicable",
        qualityFailures: [{
          checkId: "content.subject_anchor",
          domain: "content",
          reason: "subject_anchor_missing",
          repairable: true,
        }],
      }),
      manifest: manifest(),
      scopeDir: TASK_DIR,
      candidateContinuationAction: "deliverable_repair",
    });

    expect(result).toMatchObject({
      completionState: "complete",
      acceptanceStatus: "passed",
      continuationAction: "none",
    });
    expect(result.acceptanceCertificate).toMatchObject({
      completionState: "complete",
      qualityCompletion: "needs_repair",
      qualityFailures: [
        expect.objectContaining({ checkId: "content.subject_anchor" }),
      ],
    });
  });

  it("maps explicit user partial acceptance to a terminal accepted_partial state", () => {
    const result = finalizeDeliverableAcceptance({
      validation: validation({
        verified: [REPORT_PATH],
        missing: [HTML_PATH],
        acceptance: "needs_repair",
      }),
      manifest: manifest(),
      scopeDir: TASK_DIR,
      candidateContinuationAction: "deliverable_repair",
      userAcknowledgedPartial: true,
    });

    expect(result).toMatchObject({
      completionState: "accepted_partial",
      acceptanceStatus: "passed",
      partialReason: "user_acknowledged",
      continuationAction: "none",
    });
  });

  it("maps an unresolvable quality blocker to user_action_required", () => {
    const result = finalizeDeliverableAcceptance({
      validation: validation({
        acceptance: "user_action_required",
        qualityCompletion: "blocked",
        enforcedQualityCompletion: "blocked",
        qualityFailures: [{
          checkId: "official_media.unavailable",
          domain: "official_media",
          reason: "official_media_unavailable",
          repairable: false,
        }],
      }),
      manifest: manifest(),
      scopeDir: TASK_DIR,
      candidateContinuationAction: "user_action_required",
    });

    expect(result).toMatchObject({
      completionState: "blocked",
      acceptanceStatus: "user_action_required",
      blockedReasonType: "user_action_required",
      continuationAction: "user_action_required",
      continuationOwner: "none",
    });
  });

  it("maps continuation arbitration user action to a blocked certificate", () => {
    const result = finalizeDeliverableAcceptance({
      validation: validation({
        verified: [REPORT_PATH],
        missing: [HTML_PATH],
        acceptance: "needs_repair",
      }),
      manifest: manifest(),
      scopeDir: TASK_DIR,
      candidateContinuationAction: "user_action_required",
    });

    expect(result).toMatchObject({
      completionState: "blocked",
      acceptanceStatus: "user_action_required",
      blockedReasonType: "user_action_required",
      continuationAction: "user_action_required",
    });
  });

  it("never rewrites circuit exhaustion to passed or complete", () => {
    const result = finalizeDeliverableAcceptance({
      validation: validation({
        verified: [REPORT_PATH],
        missing: [HTML_PATH],
        acceptance: "needs_repair",
      }),
      manifest: manifest(),
      scopeDir: TASK_DIR,
      candidateContinuationAction: "deliverable_repair",
      circuitBreakerTripped: true,
    });

    expect(result).toMatchObject({
      completionState: "blocked",
      acceptanceStatus: "failed",
      blockedReasonType: "system_exhausted",
      continuationAction: "none",
      continuationOwner: "none",
    });
    expect(result.validation.missing).toEqual([HTML_PATH]);
    expect(result.acceptanceCertificate).toMatchObject({
      completionState: "blocked",
      acceptanceStatus: "failed",
      blockedReasonType: "system_exhausted",
    });
  });
});
