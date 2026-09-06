// PD-SAAS-FORK P0-7: the only authority that maps final engine facts to a certificate.
import type { ContinuationAction } from "../../saas/taskContinuationPolicy.js";
import type { SessionDeliverableManifest } from "../../saas/taskState/sessionDeliverableManifest.js";
import {
  buildDeliverableAcceptanceCertificate,
  type CompletionState,
  type DeliverableAcceptanceCertificate,
  type DeliverableAcceptanceCertificateV1,
  type DeliverableAcceptanceCertificateV2,
} from "../../saas/deliverables/deliverableAcceptanceCertificate.js";
import {
  bindContractUnitsStrict,
  type ContractBindingResult,
} from "../../saas/deliverables/deliverableContractBinding.js";
import type { EngineDeliverableValidation } from "./validateDeliverablesEngine.js";

export type DeliverableContinuationOwner =
  | "none"
  | "deliverable_repair"
  | "auto_continue_engine"
  | "ui_fallback";

type FinalizedAcceptanceStatus = Exclude<
  DeliverableAcceptanceCertificateV1["acceptanceStatus"],
  "not_applicable"
>;

export type FinalizeDeliverableAcceptanceInput = {
  validation: EngineDeliverableValidation;
  manifest?: SessionDeliverableManifest;
  scopeDir?: string | null;
  diskPaths?: string[];
  candidateContinuationAction?: ContinuationAction;
  candidateContinuationOwner?: DeliverableContinuationOwner;
  userAcknowledgedPartial?: boolean;
  circuitBreakerTripped?: boolean;
  recoveryBudgetExhausted?: boolean;
};

export type FinalizedDeliverableAcceptance = {
  validation: EngineDeliverableValidation;
  acceptanceCertificate?: DeliverableAcceptanceCertificate;
  completionState: CompletionState;
  acceptanceStatus: FinalizedAcceptanceStatus;
  continuationAction: ContinuationAction;
  continuationOwner: DeliverableContinuationOwner;
  partialReason?: DeliverableAcceptanceCertificateV2["partialReason"];
  blockedReasonType?: DeliverableAcceptanceCertificateV2["blockedReasonType"];
};

type FinalState = Pick<
  FinalizedDeliverableAcceptance,
  "completionState" | "acceptanceStatus"
> & {
  partialReason?: DeliverableAcceptanceCertificateV2["partialReason"];
  blockedReasonType?: DeliverableAcceptanceCertificateV2["blockedReasonType"];
};

function buildStrictBinding(
  input: FinalizeDeliverableAcceptanceInput,
): ContractBindingResult | undefined {
  if (!input.manifest) return undefined;
  return bindContractUnitsStrict({
    manifest: input.manifest,
    verifiedPaths: input.validation.verified,
    diskPaths: input.diskPaths,
    scopeDir: input.scopeDir ?? input.manifest.taskArtifactDir ?? null,
  });
}

function resolveFinalState(
  input: FinalizeDeliverableAcceptanceInput,
  strictBinding: ContractBindingResult | undefined,
): FinalState {
  if (input.circuitBreakerTripped || input.recoveryBudgetExhausted) {
    return {
      completionState: "blocked",
      acceptanceStatus: "failed",
      blockedReasonType: "system_exhausted",
    };
  }

  const qualityCompletion =
    input.validation.enforcedQualityCompletion ?? "not_applicable";
  if (
    input.validation.acceptance === "user_action_required"
    || input.candidateContinuationAction === "user_action_required"
    || qualityCompletion === "blocked"
  ) {
    return {
      completionState: "blocked",
      acceptanceStatus: "user_action_required",
      blockedReasonType: "user_action_required",
    };
  }
  if (input.validation.acceptance === "failed") {
    return {
      completionState: "blocked",
      acceptanceStatus: "failed",
      blockedReasonType: "system_exhausted",
    };
  }

  const hasAnyAcceptedEvidence =
    (strictBinding?.matchedCount ?? input.validation.verified.length) > 0;
  if (input.userAcknowledgedPartial && hasAnyAcceptedEvidence) {
    return {
      completionState: "accepted_partial",
      acceptanceStatus: "passed",
      partialReason: "user_acknowledged",
    };
  }

  const structureComplete =
    input.validation.acceptance === "passed"
    && input.validation.missing.length === 0
    && input.validation.broken.length === 0
    && (strictBinding?.complete ?? true);
  if (structureComplete && qualityCompletion === "degraded_acceptable") {
    return {
      completionState: "accepted_partial",
      acceptanceStatus: "passed",
      partialReason: "official_media_degraded",
    };
  }
  if (
    structureComplete
    && (qualityCompletion === "passed" || qualityCompletion === "not_applicable")
  ) {
    return {
      completionState: "complete",
      acceptanceStatus: "passed",
    };
  }
  return {
    completionState: "incomplete",
    acceptanceStatus: "needs_repair",
  };
}

