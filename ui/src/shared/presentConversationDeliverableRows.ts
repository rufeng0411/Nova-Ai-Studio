/** PD-SAAS-FORK: terminal vs in-progress presentation for conversation/export layers only. */
import type { DeliverableDockRow } from './buildDeliverableDockRows';
import { dedupeDeliverableRowsByBasename } from './dedupeDeliverableRowsByBasename';
import { isTerminalDeliverablePresentationEnabled } from './conversationDeliverableFeatureFlags';
import type { DeliverableContextMode } from './deliverableContextInvariants';
import {
  isSessionTaskInFlight,
  type SessionTaskPhase,
} from './sessionTaskLifecycle';
import type { DeliverableCompletionStateUi } from './turnAcceptanceMeta';

export type TerminalPresentationInput = {
  lifecyclePhase?: SessionTaskPhase | 'unknown';
  sessionRepairActive?: boolean;
  completionState?: DeliverableCompletionStateUi | string;
  acceptanceStatus?: string;
  userAcknowledgedComplete?: boolean;
  /** Sidebar「任务完成」— freeze progress and show partial results. */
  sessionSidebarCompleted?: boolean;
};

export function resolveTerminalPresentationMode(
  input: TerminalPresentationInput,
): DeliverableContextMode {
  if (!isTerminalDeliverablePresentationEnabled()) {
    return 'turn_snapshot';
  }
  if (input.userAcknowledgedComplete) return 'terminal';
  if (input.sessionSidebarCompleted) return 'terminal';
  if (input.sessionRepairActive) return 'turn_snapshot';

  const lifecycleInFlight = input.lifecyclePhase !== undefined
    && input.lifecyclePhase !== 'unknown'
    && isSessionTaskInFlight(input.lifecyclePhase);
  if (lifecycleInFlight) return 'turn_snapshot';

  const terminalCompletion = input.completionState === 'complete'
    || input.completionState === 'accepted_partial'
    || input.acceptanceStatus === 'passed';

  return terminalCompletion ? 'terminal' : 'turn_snapshot';
}

function elevateTerminalRowStatus(row: DeliverableDockRow): DeliverableDockRow {
  if (row.status !== 'checking') return row;
  if (row.resolvedPath || row.apiPath) {
    return {
      ...row,
      status: 'delivered',
      previewable: true,
      linkable: true,
    };
  }
  return {
    ...row,
    status: 'missing',
    previewable: false,
    linkable: false,
  };
}

/** Presentation-only copy — never write back to Dock/pipeline state. */
export function presentConversationDeliverableRows(
  rows: DeliverableDockRow[],
  mode: DeliverableContextMode,
): DeliverableDockRow[] {
  if (mode !== 'terminal') return rows;
  return dedupeDeliverableRowsByBasename(
    rows
      .filter((row) => row.status !== 'hidden')
      .map((row) => elevateTerminalRowStatus(row)),
  );
}
