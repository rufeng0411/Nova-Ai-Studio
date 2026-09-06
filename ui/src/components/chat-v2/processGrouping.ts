import type { TFunction } from 'i18next';
import type { ChatMessage, ChatRunMode } from '../chat/types/types';
import { isPlanModeToolDeny } from '../chat/utils/chatPermissions';
import { buildKeySteps, getLiveStepDetail } from '../../shared/processNarrative';
import { formatToolDisplayName, localizeProcessTraceStep } from '../../shared/processStepLabels';
import type { ProcessTraceMetric, ProcessTraceStep } from './ProcessTrace';
import { formatProcessDuration } from './processTraceUtils';
import {
  hasHardToolFailure,
  isDegenerateUserVisibleAssistantFragment,
  isRecoverableToolFailureMessage,
  isTransientPartialRestartNarration,
} from '../../shared/userFacingErrors';
import { shouldHideUnansweredAskUserQuestionToolMessage } from '../../shared/elicitationDisplay';
import type { AudienceMode } from '../../shared/audienceMode';
import { isProcessStepDetailV2Enabled } from '../../shared/perfFeatureFlags';
import {
  dedupeConsecutiveUserMessages,
  hasEquivalentVisibleUserMessage,
  shouldHideUserFacingUserMessage,
} from '../../shared/userMessageDisplayDedup';

export type ProcessAttachmentImage = {
  data: string;
  name?: string;
  mimeType?: string;
  /** Origin of the image — currently always a tool result (e.g. read_file on a PNG). */
  source: 'tool_result';
  /** Source tool's id, useful as a stable React key. */
  toolId?: string;
};

export type ProcessAttachment = {
  id: string;
  processSummary: ChatMessage;
  processDetailMessages: ChatMessage[];
  startIndex: number;
  endIndex: number;
  /**
   * Inline images returned by tools inside this collapsed segment (e.g.
   * `read_file` on a PNG). Surfaced alongside the collapsed summary so the
   * user can still see the picture without expanding the trace — otherwise
   * the image hides behind the "Explored N files" pill, even though the
   * model already replied "this is a 3D surface plot…" right after.
   */
  inlineImages: ProcessAttachmentImage[];
};

export type ProcessRunAttachment = {
  id: string;
  durationMs: number;
  startIndex: number;
  endIndex: number;
  /** PD-SAAS-FORK: collapsed process message count for completed header */
  stepCount?: number;
};

export type TurnRunMeta = {
  durationMs: number;
  stepCount: number;
};

export type RenderableMessageItem = {
  message: ChatMessage;
  originalIndex: number;
  beforeRunAttachment: ProcessRunAttachment | null;
  afterRunAttachment: ProcessRunAttachment | null;
  beforeProcessAttachments: ProcessAttachment[];
  afterProcessAttachments: ProcessAttachment[];
  /** PD-SAAS-FORK: merged process segments on the turn's final assistant host (T0) */
  mergedProcessAttachments: ProcessAttachment[];
  turnRunMeta: TurnRunMeta | null;
  /**
   * PD-SAAS-FORK: all messages of this turn, attached only to the turn's final
   * assistant reply. Deliverable collection (task-folder button) needs the
   * whole turn because tool segments attach to earlier narration hosts.
   */
  turnMessages: ChatMessage[];
};

export type LiveProcessGroup = {
  id: string;
  afterOriginalIndex: number;
  beforeOriginalIndex: number | null;
  startIndex: number;
  endIndex: number;
  messages: ChatMessage[];
  detailMessages: ChatMessage[];
  isRunning: boolean;
};

export type BuildRenderableMessageItemsOptions = {
  isAssistantWorking?: boolean;
  /** PD-SAAS-FORK: include thinking blocks in expandable process detail */
  showThinking?: boolean;
  processDetailLevel?: 'minimal' | 'standard' | 'detailed';
  /** PD-SAAS-FORK: non-technical tasks hide bash/write raw blocks in detailed expand. */
  audienceMode?: AudienceMode;
  /**
   * Full turn history for deliverable collection. When the UI renders a tail slice of
   * messages, pass the complete loaded session here so turnMessages are not truncated.
   */
  turnContextMessages?: ChatMessage[];
};

/** PD-SAAS-FORK: standard+ retain thinking summaries in replay keySteps */
function shouldRetainThinkingSummary(
  options?: BuildRenderableMessageItemsOptions,
): boolean {
  const level = options?.processDetailLevel ?? 'standard';
  return level !== 'minimal';
}

/** PD-SAAS-FORK: detailed (or showThinking) retains full thinking in expandable trace */
function shouldRetainThinkingInDetail(
  options?: BuildRenderableMessageItemsOptions,
): boolean {
  return Boolean(options?.showThinking || options?.processDetailLevel === 'detailed');
}

function shouldIncludeThinkingInProcessDetail(
  options?: BuildRenderableMessageItemsOptions,
): boolean {
  return shouldRetainThinkingInDetail(options);
}

type MessageTurn = {
  start: number;
  end: number;
  summary: ActivitySummaryAttachment | null;
};

type ActivitySummaryAttachment = {
  message: ChatMessage;
  originalIndex: number;
};

type CompletedProcessSegment = {
  id: string;
  startIndex: number;
  endIndex: number;
  messages: ChatMessage[];
  detailMessages: ChatMessage[];
  previousHostIndex: number | null;
  nextHostIndex: number | null;
};

type ProcessCounts = {
  editedTargets: string[];
  readTargets: string[];
  searchCount: number;
  commandCount: number;
  subagentCount: number;
  compactCount: number;
  thinkingCount: number;
  otherToolCount: number;
  toolCallCount: number;
  toolErrorCount: number;
  recoverableToolErrorCount: number;
};

const USER_VISIBLE_TOOL_NAMES = new Set([
  'AskUserQuestion',
  'ask_user_question',
  'ExitPlanMode',
  'ExitPlanModeV2',
  'exit_plan_mode',
]);

