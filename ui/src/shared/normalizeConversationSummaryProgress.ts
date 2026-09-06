/** PD-SAAS-FORK: conversation-layer progress — row aggregation is authoritative (Dock progress untouched). */
import type { DeliverableDockRow } from './buildDeliverableDockRows';

export type ConversationSummaryProgress = {
  /** Alias of accepted — legacy callers. */
  done: number;
  generated: number;
  accepted: number;
  total: number;
};

function rowHasOpenablePath(row: DeliverableDockRow): boolean {
  const resolved = String(row.resolvedPath || row.apiPath || '').trim();
  if (resolved) return true;
  if (row.linkable && String(row.path || '').trim()) return true;
  return false;
}

export function normalizeConversationSummaryProgress(
  rows: DeliverableDockRow[],
): ConversationSummaryProgress {
  const active = rows.filter((row) => row.status !== 'hidden');
  const total = active.length;
  const accepted = active.filter((row) => row.status === 'delivered').length;
  const generated = active.filter((row) => rowHasOpenablePath(row) || row.status === 'delivered').length;
  const safeGenerated = Math.max(accepted, Math.min(generated, total));
  return { done: accepted, generated: safeGenerated, accepted, total };
}
