// PD-SAAS-FORK: restore and route ask_user_question / plan elicitation prompts
import type { PendingPermissionRequest } from '../components/chat/types/types';
import type { NormalizedMessage } from '../stores/useSessionStore';

function isTemporarySessionId(sessionId: string | null | undefined): boolean {
  return Boolean(sessionId && sessionId.startsWith('new-session-'));
}

const ELICITATION_TOOL_NAMES = new Set([
  'AskUserQuestion',
  'ask_user_question',
  'ExitPlanMode',
  'ExitPlanModeV2',
  'exit_plan_mode',
]);

export function isInteractiveElicitationToolName(toolName: string | undefined): boolean {
  if (!toolName) return false;
  return ELICITATION_TOOL_NAMES.has(toolName);
}

export function normalizeElicitationPanelToolName(toolName: string): string {
  if (toolName === 'ask_user_question') return 'AskUserQuestion';
  if (toolName === 'exit_plan_mode') return 'ExitPlanModeV2';
  return toolName;
}

export function isMessageForActiveChatView(
  messageSessionId: string | undefined,
  options: {
    currentSessionId: string | null;
    selectedSessionId?: string | null;
    pendingViewSessionId?: string | null;
  },
): boolean {
  const sid = String(messageSessionId || '').trim();
  if (!sid) return false;

  const { currentSessionId, selectedSessionId, pendingViewSessionId } = options;
  if (sid === currentSessionId) return true;
  if (sid === selectedSessionId) return true;
  if (pendingViewSessionId && sid === pendingViewSessionId) return true;

  const viewingTemporary =
    isTemporarySessionId(currentSessionId) || isTemporarySessionId(selectedSessionId ?? null);
  if (viewingTemporary && pendingViewSessionId && sid === pendingViewSessionId) {
    return true;
  }

  return false;
}

function hasQuestionsPayload(input: unknown): boolean {
  if (!input || typeof input !== 'object') return false;
  const questions = (input as { questions?: unknown }).questions;
  return Array.isArray(questions) && questions.length > 0;
}

function resolveElicitationToolCallId(
  messages: NormalizedMessage[],
  permissionIndex: number,
  permissionMessage: NormalizedMessage,
): string | undefined {
  const explicit = typeof (permissionMessage as { toolCallId?: string }).toolCallId === 'string'
    ? (permissionMessage as { toolCallId?: string }).toolCallId
    : undefined;

  for (let index = permissionIndex - 1; index >= 0; index -= 1) {
    const candidate = messages[index];
    if (candidate.kind === 'tool_use' && isInteractiveElicitationToolName(candidate.toolName) && candidate.toolId) {
      return candidate.toolId;
    }
    if (candidate.kind === 'permission_request' && candidate.requestId !== permissionMessage.requestId) {
      break;
    }
  }

  return explicit;
}

function isElicitationResolved(
  messages: NormalizedMessage[],
  permissionIndex: number,
  requestId: string,
  toolCallId: string | undefined,
  toolIdsWithResult: ReadonlySet<string>,
  cancelledIds: ReadonlySet<string>,
): boolean {
  if (cancelledIds.has(requestId)) return true;
  if (toolCallId && toolIdsWithResult.has(toolCallId)) return true;

  for (let index = permissionIndex + 1; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.kind === 'permission_cancelled' && message.requestId === requestId) {
      return true;
    }
    if (toolCallId && message.kind === 'tool_result' && message.toolId === toolCallId) {
      return true;
    }
  }

  return false;
}

export function extractOutstandingElicitations(
  messages: NormalizedMessage[],
  sessionId: string,
): PendingPermissionRequest[] {
  const cancelledIds = new Set<string>();
  const toolIdsWithResult = new Set<string>();

  for (const message of messages) {
    if (message.kind === 'permission_cancelled' && message.requestId) {
      cancelledIds.add(message.requestId);
    }
    if (message.kind === 'tool_result' && message.toolId) {
      // Include error results — skip/decline still means the user already responded.
      toolIdsWithResult.add(message.toolId);
    }
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.kind !== 'permission_request' || !message.requestId) continue;
    if (!isInteractiveElicitationToolName(message.toolName)) continue;
    if (!hasQuestionsPayload(message.input)) continue;

    const toolCallId = resolveElicitationToolCallId(messages, index, message);
    if (isElicitationResolved(messages, index, message.requestId, toolCallId, toolIdsWithResult, cancelledIds)) {
      continue;
    }

    return [{
      requestId: message.requestId,
      toolName: normalizeElicitationPanelToolName(message.toolName || 'AskUserQuestion'),
      input: message.input,
      context: message.context,
      sessionId: message.sessionId || sessionId,
      receivedAt: new Date(message.timestamp || Date.now()),
      toolCallId,
      isElicitation: Boolean((message as { isElicitation?: boolean }).isElicitation)
        || message.toolName === 'AskUserQuestion'
        || message.toolName === 'ask_user_question'
        || message.toolName === 'ExitPlanModeV2'
        || message.toolName === 'exit_plan_mode',
    }];
  }

  return [];
}

export function mergePendingPermissionRequests(
  liveRequests: PendingPermissionRequest[],
  restoredRequests: PendingPermissionRequest[],
): PendingPermissionRequest[] {
  const merged = [...liveRequests];
  const seen = new Set(liveRequests.map((request) => request.requestId));
  for (const request of restoredRequests) {
    if (seen.has(request.requestId)) continue;
    seen.add(request.requestId);
    merged.push(request);
  }
  return merged;
}

export function findPendingRequestForToolMessage(
  requests: PendingPermissionRequest[],
  message: { toolId?: string; toolName?: string },
): PendingPermissionRequest | null {
  if (!isInteractiveElicitationToolName(message.toolName)) return null;
  const toolId = message.toolId;
  if (toolId) {
    const matched = requests.find((request) => request.toolCallId === toolId);
    if (matched) return matched;
  }
  return requests.find((request) => isInteractiveElicitationToolName(request.toolName)) ?? null;
}

export function isElicitationDecisionPayload(updatedInput: unknown): boolean {
  if (!updatedInput || typeof updatedInput !== 'object' || Array.isArray(updatedInput)) {
    return false;
  }
  return Array.isArray((updatedInput as { questions?: unknown }).questions);
}
