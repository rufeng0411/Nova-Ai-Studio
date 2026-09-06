/** PD-SAAS-FORK: detect monotonic deliverable completion for sticky bar pulse. */
export function shouldPulseDeliverableCompletion(
  prevDone: number | null,
  nextDone: number,
  total: number,
): boolean {
  if (prevDone === null) return false;
  if (total <= 0) return false;
  return nextDone > prevDone;
}
