// PD-SAAS-FORK: per template-stage recovery sub-budget

export const DEFAULT_STAGE_RECOVERY_BUDGET = 2;

export function resolveStageRecoveryBudget(input: {
  stageIndex: number;
  totalStages: number;
  globalRemaining: number;
  perStageMax?: number;
}): number {
  const perStage = input.perStageMax ?? DEFAULT_STAGE_RECOVERY_BUDGET;
  const stagesLeft = Math.max(1, input.totalStages - input.stageIndex);
  const fairShare = Math.max(1, Math.floor(input.globalRemaining / stagesLeft));
  return Math.min(perStage, fairShare, input.globalRemaining);
}
