// PD-SAAS-FORK: final-only acceptance state for user-facing deliverables.
import type {
  AcceptanceExpected,
  AcceptanceFailure,
} from "../deliverables/acceptanceChecks.js";

export type FinalAcceptanceStatus =
  | "passed"
  | "needs_repair"
  | "user_action_required"
  | "not_applicable"
  | "failed";

export type FinalAcceptanceResult = {
  status: FinalAcceptanceStatus;
  expected: AcceptanceExpected;
  expectedManifest?: Array<{
    id: string;
    kind?: AcceptanceExpected["kind"];
    count?: number;
    required: boolean;
  }> | Array<Record<string, unknown>>;
  verifiedPaths: string[];
  missingPaths: string[];
  brokenPaths: string[];
  failures: AcceptanceFailure[];
  continuePrompt: string;
};

export function createFinalAcceptanceResult(input: FinalAcceptanceResult): FinalAcceptanceResult {
  return input;
}
