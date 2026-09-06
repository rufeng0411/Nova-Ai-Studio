// PD-SAAS-FORK P0-D: terms that must not appear in user-visible deliverable copy.
export const DELIVERABLE_FORBIDDEN_USER_TERMS = [
  '验收失败',
  'needs_repair',
  'Failed tools',
  'Something went wrong',
  'repair circuit',
  'deliverable_validate_failed',
  'session_prepare',
  'router_judge',
] as const;

export function containsForbiddenDeliverableUserTerm(text: string): boolean {
  const raw = String(text ?? '');
  return DELIVERABLE_FORBIDDEN_USER_TERMS.some((term) => raw.includes(term));
}
