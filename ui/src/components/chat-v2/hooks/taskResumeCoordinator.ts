// PD-SAAS-FORK: single auto-resume slot per turn boundary (infra > deliverable_repair > recovery_pause)
// P0-3: cold_resume is the cold-start (load-time) fallback. It is server-verified (idempotent +
// budgeted + recency-gated in the control plane) but ranks LOW so any live engine-driven recovery
// owner preempts it — it only wins when in-memory state is empty (true cold start) or vs stale_turn.

export type TaskResumeKind =
  | 'infra_interrupt'
  | 'deliverable_repair'
  | 'engine_auto_continue'
  | 'ui_incomplete_deliverable'
  | 'recovery_pause'
  | 'cold_resume'
  | 'stale_turn';

const PRIORITY: Record<TaskResumeKind, number> = {
  infra_interrupt: 50,
  deliverable_repair: 40,
  engine_auto_continue: 30,
  ui_incomplete_deliverable: 20,
  recovery_pause: 15,
  cold_resume: 10,
  stale_turn: 5,
};

type BoundaryState = {
  kind: TaskResumeKind;
  fired: boolean;
};

const boundaryState = new Map<string, BoundaryState>();

/**
 * Attempt to schedule exactly one UI auto-resume per turnBoundaryKey.
 * Returns true when the caller should proceed with onContinue.
 */
export function tryTaskResumeSchedule(turnBoundaryKey: string, kind: TaskResumeKind): boolean {
  if (!turnBoundaryKey) return false;
  const existing = boundaryState.get(turnBoundaryKey);
  if (existing?.fired) return false;
  if (existing && PRIORITY[kind] <= PRIORITY[existing.kind]) {
    return false;
  }
  boundaryState.set(turnBoundaryKey, { kind, fired: false });
  return true;
}

export function markTaskResumeFired(turnBoundaryKey: string, kind: TaskResumeKind): boolean {
  if (!turnBoundaryKey) return false;
  const existing = boundaryState.get(turnBoundaryKey);
  if (!existing || existing.kind !== kind || existing.fired) return false;
  boundaryState.set(turnBoundaryKey, { kind, fired: true });
  return true;
}

export function resetTaskResumeBoundary(turnBoundaryKey: string): void {
  if (turnBoundaryKey) boundaryState.delete(turnBoundaryKey);
}

/** User clicked composer「继续」— reset dedupe slot so manual intent always gets one send attempt. */
export function prepareUserManualTaskResume(turnBoundaryKey: string, kind: TaskResumeKind): boolean {
  if (!turnBoundaryKey) return false;
  boundaryState.set(turnBoundaryKey, { kind, fired: false });
  return true;
}

export function taskResumePriority(kind: TaskResumeKind): number {
  return PRIORITY[kind];
}

export function buildTaskResumeMessage(args: {
  context: TaskResumeKind | 'deliverable_repair';
  lastTurnId?: string;
  userGoal?: string;
  artifacts?: string[];
  verifiedPaths?: string[];
  missingPaths?: string[];
  instruction?: string;
}): string {
  const lines: string[] = [
    `<task-resume context="${args.context}">`,
  ];
  if (args.lastTurnId) lines.push(`  <last_turn_id>${args.lastTurnId}</last_turn_id>`);
  if (args.userGoal) lines.push(`  <user_goal>${args.userGoal}</user_goal>`);
  if (args.artifacts?.length) {
    lines.push(`  <artifacts>${args.artifacts.join('\n')}</artifacts>`);
  }
  if (args.verifiedPaths?.length) {
    lines.push(`  <verified_paths>${args.verifiedPaths.join('\n')}</verified_paths>`);
  }
  if (args.missingPaths?.length) {
    lines.push(`  <missing_paths>${args.missingPaths.join('\n')}</missing_paths>`);
  }
  lines.push(
    `  <instruction>${args.instruction ?? '从上次未完成步骤继续，勿重复已完成成果'}</instruction>`,
    '</task-resume>',
  );
  return lines.join('\n');
}

/** @internal test helper */
export function _clearTaskResumeCoordinatorForTests(): void {
  boundaryState.clear();
}
