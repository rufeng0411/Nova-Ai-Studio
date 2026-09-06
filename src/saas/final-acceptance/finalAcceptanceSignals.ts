// PD-SAAS-FORK: compact telemetry-safe signals emitted by final acceptance.
import type { FinalAcceptanceResult } from "./finalAcceptanceState.js";

export type FinalAcceptanceSignal = {
  status: FinalAcceptanceResult["status"];
  failureReasons: string[];
  verifiedCount: number;
  missingCount: number;
  brokenCount: number;
};

export function summarizeFinalAcceptance(result: FinalAcceptanceResult): FinalAcceptanceSignal {
  return {
    status: result.status,
    failureReasons: [...new Set(result.failures.map((failure) => failure.reason))],
    verifiedCount: result.verifiedPaths.length,
    missingCount: result.missingPaths.length,
    brokenCount: result.brokenPaths.length,
  };
}
