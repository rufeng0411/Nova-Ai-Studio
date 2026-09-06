// PD-SAAS-FORK: merge process attachment traces into a flat step list
import type { TFunction } from 'i18next';
import type { ProcessAttachment } from './processGrouping';
import type { ProcessTraceStep } from './ProcessTrace';
import {
  mergeCompletedTimelineSteps,
  type ProcessTimelineBuilderOptions,
} from '../../shared/processTimelineBuilder';

export function mergeProcessSteps(
  attachments: ProcessAttachment[],
  t: TFunction<'chat'>,
  options?: ProcessTimelineBuilderOptions,
): ProcessTraceStep[] {
  return mergeCompletedTimelineSteps(attachments, t, options);
}

export function isThinkingStep(step: ProcessTraceStep): boolean {
  return step.kind === 'thinking' || step.phase === 'thinking';
}
