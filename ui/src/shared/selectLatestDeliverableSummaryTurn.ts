/**
 * PD-SAAS-FORK: locate the latest deliverable summary turn in a session message list.
 */
import type { ChatMessage } from '../components/chat/types/types';
import {
  isDeliverableSummaryTurnCandidate,
  isFinalAssistantReplyForMessage,
  countAcceptanceRowsForMessage,
} from './deliverableSummaryMountPolicy';
import { extractUserGoalFromSessionMessages, extractUserGoalFromTurnMessages } from './deliverableDisplayPolicy';
import { collectTurnFinalDeliverables } from './collectFinalDeliverables';
import { inferTurnArtifactDirectory } from './reconcileTurnDeliverables';
import { collectTurnAllArtifacts } from './collectDeliverables';
import { extractTurnAcceptanceMeta } from './turnAcceptanceMeta';

export type LatestDeliverableSummarySelection = {
  messageId: string | null;
  /** True when older messages may still be unloaded (C3). */
  provisional: boolean;
};

export type SelectLatestDeliverableSummaryInput = {
  messages: ChatMessage[];
  projectRoot: string;
  hasMoreMessages: boolean;
  /** Cap backward scan — summary turns are always near the tail. */
  maxAssistantScans?: number;
};

/** Default cap: enough for repair-heavy tails without scanning entire history. */
export const DEFAULT_LATEST_SUMMARY_ASSISTANT_SCAN_CAP = 48;

function turnMessagesForIndex(messages: ChatMessage[], index: number): ChatMessage[] {
  const msg = messages[index];
  if (!msg || msg.type !== 'assistant') return [];
  const turnId = msg.turnId ?? msg.id;
  const start = messages.findIndex((m) => m.id === turnId || m.turnId === turnId);
  const from = start >= 0 ? start : index;
  const slice: ChatMessage[] = [];
  for (let i = from; i <= index; i += 1) {
    slice.push(messages[i]);
  }
  return slice;
}

export function selectLatestDeliverableSummaryTurn(
  input: SelectLatestDeliverableSummaryInput,
): LatestDeliverableSummarySelection {
  const {
    messages,
    projectRoot,
    hasMoreMessages,
    maxAssistantScans = DEFAULT_LATEST_SUMMARY_ASSISTANT_SCAN_CAP,
  } = input;
  const sessionGoal = extractUserGoalFromSessionMessages(messages);
  let assistantScans = 0;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.type !== 'assistant') continue;
    assistantScans += 1;
    if (assistantScans > maxAssistantScans) break;

    const nextMessage = messages[i + 1];
    const isFinal = isFinalAssistantReplyForMessage(message, nextMessage);
    const turnMessages = turnMessagesForIndex(messages, i);
    const turnGoal = extractUserGoalFromTurnMessages(turnMessages) || sessionGoal;
    const formattedContent = String(message.content ?? '');
    const turnArtifactDir = typeof message.turnArtifactDir === 'string'
      ? message.turnArtifactDir
      : inferTurnArtifactDirectory(collectTurnAllArtifacts({
        assistantText: formattedContent,
        toolMessages: turnMessages,
        projectRoot,
        userGoalText: turnGoal,
      })) ?? undefined;

    const turnDeliverables = collectTurnFinalDeliverables({
      assistantText: formattedContent,
      toolMessages: turnMessages,
      // PD-SAAS-FORK: frozen SDM prevents summary-turn discovery from adding rows.
      sessionToolMessages: messages,
      projectRoot,
      userGoalText: turnGoal,
      turnArtifactDirOverride: turnArtifactDir,
      verifiedPathsOverride: Array.isArray(message.verifiedDeliverablePaths)
        ? message.verifiedDeliverablePaths.filter((p): p is string => typeof p === 'string')
        : undefined,
    });

    const meta = extractTurnAcceptanceMeta(message);

    if (isDeliverableSummaryTurnCandidate({
      message,
      isFinalAssistantReply: isFinal,
      formattedContent,
      turnDeliverables,
      acceptanceRowCount: countAcceptanceRowsForMessage(message),
      turnUserGoalText: turnGoal,
      turnMessages,
      turnArtifactDir,
      expectedManifest: meta?.expectedManifest,
    })) {
      return {
        messageId: message.id,
        provisional: hasMoreMessages,
      };
    }
  }

  return { messageId: null, provisional: hasMoreMessages };
}

export function resolveValidationPolicyForMessage(
  messageId: string,
  latest: LatestDeliverableSummarySelection,
): 'active' | 'frozen' {
  if (!latest.messageId) return 'frozen';
  if (latest.messageId === messageId) return 'active';
  return 'frozen';
}
