/** PD-SAAS-FORK: table invariants for conversation deliverable contexts (footer / export inline). */
import type { DeliverableDockRow } from './buildDeliverableDockRows';
import { getArtifactFileName } from './artifactPaths';
import {
  normalizeConversationSummaryProgress,
  type ConversationSummaryProgress,
} from './normalizeConversationSummaryProgress';
import { isDeliverableContextInvariantWarnOnly } from './conversationDeliverableFeatureFlags';

export type DeliverableContextMode = 'turn_snapshot' | 'live' | 'terminal';

export type DeliverableContextInvariantId = 'I1' | 'I2' | 'I3' | 'I4';

export type DeliverableContextInvariantViolation = {
  id: DeliverableContextInvariantId;
  message: string;
};

export function deliverableContextInvariantViolations(
  rows: DeliverableDockRow[],
  mode: DeliverableContextMode,
  options?: {
    expectedSlotCount?: number;
    progress?: ConversationSummaryProgress;
  },
): DeliverableContextInvariantViolation[] {
  const violations: DeliverableContextInvariantViolation[] = [];
  const active = rows.filter((row) => row.status !== 'hidden');

  if (
    typeof options?.expectedSlotCount === 'number'
    && options.expectedSlotCount >= 0
    && active.length > options.expectedSlotCount
  ) {
    violations.push({
      id: 'I1',
      message: `row count ${active.length} exceeds expected slot count ${options.expectedSlotCount}`,
    });
  }

  const basenameCounts = new Map<string, number>();
  for (const row of active) {
    const path = row.resolvedPath || row.apiPath || row.path || '';
    const base = getArtifactFileName(path).toLowerCase();
    if (!base) continue;
    basenameCounts.set(base, (basenameCounts.get(base) ?? 0) + 1);
  }
  for (const [base, count] of basenameCounts) {
    if (count > 1) {
      violations.push({
        id: 'I2',
        message: `duplicate basename ${base} (${count} rows)`,
      });
    }
  }

  const progress = options?.progress ?? normalizeConversationSummaryProgress(rows);
  const checkingCount = active.filter((row) => row.status === 'checking').length;
  if (
    progress.total > 0
    && progress.done === progress.total
    && checkingCount > 0
  ) {
    violations.push({
      id: 'I3',
      message: `progress ${progress.done}/${progress.total} but ${checkingCount} checking rows remain`,
    });
  }

  if (mode === 'terminal' && checkingCount > 0) {
    violations.push({
      id: 'I4',
      message: `${checkingCount} checking rows in terminal presentation`,
    });
  }

  return violations;
}

export function assertDeliverableContextInvariants(
  rows: DeliverableDockRow[],
  mode: DeliverableContextMode,
  options?: {
    expectedSlotCount?: number;
    contextLabel?: string;
    progress?: ConversationSummaryProgress;
  },
): void {
  const violations = deliverableContextInvariantViolations(rows, mode, options);
  if (violations.length === 0) return;

  const label = options?.contextLabel ?? mode;
  const detail = violations.map((v) => `${v.id}: ${v.message}`).join('; ');
  const message = `[deliverable-context:${label}] ${detail}`;

  if (isDeliverableContextInvariantWarnOnly()) {
    console.warn(message);
    return;
  }
  console.error(message);
}
