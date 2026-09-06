// PD-SAAS-FORK P0-D: context-aware thinking step titles for process timeline.
import type { SessionTaskPhase } from './sessionTaskLifecycle';
import { isDeliverableTrustCopyV2Enabled } from './perfFeatureFlags';

export type ThinkingStepPresentationKind =
  | 'planning'
  | 'repair'
  | 'sanitize'
  | 'default';

export type ResolveThinkingStepPresentationInput = {
  sessionTaskPhase?: SessionTaskPhase;
  latestToolName?: string | null;
  latestStageKey?: string | null;
  workingStatusKind?: string | null;
  done?: number;
  total?: number;
  trustCopyV2Enabled?: boolean;
};

export type ThinkingStepPresentation = {
  kind: ThinkingStepPresentationKind;
  titleKey:
    | 'process.thinking.planningTitle'
    | 'process.thinking.repairTitle'
    | 'process.thinking.placeholder'
    | 'process.thinking.activeTitle';
  values?: Record<string, string | number>;
};

export function resolveThinkingStepPresentation(
  input: ResolveThinkingStepPresentationInput,
): ThinkingStepPresentation {
  const enabled = input.trustCopyV2Enabled ?? isDeliverableTrustCopyV2Enabled();
  if (!enabled) {
    return { kind: 'default', titleKey: 'process.thinking.activeTitle' };
  }

  const tool = String(input.latestToolName ?? '').toLowerCase();
  const stage = String(input.latestStageKey ?? '').toLowerCase();
  const statusKind = String(input.workingStatusKind ?? '').toLowerCase();

  if (
    tool.includes('exit_plan_mode')
    || stage.includes('plan')
    || stage.includes('策划')
  ) {
    return { kind: 'planning', titleKey: 'process.thinking.planningTitle' };
  }

  if (
    input.sessionTaskPhase === 'deliverable_repair_pending'
    || statusKind.includes('deliverable_repair')
    || statusKind.includes('deliverable_validate')
  ) {
    return {
      kind: 'repair',
      titleKey: 'process.thinking.repairTitle',
      values: {
        done: input.done ?? 0,
        total: input.total ?? 0,
      },
    };
  }

  return { kind: 'default', titleKey: 'process.thinking.activeTitle' };
}
