/**
 * PD-SAAS-FORK (P0-B3 / ES9 P0-A): single source for pipeline / dock validationSettled.
 * Engine acceptance + repair/streaming gates beat disk-only completeness.
 */
import type { SanitizedTurnAcceptanceMeta } from './turnAcceptanceMeta';

export type ResolvePipelineValidationSettledInput = {
  sessionRepairActive?: boolean;
  isAssistantWorking?: boolean;
  latestTurnAcceptanceMeta?: SanitizedTurnAcceptanceMeta | null;
  diskSnapshotComplete?: boolean;
  /** When false, disk snapshot may block settled even after acceptance passed. */
  settledAcceptanceAuthority?: boolean;
  certificateUiEnabled?: boolean;
  certificateComplete?: boolean;
  certificateEnforce?: boolean;
};

const PASSED_ACCEPTANCE_STATUSES = new Set(['passed', 'degraded_pass']);

export function isAcceptancePassedForSettled(
  meta?: SanitizedTurnAcceptanceMeta | null,
): boolean {
  const status = meta?.acceptanceStatus;
  return typeof status === 'string' && PASSED_ACCEPTANCE_STATUSES.has(status);
}

export function resolvePipelineValidationSettled(
  input: ResolvePipelineValidationSettledInput,
): boolean {
  const acceptancePassed = isAcceptancePassedForSettled(input.latestTurnAcceptanceMeta);
  const settledAuthority = input.settledAcceptanceAuthority !== false;
  const verifiedCount = input.latestTurnAcceptanceMeta?.verifiedPaths?.length ?? 0;

  // PD-SAAS-FORK fd7c166c: acceptance already passed (or disk complete with verified paths)
  // → settle even if assistant is still doing post-delivery quality review / subagent.
  if (acceptancePassed && settledAuthority) {
    if (input.certificateUiEnabled && input.certificateEnforce && !input.certificateComplete) {
      return false;
    }
    return true;
  }

  if (typeof input.latestTurnAcceptanceMeta?.acceptanceStatus === 'string'
    && PASSED_ACCEPTANCE_STATUSES.has(input.latestTurnAcceptanceMeta.acceptanceStatus)
    && !settledAuthority) {
    return true;
  }

  if (input.diskSnapshotComplete === true && verifiedCount > 0 && !input.sessionRepairActive) {
    return true;
  }

  if (input.sessionRepairActive || input.isAssistantWorking) {
    return false;
  }

  if (input.diskSnapshotComplete === false) {
    return false;
  }
  if (input.diskSnapshotComplete === true) {
    return true;
  }

  return true;
}
