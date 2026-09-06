// PD-SAAS-FORK: parse user_action_required notice for UserActionRequiredCard

export type ParsedUserActionNotice = {
  title: string;
  reason: string;
  steps: string[];
  settingsDeepLink?: string;
  confirmedAttempts?: number;
};

type NoticeLike = {
  title?: string;
  reason?: string;
  steps?: string[];
  settingsDeepLink?: string;
  confirmedAttempts?: number;
};

function isNoticeLike(value: unknown): value is NoticeLike {
  return Boolean(value && typeof value === 'object' && typeof (value as NoticeLike).title === 'string');
}

export function parseUserActionNoticeFromMessage(message: {
  content?: string;
  purpose?: string;
  needsUserInput?: boolean;
  userActionNotice?: unknown;
  metadata?: { purpose?: string; needsUserInput?: boolean; userActionNotice?: unknown };
}): ParsedUserActionNotice | null {
  const structured = message.userActionNotice ?? message.metadata?.userActionNotice;
  if (isNoticeLike(structured)) {
    return {
      title: structured.title ?? '',
      reason: structured.reason ?? '',
      steps: Array.isArray(structured.steps) ? structured.steps.filter(Boolean) : [],
      settingsDeepLink: structured.settingsDeepLink,
      confirmedAttempts: structured.confirmedAttempts,
    };
  }

  const purpose = message.purpose ?? message.metadata?.purpose;
  const needsUserInput = message.needsUserInput ?? message.metadata?.needsUserInput;
  if (purpose !== 'user_action_required' && !needsUserInput) {
    return null;
  }

  const text = String(message.content ?? '').trim();
  if (!text) return null;

  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const titleCandidates = ['需要您完成一项配置', '需要您提供附件', 'Configuration required', 'Attachment required'];
  const title = titleCandidates.find((candidate) => lines[0]?.includes(candidate)) ?? lines[0] ?? '';
  const reason = lines.find((line, index) => index > 0 && !/^\d+\./.test(line) && line !== title) ?? '';
  const steps = lines
    .filter((line) => /^\d+\./.test(line))
    .map((line) => line.replace(/^\d+\.\s*/, ''));

  if (!title && steps.length === 0) return null;

  return {
    title,
    reason,
    steps,
    settingsDeepLink: text.includes('设置') || text.includes('Settings') ? 'settings:providers' : undefined,
  };
}

const BLOCKER_RESOLVED_USER_PATTERN = /(?:已配置(?:.*继续)?|已上传|已填入|configured|uploaded)/i;

type SessionMessageLike = {
  type?: string;
  role?: string;
  content?: string;
  purpose?: string;
  needsUserInput?: boolean;
  metadata?: {
    purpose?: string;
    needsUserInput?: boolean;
    synthetic?: boolean;
    expensiveIntentFingerprint?: string;
  };
};

function isUserRoleMessage(message: SessionMessageLike): boolean {
  return message.type === 'user' || message.role === 'user';
}

function isAssistantRoleMessage(message: SessionMessageLike): boolean {
  return message.type === 'assistant' || message.role === 'assistant';
}

/** True while the latest user_action_required card is still blocking auto-continue. */
export function sessionHasPendingUserActionRequired(messages: SessionMessageLike[]): boolean {
  if (!Array.isArray(messages) || messages.length === 0) return false;

  let blockerIndex = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || !isAssistantRoleMessage(message)) continue;
    const purpose = message.purpose ?? message.metadata?.purpose;
    const needsUserInput = message.needsUserInput ?? message.metadata?.needsUserInput;
    if (
      (purpose === 'user_action_required' || needsUserInput)
      && parseUserActionNoticeFromMessage(message) !== null
    ) {
      blockerIndex = i;
      break;
    }
  }
  if (blockerIndex < 0) return false;

  const EXPENSIVE_INTENT_FINGERPRINT = "expensive_intent:ppt_vs_named_files";

  let expensiveIntentFuse = false;
  const blockerMeta = messages[blockerIndex]?.metadata;
  if (String(blockerMeta?.expensiveIntentFingerprint ?? "") === EXPENSIVE_INTENT_FINGERPRINT) {
    expensiveIntentFuse = true;
  }

  for (let i = blockerIndex + 1; i < messages.length; i += 1) {
    const message = messages[i];
    if (!message || !isUserRoleMessage(message) || message.metadata?.synthetic) continue;
    const text = String(message.content ?? '').trim();
    if (!text) continue;
    if (expensiveIntentFuse) return false;
    if (BLOCKER_RESOLVED_USER_PATTERN.test(text)) return false;
  }

  return true;
}