function parseMessageTime(value: unknown): number | null {
  if (!value) return null;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function getActivitySummaryKey(message: ChatMessage, index: number): string {
  return message.runId || message.id || `${message.startedAt || ''}-${message.endedAt || ''}-${index}`;
}

function getStableMessagePart(message: ChatMessage | undefined, fallback: string): string {
  const value = message?.id || message?.toolId || message?.activityId || message?.runId;
  return String(value || fallback);
}

function getStableProcessSegmentId(
  messages: ChatMessage[],
  turn: MessageTurn,
  firstMessage: ChatMessage,
  startIndex: number,
): string {
  const turnPart = getStableMessagePart(messages[turn.start], `turn-${turn.start}`);
  const firstPart = getStableMessagePart(firstMessage, `message-${startIndex}`);
  return `process-segment-${turnPart}-${firstPart}`;
}

function createMessageTurns(messages: ChatMessage[]): MessageTurn[] {
  if (messages.length === 0) {
    return [];
  }

  const starts: number[] = [];
  messages.forEach((message, index) => {
    if (message.type === 'user') {
      starts.push(index);
    }
  });

  if (starts.length === 0 || starts[0] > 0) {
    starts.unshift(0);
  }

  return starts.map((start, index) => ({
    start,
    end: starts[index + 1] ?? messages.length,
    summary: null,
  }));
}

function findTurnIndexByPosition(turns: MessageTurn[], index: number): number {
  return turns.findIndex((turn) => index >= turn.start && index < turn.end);
}

function findTurnIndexByTime(messages: ChatMessage[], turns: MessageTurn[], timestamp: number): number {
  let matchedIndex = -1;

  for (let turnIndex = 0; turnIndex < turns.length; turnIndex += 1) {
    const startMessage = messages[turns[turnIndex].start];
    if (startMessage?.type !== 'user') {
      continue;
    }

    const startTime = parseMessageTime(startMessage.timestamp);
    if (startTime == null) {
      continue;
    }

    if (startTime <= timestamp) {
      matchedIndex = turnIndex;
      continue;
    }

    if (startTime > timestamp) {
      break;
    }
  }

  return matchedIndex;
}

function getSummaryAnchorTime(summary: ChatMessage): number | null {
  return (
    parseMessageTime(summary.startedAt) ??
    parseMessageTime(summary.timestamp) ??
    parseMessageTime(summary.endedAt)
  );
}

function getSummarySortTime(summary: ChatMessage): number {
  return (
    parseMessageTime(summary.endedAt) ??
    parseMessageTime(summary.timestamp) ??
    parseMessageTime(summary.startedAt) ??
    0
  );
}

function isNewerSummary(
  next: ActivitySummaryAttachment,
  current: ActivitySummaryAttachment | null,
): boolean {
  if (!current) {
    return true;
  }
  const nextTime = getSummarySortTime(next.message);
  const currentTime = getSummarySortTime(current.message);
  if (nextTime !== currentTime) {
    return nextTime > currentTime;
  }
  return next.originalIndex > current.originalIndex;
}

function attachSummariesToTurns(messages: ChatMessage[], turns: MessageTurn[]): void {
  const summariesByKey = new Map<string, ActivitySummaryAttachment>();

  messages.forEach((message, originalIndex) => {
    if (message.isAgentActivitySummary) {
      summariesByKey.set(getActivitySummaryKey(message, originalIndex), { message, originalIndex });
    }
  });

  const summaries = Array.from(summariesByKey.values()).sort(
    (a, b) => a.originalIndex - b.originalIndex,
  );

  for (const summary of summaries) {
    const anchorTime = getSummaryAnchorTime(summary.message);
    const turnIndexFromTime = anchorTime == null ? -1 : findTurnIndexByTime(messages, turns, anchorTime);
    const turnIndex = turnIndexFromTime >= 0
      ? turnIndexFromTime
      : findTurnIndexByPosition(turns, summary.originalIndex);

    if (turnIndex < 0) {
      continue;
    }

    if (isNewerSummary(summary, turns[turnIndex].summary)) {
      turns[turnIndex].summary = summary;
    }
  }
}

function parseToolInput(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string') {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function getToolInputString(message: ChatMessage, key: string): string {
  const value = parseToolInput(message.toolInput)[key];
  return typeof value === 'string' ? value : '';
}

export function getToolTarget(message: ChatMessage): string {
  return (
    getToolInputString(message, 'file_path') ||
    getToolInputString(message, 'path') ||
    getToolInputString(message, 'pattern') ||
    getToolInputString(message, 'query') ||
    getToolInputString(message, 'command') ||
    ''
  );
}

function getDisplayTarget(target: string): string {
  if (!target) return '';
  const normalized = target.replace(/\\/g, '/');
  return normalized.split('/').filter(Boolean).pop() || target;
}

function hasToolError(message: ChatMessage): boolean {
  return hasHardToolFailure(message);
}

function hasRecoverableToolError(message: ChatMessage): boolean {
  return isRecoverableToolFailureMessage(message);
}

function isPermissionToolError(message: ChatMessage): boolean {
  if (!message.toolResult?.isError) {
    return false;
  }
  if (isPlanModeToolDeny(message)) {
    return false;
  }

  const errorCode = typeof message.toolResult.errorCode === 'string'
    ? message.toolResult.errorCode
    : '';
  if (
    errorCode === 'permission_denied' ||
    errorCode === 'permission_required' ||
    errorCode === 'permission_cancelled'
  ) {
    return true;
  }

  const content = typeof message.toolResult.content === 'string'
    ? message.toolResult.content
    : '';
  const lower = content.toLowerCase();
  return (
    lower.includes('permission') &&
    (
      lower.includes('denied') ||
      lower.includes('not allowed') ||
      lower.includes('requires') ||
      lower.includes('grant')
    )
  );
}

function isUserVisibleTool(message: ChatMessage): boolean {
  if (!message.isToolUse) return false;
  const toolName = String(message.toolName || '');
  return USER_VISIBLE_TOOL_NAMES.has(toolName);
}

export function isProcessMessage(message: ChatMessage): boolean {
  if (message.isAgentActivity || message.isAgentActivitySummary) {
    return false;
  }
  if (message.type === 'user' || message.type === 'error') {
    return false;
  }
  if (message.isInteractivePrompt || isUserVisibleTool(message) || isPermissionToolError(message)) {
    return false;
  }
  return Boolean(
    message.isToolUse ||
      message.isSubagentContainer ||
      message.isTaskNotification ||
      message.isCompactBoundary ||
      message.isThinking ||
      message.type === 'tool',
  );
}

function isExpandableProcessMessage(
  message: ChatMessage,
  options?: { includeThinking?: boolean },
): boolean {
  if (message.isThinking) {
    return Boolean(options?.includeThinking);
  }
  if (!message.isToolUse || message.isSubagentContainer || isPermissionToolError(message)) {
    return false;
  }
  const toolName = String(message.toolName || '');
  if (!toolName || toolName === 'Task' || USER_VISIBLE_TOOL_NAMES.has(toolName)) {
    return false;
  }
  return true;
}

function shouldHideRawToolDetailForAudience(
  message: ChatMessage,
  options?: BuildRenderableMessageItemsOptions,
): boolean {
  if (!isProcessStepDetailV2Enabled()) return false;
  if (options?.audienceMode !== 'non_technical') return false;
  if (options?.processDetailLevel !== 'detailed' && !options?.showThinking) return false;
  const toolName = String(message.toolName || '').toLowerCase();
  if (!toolName) return false;
  return /^(bash|run_terminal_cmd|shell|exec|command|write_file|write|edit_file|edit|apply_patch|multiedit)/.test(toolName);
}

function filterProcessDetailMessages(
  messages: ChatMessage[],
  options?: { includeThinking?: boolean; audienceMode?: AudienceMode; processDetailLevel?: BuildRenderableMessageItemsOptions['processDetailLevel']; showThinking?: boolean },
): ChatMessage[] {
  return messages.filter((message) => {
    if (shouldHideRawToolDetailForAudience(message, options)) return false;
    return isExpandableProcessMessage(message, options);
  });
}

function canHostProcessSummary(message: ChatMessage): boolean {
  return (
    message.type === 'assistant' &&
    !message.isAgentActivitySummary &&
    !message.isAgentActivity &&
    !message.isToolUse &&
    !message.isInteractivePrompt &&
    !message.isSubagentContainer &&
    !message.isTaskNotification &&
    !message.isThinking &&
    typeof message.content === 'string' &&
    message.content.trim().length > 0
  );
}

/** First assistant prose in a live turn before any tool/thinking process message — keep visible. */
export function isLiveTurnFirstPreToolAck(
  messages: ChatMessage[],
  messageIndex: number,
  liveTurn: { start: number; end: number } | null,
): boolean {
  if (!liveTurn || messageIndex < liveTurn.start || messageIndex >= liveTurn.end) {
    return false;
  }
  const message = messages[messageIndex];
  if (!canHostProcessSummary(message)) {
    return false;
  }
  for (let index = liveTurn.start; index < messageIndex; index += 1) {
    const prior = messages[index];
    if (isProcessMessage(prior) || canHostProcessSummary(prior)) {
      return false;
    }
  }
  return messages.slice(messageIndex + 1, liveTurn.end).some(isProcessMessage);
}

function shouldHideLiveIntermediateNarration(
  messages: ChatMessage[],
  messageIndex: number,
  liveTurn: { start: number; end: number },
): boolean {
  const message = messages[messageIndex];
  if (!canHostProcessSummary(message)) {
    return false;
  }
  const content = typeof message.content === 'string' ? message.content : '';
  if (isDegenerateUserVisibleAssistantFragment(content)) {
    return true;
  }
  // PD-SAAS-FORK: failed mid-stream apologies/restarts are never user-facing acks.
  if (isTransientPartialRestartNarration(content)) {
    return true;
  }
  if (message.isStreaming && content.trim().length > 0 && content.trim().length < 240) {
    if (messages.slice(messageIndex + 1, liveTurn.end).some(isProcessMessage)) {
      return true;
    }
  }
  if (!messages.slice(messageIndex + 1, liveTurn.end).some(isProcessMessage)) {
    return false;
  }
  return !isLiveTurnFirstPreToolAck(messages, messageIndex, liveTurn);
}

function isCollapsibleCompletedProcessMessage(message: ChatMessage): boolean {
  return isProcessMessage(message);
}

export function getProcessToolKind(
  message: ChatMessage,
): 'edit' | 'read' | 'search' | 'command' | 'subagent' | 'compact' | 'thinking' | 'tool' {
  if (message.isCompactBoundary) return 'compact';
  if (message.isThinking) return 'thinking';
  if (message.isSubagentContainer || message.toolName === 'Task' || message.isTaskNotification) {
    return 'subagent';
  }

  const toolName = String(message.toolName || '').toLowerCase();
  if (/edit|write|applypatch|patch|update|create|modify|multi_edit|multiedit/.test(toolName)) {
    return 'edit';
  }
  if (/read|cat|view/.test(toolName)) {
    return 'read';
  }
  if (/grep|glob|search|websearch|web_search|fetch_page_images|rag|find|rg/.test(toolName) || message.phase === 'rag') {
    return 'search';
  }
  if (/bash|shell|terminal|exec|command|run/.test(toolName)) {
    return 'command';
  }
  return 'tool';
}

function uniqueCount(values: string[]): number {
  const normalized = values.map((value) => value.trim()).filter(Boolean);
  return normalized.length > 0 ? new Set(normalized).size : values.length;
}

function collectProcessCounts(messages: ChatMessage[]): ProcessCounts {
  const counts: ProcessCounts = {
    editedTargets: [],
    readTargets: [],
    searchCount: 0,
    commandCount: 0,
    subagentCount: 0,
    compactCount: 0,
    thinkingCount: 0,
    otherToolCount: 0,
    toolCallCount: 0,
    toolErrorCount: 0,
    recoverableToolErrorCount: 0,
  };

  for (const message of messages) {
    if (message.isToolUse || message.toolName) {
      counts.toolCallCount += 1;
    }
    if (hasToolError(message)) {
      counts.toolErrorCount += 1;
    } else if (hasRecoverableToolError(message)) {
      counts.recoverableToolErrorCount += 1;
    }

    const kind = getProcessToolKind(message);
    if (kind === 'edit') {
      counts.editedTargets.push(getToolTarget(message));
    } else if (kind === 'read') {
      counts.readTargets.push(getToolTarget(message));
    } else if (kind === 'search') {
      counts.searchCount += 1;
    } else if (kind === 'command') {
      counts.commandCount += 1;
    } else if (kind === 'subagent') {
      counts.subagentCount += 1;
    } else if (kind === 'compact') {
      counts.compactCount += 1;
    } else if (kind === 'thinking') {
      counts.thinkingCount += 1;
    } else {
      counts.otherToolCount += 1;
    }
  }

  return counts;
}

function getDurationMs(start: unknown, end: unknown): number {
  const startTime = parseMessageTime(start);
  const endTime = parseMessageTime(end);
  if (startTime == null || endTime == null) {
    return 0;
  }
  return Math.max(0, endTime - startTime);
}

function getTurnEndIndex(messages: ChatMessage[], turn: MessageTurn): number {
  for (let index = turn.end - 1; index >= turn.start; index -= 1) {
    const message = messages[index];
    if (!message || message.isAgentActivity || message.isAgentActivitySummary) {
      continue;
    }
    return index;
  }
  return turn.end - 1;
}

function getTurnRunDurationMs(messages: ChatMessage[], turn: MessageTurn): number | null {
  const summaryDuration = turn.summary?.message.durationMs;
  if (typeof summaryDuration === 'number' && Number.isFinite(summaryDuration)) {
    return Math.max(0, summaryDuration);
  }

  const summaryStart = turn.summary?.message.startedAt;
  const summaryEnd = turn.summary?.message.endedAt;
  const fallbackEndIndex = getTurnEndIndex(messages, turn);
  const startedAt = summaryStart ?? messages[turn.start]?.timestamp;
  const endedAt = summaryEnd ?? messages[fallbackEndIndex]?.timestamp;
  const durationMs = getDurationMs(startedAt, endedAt);
  return durationMs > 0 ? durationMs : null;
}

function countTurnProcessSteps(messages: ChatMessage[], turn: MessageTurn): number {
  let count = 0;
  for (let index = turn.start; index < turn.end; index += 1) {
    const message = messages[index];
    if (message && isProcessMessage(message)) {
      count += 1;
    }
  }
  return count;
}

function hasCompletedTurnWork(messages: ChatMessage[], turn: MessageTurn): boolean {
  if (turn.summary) {
    return true;
  }

  for (let index = turn.start; index < turn.end; index += 1) {
    const message = messages[index];
    if (!message || message.isAgentActivity || message.isAgentActivitySummary || message.type === 'user') {
      continue;
    }
    if (canHostProcessSummary(message) || isProcessMessage(message)) {
      return true;
    }
  }

  return false;
}

function hasAgentActivitySummaryDetails(message: ChatMessage): boolean {
  const numericDetailFields = [
    'toolCallCount',
    'toolErrorCount',
    'ragSearchCount',
    'editedFileCount',
    'exploredFileCount',
    'commandCount',
    'subagentCount',
    'compactCount',
    'thinkingCount',
    'otherToolCount',
  ];
  const hasMetrics = numericDetailFields.some((key) => {
    const value = message[key];
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
  });
  if (hasMetrics) {
    return true;
  }

  if (Array.isArray(message.keySteps) && message.keySteps.length > 0) {
    return true;
  }

  const state = String(message.state || 'completed');
  return state !== 'completed';
}

function createSyntheticProcessSummary(
  messages: ChatMessage[],
  turn: MessageTurn,
  hostIndex: number,
  detailMessages: ChatMessage[],
  segmentStartIndex: number,
  segmentEndIndex: number,
  attachmentId: string,
  options?: BuildRenderableMessageItemsOptions,
): ChatMessage {
  const host = messages[hostIndex];
  const counts = collectProcessCounts(detailMessages);
  const startedAt = messages[segmentStartIndex]?.timestamp ?? messages[turn.start]?.timestamp;
  const endedAt = messages[segmentEndIndex]?.timestamp ?? host?.timestamp;

  return {
    id: `process-summary-${attachmentId}`,
    type: 'system',
    content: '',
    timestamp: endedAt || new Date().toISOString(),
    isAgentActivitySummary: true,
    startedAt: startedAt ? String(startedAt) : '',
    endedAt: endedAt ? String(endedAt) : '',
    durationMs: getDurationMs(startedAt, endedAt),
    state: counts.toolErrorCount > 0 ? 'failed' : 'completed',
    toolCallCount: counts.toolCallCount,
    toolErrorCount: counts.toolErrorCount,
    ragSearchCount: counts.searchCount,
    editedFileCount: uniqueCount(counts.editedTargets),
    exploredFileCount: uniqueCount(counts.readTargets),
    commandCount: counts.commandCount,
    subagentCount: counts.subagentCount,
    compactCount: counts.compactCount,
    thinkingCount: counts.thinkingCount,
    otherToolCount: counts.otherToolCount,
    keySteps: buildKeySteps(detailMessages, [], {
      includeThinkingInSteps: shouldRetainThinkingSummary(options),
    }),
  };
}

function collectToolResultImages(messages: ChatMessage[]): ProcessAttachmentImage[] {
  const images: ProcessAttachmentImage[] = [];
  for (const message of messages) {
    const list = (message.toolResult?.images ?? []) as Array<{ data?: unknown; name?: unknown; mimeType?: unknown }>;
    if (!Array.isArray(list)) continue;
    for (const image of list) {
      if (!image || typeof image.data !== 'string' || image.data.length === 0) continue;
      images.push({
        data: image.data,
        name: typeof image.name === 'string' && image.name.length > 0 ? image.name : undefined,
        mimeType: typeof image.mimeType === 'string' ? image.mimeType : undefined,
        source: 'tool_result',
        toolId: typeof message.toolId === 'string' ? message.toolId : undefined,
      });
    }
  }
  return images;
}

function findNextHostIndex(messages: ChatMessage[], turn: MessageTurn, fromIndex: number): number | null {
  for (let index = fromIndex; index < turn.end; index += 1) {
    const message = messages[index];
    if (message && canHostProcessSummary(message)) {
      return index;
    }
  }
  return null;
}

function collectCompletedProcessSegments(
  messages: ChatMessage[],
  turn: MessageTurn,
  options?: BuildRenderableMessageItemsOptions,
): CompletedProcessSegment[] {
  const segments: CompletedProcessSegment[] = [];
  let previousHostIndex: number | null = null;
  let segmentStartIndex = -1;
  let segmentMessages: ChatMessage[] = [];

  const finishSegment = (beforeOriginalIndex: number) => {
    if (segmentMessages.length === 0 || segmentStartIndex < 0) {
      segmentStartIndex = -1;
      segmentMessages = [];
      return;
    }

    const endIndex = beforeOriginalIndex - 1;
    const first = segmentMessages[0];
    const nextHostIndex = previousHostIndex == null
      ? findNextHostIndex(messages, turn, beforeOriginalIndex)
      : null;

    segments.push({
      id: getStableProcessSegmentId(messages, turn, first, segmentStartIndex),
      startIndex: segmentStartIndex,
      endIndex,
      messages: segmentMessages,
      detailMessages: filterProcessDetailMessages(segmentMessages, {
        includeThinking: shouldRetainThinkingInDetail(options),
        audienceMode: options?.audienceMode,
        processDetailLevel: options?.processDetailLevel,
        showThinking: options?.showThinking,
      }),
      previousHostIndex,
      nextHostIndex,
    });

    segmentStartIndex = -1;
    segmentMessages = [];
  };

  for (let index = turn.start; index < turn.end; index += 1) {
    const message = messages[index];
    if (!message || message.isAgentActivity || message.isAgentActivitySummary) {
      continue;
    }

    if (isCollapsibleCompletedProcessMessage(message)) {
      if (segmentMessages.length === 0) {
        segmentStartIndex = index;
      }
      segmentMessages.push(message);
      continue;
    }

    finishSegment(index);

    if (canHostProcessSummary(message)) {
      previousHostIndex = index;
    }
  }

  finishSegment(turn.end);
  return segments;
}

function pushProcessAttachment(
  item: RenderableMessageItem,
  placement: 'before' | 'after',
  attachment: ProcessAttachment,
): void {
  if (placement === 'before') {
    item.beforeProcessAttachments.push(attachment);
  } else {
    item.afterProcessAttachments.push(attachment);
  }
}

function dedupeProcessAttachments(attachments: ProcessAttachment[]): ProcessAttachment[] {
  const seen = new Set<string>();
  const out: ProcessAttachment[] = [];
  for (const attachment of attachments) {
    if (seen.has(attachment.id)) continue;
    seen.add(attachment.id);
    out.push(attachment);
  }
  return out;
}

function findFinalProcessHostIndex(messages: ChatMessage[], turn: MessageTurn): number {
  for (let index = turn.end - 1; index >= turn.start; index -= 1) {
    const candidate = messages[index];
    if (!candidate || !canHostProcessSummary(candidate)) continue;
    const content = typeof candidate.content === 'string' ? candidate.content : '';
    if (isDegenerateUserVisibleAssistantFragment(content)) continue;
    return index;
  }
  return -1;
}

function shouldCollapseIntermediateProcessHost(
  messages: ChatMessage[],
  index: number,
  finalHostIndex: number,
): boolean {
  if (index === finalHostIndex) return false;
  const message = messages[index];
  if (!message || !canHostProcessSummary(message)) return false;
  if (message.type === 'error') return false;
  const content = typeof message.content === 'string' ? message.content : '';
  if (isDegenerateUserVisibleAssistantFragment(content)) return true;
  return true;
}

function resolveRenderableHostItem(
  hostMessage: ChatMessage,
  contextIndex: number,
  visibleMessages: ChatMessage[],
  turnContext: ChatMessage[],
  itemsByIndex: Map<number, RenderableMessageItem>,
  itemsById: Map<string, RenderableMessageItem>,
): RenderableMessageItem | undefined {
  if (hostMessage.id) {
    const byId = itemsById.get(hostMessage.id);
    if (byId) return byId;
  }
  const contextOffset = turnContext.length - visibleMessages.length;
  const visibleIndex = contextIndex - contextOffset;
  if (visibleIndex >= 0 && visibleIndex < visibleMessages.length) {
    return itemsByIndex.get(visibleIndex);
  }
  return undefined;
}

/** PD-SAAS-FORK: attach full-turn tool history to final assistant hosts for deliverables. */
function attachTurnMessagesFromContext(
  visibleMessages: ChatMessage[],
  items: RenderableMessageItem[],
  itemsByIndex: Map<number, RenderableMessageItem>,
  turnContext: ChatMessage[],
  options: BuildRenderableMessageItemsOptions,
): void {
  const itemsById = new Map<string, RenderableMessageItem>();
  for (const item of items) {
    if (item.message.id) {
      itemsById.set(item.message.id, item);
    }
  }

  const contextTurns = createMessageTurns(turnContext);
  contextTurns.forEach((turn, turnIndex) => {
    const isLatestTurn = turnIndex === contextTurns.length - 1;
    if (options.isAssistantWorking && isLatestTurn) {
      return;
    }

    for (let index = turn.end - 1; index >= turn.start; index -= 1) {
      const candidate = turnContext[index];
      if (candidate && canHostProcessSummary(candidate)) {
        const hostItem = resolveRenderableHostItem(
          candidate,
          index,
          visibleMessages,
          turnContext,
          itemsByIndex,
          itemsById,
        );
        if (hostItem) {
          hostItem.turnMessages = turnContext.slice(turn.start, turn.end);
        }
        break;
      }
    }
  });
}

export function buildRenderableMessageItems(
  messages: ChatMessage[],
  options: BuildRenderableMessageItemsOptions = {},
): RenderableMessageItem[] {
  const expandedMessages = expandVisibleMessagesForLiveTurn(messages, options);
  const items: RenderableMessageItem[] = [];
  const itemsByIndex = new Map<number, RenderableMessageItem>();
  const syntheticItems: RenderableMessageItem[] = [];
  const collapsedIndices = new Set<number>();
  const turns = createMessageTurns(expandedMessages);
  const liveTurn = options.isAssistantWorking ? turns[turns.length - 1] : null;

  expandedMessages.forEach((message, originalIndex) => {
    if (shouldHideUnansweredAskUserQuestionToolMessage(message)) {
      return;
    }
    if (message.isAgentActivitySummary) {
      return;
    }
    if (liveTurn && originalIndex >= liveTurn.start && originalIndex < liveTurn.end) {
      if (isProcessMessage(message)) {
        collapsedIndices.add(originalIndex);
        return;
      }
      // PD-SAAS-FORK: hide intermediate narration between tools; keep first pre-tool ack visible.
      if (shouldHideLiveIntermediateNarration(expandedMessages, originalIndex, liveTurn)) {
        collapsedIndices.add(originalIndex);
        return;
      }
    }

    const item: RenderableMessageItem = {
      message,
      originalIndex,
      beforeRunAttachment: null,
      afterRunAttachment: null,
      beforeProcessAttachments: [],
      afterProcessAttachments: [],
      mergedProcessAttachments: [],
      turnRunMeta: null,
      turnMessages: [],
    };
    items.push(item);
    itemsByIndex.set(originalIndex, item);
  });

  attachSummariesToTurns(expandedMessages, turns);

  turns.forEach((turn, turnIndex) => {
    const isLatestTurn = turnIndex === turns.length - 1;
    if (options.isAssistantWorking && isLatestTurn) {
      return;
    }

    const durationMs = getTurnRunDurationMs(expandedMessages, turn);
    const stepCount = countTurnProcessSteps(expandedMessages, turn);
    const finalHostIndex = findFinalProcessHostIndex(expandedMessages, turn);
    const finalHostItem = finalHostIndex >= 0 ? itemsByIndex.get(finalHostIndex) : null;

    if (
      durationMs != null
      && hasCompletedTurnWork(expandedMessages, turn)
      && finalHostItem
    ) {
      finalHostItem.turnRunMeta = { durationMs, stepCount };
    }

    const segments = collectCompletedProcessSegments(expandedMessages, turn, options);
    const turnAttachments: ProcessAttachment[] = [];

    if (segments.length === 0) {
      if (turn.summary && hasAgentActivitySummaryDetails(turn.summary.message)) {
        items.push({
          message: turn.summary.message,
          originalIndex: turn.summary.originalIndex,
          beforeRunAttachment: null,
          afterRunAttachment: null,
          beforeProcessAttachments: [],
          afterProcessAttachments: [],
          mergedProcessAttachments: [],
          turnRunMeta: null,
          turnMessages: [],
        });
      }
      return;
    }

    for (const segment of segments) {
      for (let index = segment.startIndex; index <= segment.endIndex; index += 1) {
        collapsedIndices.add(index);
      }

      const hostIndex = segment.previousHostIndex ?? segment.nextHostIndex ?? segment.endIndex;
      const summary = createSyntheticProcessSummary(
        expandedMessages,
        turn,
        hostIndex,
        segment.messages,
        segment.startIndex,
        segment.endIndex,
        segment.id,
        options,
      );
      const attachment: ProcessAttachment = {
        id: segment.id,
        processSummary: summary,
        processDetailMessages: segment.detailMessages,
        startIndex: segment.startIndex,
        endIndex: segment.endIndex,
        inlineImages: collectToolResultImages(segment.messages),
      };
      turnAttachments.push(attachment);

      if (segment.previousHostIndex == null && segment.nextHostIndex == null) {
        syntheticItems.push({
          message: summary,
          originalIndex: segment.startIndex - 0.1,
          beforeRunAttachment: null,
          afterRunAttachment: null,
          beforeProcessAttachments: [],
          afterProcessAttachments: [],
          mergedProcessAttachments: [],
          turnRunMeta: null,
          turnMessages: [],
        });
      }
    }

    if (finalHostItem && turnAttachments.length > 0) {
      finalHostItem.mergedProcessAttachments = dedupeProcessAttachments(turnAttachments);
    }

    if (finalHostIndex >= 0) {
      for (let index = turn.start; index < turn.end; index += 1) {
        if (shouldCollapseIntermediateProcessHost(expandedMessages, index, finalHostIndex)) {
          collapsedIndices.add(index);
        }
      }
    }
  });

  const turnContext = options.turnContextMessages ?? expandedMessages;
  attachTurnMessagesFromContext(expandedMessages, items, itemsByIndex, turnContext, options);

  return [...items, ...syntheticItems]
    .filter((item) => !collapsedIndices.has(item.originalIndex))
    .sort((a, b) => a.originalIndex - b.originalIndex);
}

/** PD-SAAS-FORK: tail pagination can drop the live-turn user anchor; keep it visible. */
function expandVisibleMessagesForLiveTurn(
  messages: ChatMessage[],
  options: BuildRenderableMessageItemsOptions,
): ChatMessage[] {
  if (!options.isAssistantWorking) return messages;
  const turnContext = options.turnContextMessages;
  if (!turnContext?.length) return messages;

  const contextTurns = createMessageTurns(turnContext);
  const liveTurn = contextTurns[contextTurns.length - 1];
  if (!liveTurn) return messages;

  const userAnchor = turnContext[liveTurn.start];
  if (!userAnchor || userAnchor.type !== 'user') return messages;
  if (shouldHideUserFacingUserMessage(userAnchor.content)) return messages;

  const visibleIds = new Set(messages.map((message) => message.id).filter(Boolean));
  if (userAnchor.id && visibleIds.has(userAnchor.id)) return messages;
  if (hasEquivalentVisibleUserMessage(messages, userAnchor)) return messages;

  const prefix: ChatMessage[] = [userAnchor];
  for (let index = liveTurn.start + 1; index < liveTurn.end; index += 1) {
    const message = turnContext[index];
    if (!message) continue;
    if (message.id && visibleIds.has(message.id)) break;
    if (isProcessMessage(message)) continue;
    if (shouldHideLiveIntermediateNarration(turnContext, index, liveTurn)) continue;
    prefix.push(message);
    if (isLiveTurnFirstPreToolAck(turnContext, index, liveTurn)) break;
  }

  const prefixIds = new Set(prefix.map((message) => message.id).filter(Boolean));
  return dedupeConsecutiveUserMessages(
    [...prefix, ...messages.filter((message) => !message.id || !prefixIds.has(message.id))],
  );
}

export function getLiveProcessDetailMessages(
  messages: ChatMessage[],
  options: BuildRenderableMessageItemsOptions = {},
): ChatMessage[] {
  return getLiveProcessGroups(messages, { isAssistantWorking: true, ...options })
    .flatMap((group) => group.detailMessages);
}

export function getLiveProcessGroups(
  messages: ChatMessage[],
  options: BuildRenderableMessageItemsOptions = {},
): LiveProcessGroup[] {
  const expandedMessages = expandVisibleMessagesForLiveTurn(messages, options);
  const turns = createMessageTurns(expandedMessages);
  const liveTurn = turns[turns.length - 1];
  if (!liveTurn) {
    return [];
  }

  const groups: Omit<LiveProcessGroup, 'isRunning'>[] = [];
  let previousVisibleIndex = liveTurn.start;
  let groupStartIndex = -1;
  let groupMessages: ChatMessage[] = [];

  const finishGroup = (beforeOriginalIndex: number | null) => {
    if (groupMessages.length === 0 || previousVisibleIndex < 0) {
      groupStartIndex = -1;
      groupMessages = [];
      return;
    }

    const first = groupMessages[0];
    groups.push({
      id: getStableProcessSegmentId(expandedMessages, liveTurn, first, groupStartIndex),
      afterOriginalIndex: previousVisibleIndex,
      beforeOriginalIndex,
      startIndex: groupStartIndex,
      endIndex: beforeOriginalIndex ?? expandedMessages.length,
      messages: groupMessages,
      detailMessages: filterProcessDetailMessages(groupMessages, {
        includeThinking: shouldIncludeThinkingInProcessDetail(options),
        audienceMode: options?.audienceMode,
        processDetailLevel: options?.processDetailLevel,
        showThinking: options?.showThinking,
      }),
    });
    groupStartIndex = -1;
    groupMessages = [];
  };

  for (let index = liveTurn.start; index < liveTurn.end; index += 1) {
    const message = expandedMessages[index];
    if (!message || message.isAgentActivity || message.isAgentActivitySummary) {
      continue;
    }

    if (isProcessMessage(message)) {
      if (groupMessages.length === 0) {
        groupStartIndex = index;
      }
      groupMessages.push(message);
      continue;
    }

    finishGroup(index);

    // PD-SAAS-FORK: intermediate narration hosts are hidden during live turns, except first pre-tool ack.
    if (
      options.isAssistantWorking &&
      shouldHideLiveIntermediateNarration(expandedMessages, index, liveTurn)
    ) {
      continue;
    }

    previousVisibleIndex = index;
  }

  finishGroup(null);

  return groups.map((group, index) => {
    const isLatestGroup = index === groups.length - 1;
    const isOpenEnded = group.beforeOriginalIndex == null;
    return {
      ...group,
      isRunning: Boolean(options.isAssistantWorking && isLatestGroup && isOpenEnded),
    };
  });
}

export function shouldRenderLiveProcessGroup(group: LiveProcessGroup, runMode: ChatRunMode): boolean {
  if (runMode !== 'plan') {
    return true;
  }
  return !group.messages.every((message) => message.isCompactBoundary);
}

function numberField(message: ChatMessage, key: string): number {
  const value = message[key];
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function formatCompletedProcessTitle(
  messageOrMessages: ChatMessage | ChatMessage[],
  t: TFunction<'chat'>,
): string {
  const counts = Array.isArray(messageOrMessages)
    ? collectProcessCounts(messageOrMessages)
    : {
        editedTargets: [],
        readTargets: [],
        searchCount: numberField(messageOrMessages, 'ragSearchCount'),
        commandCount: numberField(messageOrMessages, 'commandCount'),
        subagentCount: numberField(messageOrMessages, 'subagentCount'),
        compactCount: numberField(messageOrMessages, 'compactCount'),
        thinkingCount: numberField(messageOrMessages, 'thinkingCount'),
        otherToolCount: numberField(messageOrMessages, 'otherToolCount'),
        toolCallCount: numberField(messageOrMessages, 'toolCallCount'),
        toolErrorCount: numberField(messageOrMessages, 'toolErrorCount'),
        recoverableToolErrorCount: numberField(messageOrMessages, 'recoverableToolErrorCount'),
      };

  const editCount = Array.isArray(messageOrMessages)
    ? uniqueCount(counts.editedTargets)
    : numberField(messageOrMessages, 'editedFileCount');
  const readCount = Array.isArray(messageOrMessages)
    ? uniqueCount(counts.readTargets)
    : numberField(messageOrMessages, 'exploredFileCount');
  const labels: string[] = [];

  if (editCount > 0) {
    labels.push(t('process.live.editedFiles', {
      count: editCount,
      defaultValue: `Edited ${editCount} ${editCount === 1 ? 'file' : 'files'}`,
    }));
  }
  if (readCount > 0) {
    labels.push(t('process.live.exploredFiles', {
      count: readCount,
      defaultValue: `Explored ${readCount} ${readCount === 1 ? 'file' : 'files'}`,
    }));
  }
  if (counts.searchCount > 0) {
    labels.push(t('process.live.searches', {
      count: counts.searchCount,
      defaultValue: `Searched ${counts.searchCount} ${counts.searchCount === 1 ? 'time' : 'times'}`,
    }));
  }
  if (counts.commandCount > 0) {
    labels.push(t('process.live.commands', {
      count: counts.commandCount,
      defaultValue: `Ran ${counts.commandCount} ${counts.commandCount === 1 ? 'command' : 'commands'}`,
    }));
  }
  if (counts.subagentCount > 0) {
    labels.push(t('process.live.subagentCompleted', { defaultValue: 'Subagent finished' }));
  }
  if (counts.compactCount > 0) {
    labels.push(t('process.live.compactCompleted', { defaultValue: 'Compacted context' }));
  }
  if (counts.thinkingCount > 0 && labels.length === 0) {
    labels.push(t('process.live.thoughtCompleted', { defaultValue: 'Thought through next step' }));
  }
  if (labels.length === 0 && counts.otherToolCount > 0) {
    labels.push(t('process.live.toolCalls', {
      count: counts.otherToolCount,
      defaultValue: `Used ${counts.otherToolCount} ${counts.otherToolCount === 1 ? 'tool' : 'tools'}`,
    }));
  }
  if (counts.toolErrorCount > 0) {
    labels.push(t('process.live.adjusting', {
      count: counts.toolErrorCount,
      defaultValue: 'Still thinking and working',
    }));
  } else if (counts.recoverableToolErrorCount > 0) {
    labels.push(t('process.live.recovered', {
      defaultValue: 'Switched approach and continued',
    }));
  }

  return labels.join(' ');
}

export { formatToolDisplayName } from '../../shared/processStepLabels';

export function getRunningProcessTitle(
  group: LiveProcessGroup,
  t: TFunction<'chat'>,
): string {
  const latestMessage = [...group.messages].reverse().find((message) => isProcessMessage(message));
  if (!latestMessage) {
    return t('working.processing', { defaultValue: '处理中' });
  }

  const kind = getProcessToolKind(latestMessage);
  const target = getDisplayTarget(getToolTarget(latestMessage));
  if (kind === 'edit') {
    return target
      ? t('process.live.runningEditTarget', { target, defaultValue: `正在编辑 ${target}` })
      : t('process.live.runningEdit', { defaultValue: '正在编辑文件' });
  }
  if (kind === 'read') {
    return target
      ? t('process.live.runningReadTarget', { target, defaultValue: `正在读取 ${target}` })
      : t('process.live.runningRead', { defaultValue: '正在读取文件' });
  }
  if (kind === 'search') {
    const toolLabel = formatToolDisplayName(latestMessage.toolName, t);
    return target
      ? t('process.live.runningSearchTarget', { target, defaultValue: `${toolLabel}：${target}` })
      : toolLabel;
  }
  if (kind === 'command') {
    return target
      ? t('process.live.runningCommandTarget', { target, defaultValue: `正在运行 ${target}` })
      : t('process.live.runningCommand', { defaultValue: '正在运行命令' });
  }
  if (kind === 'subagent') {
    return latestMessage.title || t('process.live.runningSubagent', { defaultValue: '子任务进行中' });
  }
  if (kind === 'compact') {
    return t('working.compacting', { defaultValue: '正在压缩上下文…' });
  }
  if (kind === 'thinking') {
    return t('working.thinking', { defaultValue: '思考中' });
  }
  if (latestMessage.toolName) {
    return formatToolDisplayName(latestMessage.toolName, t);
  }
  return latestMessage.title || latestMessage.content || t('working.processing', { defaultValue: '处理中' });
}

export function getLiveProcessGroupStep(
  group: LiveProcessGroup,
  t: TFunction<'chat'>,
  fallbackRunningStep: ProcessTraceStep | null,
  activityMessages: ChatMessage[] = [],
): ProcessTraceStep {
  const fallbackPhase = String(fallbackRunningStep?.phase || '');
  const canUseFallbackStep = fallbackRunningStep?.title &&
    !['generation', 'thinking', 'permission'].includes(fallbackPhase);
  if (group.isRunning && canUseFallbackStep) {
    return {
      ...fallbackRunningStep,
      id: group.id,
      state: fallbackRunningStep.state || 'running',
    };
  }

  const title = group.isRunning
    ? getRunningProcessTitle(group, t)
    : formatCompletedProcessTitle(group.messages, t);
  const latestMessage = group.messages[group.messages.length - 1];
  const kind = latestMessage ? getProcessToolKind(latestMessage) : 'tool';
  const detail = group.isRunning
    ? getLiveStepDetail(group.messages, activityMessages)
    : undefined;

  return {
    id: group.id,
    title,
    detail: detail || undefined,
    state: group.isRunning ? 'running' : 'completed',
    phase: kind === 'search' ? 'rag' : kind === 'command' ? 'tool' : latestMessage?.phase,
    toolName: latestMessage?.toolName,
  };
}

export function processSummaryToTrace(
  message: ChatMessage,
  t: TFunction<'chat'>,
): {
  label: string;
  collapsedDetail: string;
  statusLabel: string;
  status: string;
  metrics: ProcessTraceMetric[];
  steps: ProcessTraceStep[];
} {
  const rawStatus = String(message.state || 'completed');
  const duration = formatProcessDuration(
    typeof message.durationMs === 'number' ? message.durationMs : 0,
  );
  const label = formatCompletedProcessTitle(message, t) ||
    t('process.summary.processed', {
      duration,
      defaultValue: `Processed ${duration}`,
    });
  const toolCalls = numberField(message, 'toolCallCount');
  const searches = numberField(message, 'ragSearchCount');
  const errors = numberField(message, 'toolErrorCount');
  const status = rawStatus === 'failed' && errors > 0 ? 'completed' : rawStatus;
  const metrics: ProcessTraceMetric[] = [
    toolCalls > 0
      ? {
          key: 'toolCalls',
          label: t('process.metrics.toolCalls', { count: toolCalls, defaultValue: '{{count}} tool calls' }),
        }
      : null,
    searches > 0
      ? {
          key: 'searches',
          label: t('process.metrics.searches', { count: searches, defaultValue: '{{count}} searches' }),
        }
      : null,
    errors > 0
      ? {
          key: 'errors',
          label: t('process.metrics.adjusting', {
            count: errors,
            defaultValue: 'Adjusting ({{count}})',
          }),
        }
      : null,
  ].filter((metric): metric is ProcessTraceMetric => Boolean(metric));
  const steps = Array.isArray(message.keySteps)
    ? message.keySteps
        .filter((step): step is Record<string, unknown> => Boolean(step) && typeof step === 'object')
        .map((step) => {
          const raw: ProcessTraceStep = {
            id: typeof step.activityId === 'string'
              ? step.activityId
              : typeof step.id === 'string'
                ? step.id
                : undefined,
            title: typeof step.title === 'string' ? step.title : undefined,
            detail: typeof step.detail === 'string' ? step.detail : undefined,
            state: typeof step.state === 'string' ? step.state : undefined,
            severity: typeof step.severity === 'string' ? step.severity : undefined,
            phase: typeof step.phase === 'string' ? step.phase : undefined,
            toolName: typeof step.toolName === 'string' ? step.toolName : undefined,
            kind: typeof step.kind === 'string' ? step.kind : undefined,
            target: typeof step.target === 'string' ? step.target : undefined,
          };
          const localized = localizeProcessTraceStep(raw, t);
          return {
            ...raw,
            title: localized.title,
            detail: localized.detail ?? raw.detail,
          };
        })
    : [];

  return {
    label,
    collapsedDetail: '',
    statusLabel: status === 'failed'
      ? t('process.summary.failed', { defaultValue: 'Process failed' })
      : status === 'cancelled'
        ? t('process.summary.cancelled', { defaultValue: 'Process stopped' })
        : t('process.summary.completed', { defaultValue: 'Process completed' }),
    status,
    metrics,
    steps,
  };
}
