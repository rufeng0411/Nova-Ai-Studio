// PD-SAAS-FORK: instant first-turn acknowledgment (no model call)

export function buildTaskAcknowledgmentMessage(localeIsZh: boolean): string {
  return localeIsZh ? '人工智能努力中...' : 'OK, one moment.';
}