function resolveContinuation(input: {
  state: FinalState;
  candidateAction?: ContinuationAction;
  candidateOwner?: DeliverableContinuationOwner;
}): Pick<
  FinalizedDeliverableAcceptance,
  "continuationAction" | "continuationOwner"
> {
  if (input.state.completionState === "blocked") {
    return input.state.blockedReasonType === "user_action_required"
      ? {
          continuationAction: "user_action_required",
          continuationOwner: "none",
        }
      : { continuationAction: "none", continuationOwner: "none" };
  }
  if (
    input.state.completionState === "complete"
    || input.state.completionState === "accepted_partial"
  ) {
    return { continuationAction: "none", continuationOwner: "none" };
  }
  const action = input.candidateAction ?? "none";
  return {
    continuationAction: action,
    continuationOwner: input.candidateOwner
      ?? (action === "deliverable_repair"
        ? "deliverable_repair"
        : action === "auto_continue_engine"
          ? "auto_continue_engine"
          : "none"),
  };
}

export function finalizeDeliverableAcceptance(
  input: FinalizeDeliverableAcceptanceInput,
): FinalizedDeliverableAcceptance {
  const strictBinding = buildStrictBinding(input);
  const state = resolveFinalState(input, strictBinding);
  const continuation = resolveContinuation({
    state,
    candidateAction: input.candidateContinuationAction,
    candidateOwner: input.candidateContinuationOwner,
  });
  const blockedReason = state.completionState === "blocked"
    ? state.blockedReasonType
    : undefined;
  const acceptanceCertificate = buildDeliverableAcceptanceCertificate({
    manifest: input.manifest,
    scopeDir: input.scopeDir,
    verifiedPaths: input.validation.verified,
    diskPaths: input.diskPaths,
    missingPaths: input.validation.missing,
    brokenPaths: input.validation.broken,
    acceptanceStatus: state.acceptanceStatus,
    continuationOwner: continuation.continuationOwner,
    userAcknowledgedPartial: input.userAcknowledgedPartial,
    ...(blockedReason ? { blockedReason } : {}),
    completionStateOverride: state.completionState,
    finalizedByAcceptancePipeline: true,
    ...(input.validation.qualityContractHash
      ? { qualityContractHash: input.validation.qualityContractHash }
      : {}),
    ...(input.validation.qualityEvidenceHash
      ? { qualityEvidenceHash: input.validation.qualityEvidenceHash }
      : {}),
    ...(input.validation.qualityCompletion
      ? { qualityCompletion: input.validation.qualityCompletion }
      : {}),
    ...(state.partialReason ? { partialReason: state.partialReason } : {}),
    ...(state.blockedReasonType
      ? { blockedReasonType: state.blockedReasonType }
      : {}),
    ...(input.validation.qualityFailures
      ? { qualityFailures: input.validation.qualityFailures }
      : {}),
    ...(input.validation.assetProvenanceSummary
      ? {
          assetProvenanceSummary:
            input.validation.assetProvenanceSummary,
        }
      : {}),
    ...(strictBinding ? { strictBinding } : {}),
    ...(input.validation.bindingAudit
      ? { bindingAudit: input.validation.bindingAudit }
      : {}),
  }) ?? undefined;
  const validation: EngineDeliverableValidation = {
    ...input.validation,
    acceptance: state.acceptanceStatus,
    completionState: state.completionState,
  };

  return {
    validation,
    ...(acceptanceCertificate ? { acceptanceCertificate } : {}),
    ...state,
    ...continuation,
  };
}
